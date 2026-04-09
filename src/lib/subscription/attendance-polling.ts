import { getAttendanceList, getBranchFromDevice } from '@/lib/mytime-api';
import { handleCheckIn, handleCheckOut } from './session-manager';
import { prisma } from '@/lib/prisma';
import { sendZaloNotification } from '@/lib/external/zalo-oa';
import { format } from 'date-fns';

/**
 * Service xử lý dữ liệu quẹt thẻ từ ZKTeco
 */
export async function pollAttendanceRecords() {
    const now = new Date();
    // Lấy dữ liệu 5 phút gần nhất để tránh sót record do lag mạng
    const fromDate = format(new Date(now.getTime() - 5 * 60 * 1000), 'yyyy-MM-dd HH:mm:ss');
    const toDate = format(now, 'yyyy-MM-dd HH:mm:ss');

    try {
        const response = await getAttendanceList(fromDate, toDate);
        if (response.result !== 'success' || !Array.isArray(response.data)) {
            console.warn('[Polling] MyTime API returned error or no data', response);
            return;
        }

        const records = (response.data as any).flat();
        for (const record of records) {
            // Check if record already processed (Tránh doubletaps)
            const existingRecord = await prisma.subscriptionAuditLog.findFirst({
                where: {
                    details: { path: ['external_id'], equals: `${record.EmployeeID}_${record.AttDate}_${record.AttTime}` }
                }
            });

            if (existingRecord) continue;

            // Xử lý Check-in/Out
            await processTapRecord(record);

            // Log record as processed
            await prisma.subscriptionAuditLog.create({
                data: {
                    action: 'TAP_CARD',
                    entityType: 'ATTENDANCE',
                    entityId: record.EmployeeID,
                    performedBy: 'system',
                    details: {
                        external_id: `${record.EmployeeID}_${record.AttDate}_${record.AttTime}`,
                        ...record
                    }
                }
            });
        }
    } catch (error) {
        console.error('[Polling] Fatal error polling attendance:', error);
    }
}

async function processTapRecord(record: any) {
    if (!record.EmployeeID) {
        console.warn('[Polling] Record missing EmployeeID:', record);
        return;
    }

    const subscriber = await prisma.subscriber.findUnique({
        where: { mytimeEmpId: record.EmployeeID },
        include: {
            sessions: {
                where: { status: 'ACTIVE' },
                orderBy: { checkInTime: 'desc' },
                take: 1
            }
        }
    });

    if (!subscriber) {
        console.warn(`[Polling] Could not find subscriber for EmpId: ${record.EmployeeID}`);
        return;
    }

    const branch = getBranchFromDevice(record.sn || record.MachineAlias);

    // Toggle Check-in/Out logic
    if (subscriber.sessions.length > 0) {
        // Khách đang ngồi -> Thực hiện Check-out
        const result = await handleCheckOut(subscriber.cardNo!);
        if (result.success) {
            await sendZaloNotification(subscriber.phone, 'CHECK_OUT_SUB', {
                'CustomerName': subscriber.fullName,
                'Message': result.message
            });
        }
    } else {
        // Khách chưa ngồi -> Thực hiện Check-in
        const result = await handleCheckIn(subscriber.cardNo!, branch);
        if (result.success) {
            await sendZaloNotification(subscriber.phone, 'CHECK_IN_SUB', {
                'CustomerName': subscriber.fullName,
                'RemainingTime': result.remainingMin ? `${Math.floor(result.remainingMin / 60)}h ${result.remainingMin % 60}m` : 'Hết 8h',
                'Message': result.message
            });
        } else {
            // Thông báo lỗi (Ví dụ: nợ tiền, hết hạn...)
            await sendZaloNotification(subscriber.phone, 'BLOCK_CHECKIN', {
                'CustomerName': subscriber.fullName,
                'ErrorMessage': result.message
            } as any);
        }
    }
}
