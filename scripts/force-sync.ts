import { handleCheckIn, handleCheckOut } from '../src/lib/subscription/session-manager';
import { getAttendanceList, getBranchFromDevice } from '../src/lib/mytime-api';
import { prisma } from '../src/lib/prisma';
import { format, startOfDay } from 'date-fns';

async function forceSyncToday() {
    console.log('--- ĐANG QUÉT TOÀN BỘ DỮ LIỆU CHẤM CÔNG HÔM NAY ---');
    const today = new Date();
    const fromDate = format(startOfDay(today), 'yyyy-MM-dd HH:mm:ss');
    const toDate = format(today, 'yyyy-MM-dd HH:mm:ss');
    
    console.log(`Khoảng thời gian: ${fromDate} -> ${toDate}`);

    try {
        const response = await getAttendanceList(fromDate, toDate);
        if (response.result !== 'success' || !Array.isArray(response.data)) {
            console.error('❌ MyTime API báo lỗi:', response);
            return;
        }

        const records = (response.data as any).flat();
        console.log(`Tìm thấy tổng cộng ${records.length} bản ghi trên MyTime.`);

        for (const record of records) {
            const externalId = `${record.EmployeeID}_${record.AttDate}_${record.AttTime}`;
            
            // Kiểm tra xem đã xử lý chưa
            const existing = await prisma.subscriptionAuditLog.findFirst({
                where: { details: { path: ['external_id'], equals: externalId } }
            });

            if (existing) {
                console.log(`- Đã bỏ qua (đã tồn tại): ${record.EmployeeID} lúc ${record.AttTime}`);
                continue;
            }

            console.log(`+ Đang xử lý bản ghi mới: ${record.EmployeeID} lúc ${record.AttTime}...`);
            
            // Tìm subscriber
            const subscriber = await prisma.subscriber.findUnique({
                where: { mytimeEmpId: record.EmployeeID },
                include: { sessions: { where: { status: 'ACTIVE' } } }
            });

            if (!subscriber) {
                console.warn(`  ⚠ Không tìm thấy hội viên mã ${record.EmployeeID} trên Web.`);
                continue;
            }

            const branch = getBranchFromDevice(record.sn || record.MachineAlias);
            
            // Fake xử lý Check-in/Out (Copy logic từ polling)
            if (subscriber.sessions.length > 0) {
                await handleCheckOut(subscriber.cardNo!);
                console.log(`  ✅ Đã Check-out cho ${subscriber.fullName}`);
            } else {
                const res = await handleCheckIn(subscriber.cardNo!, branch);
                console.log(`  ✅ Đã Check-in cho ${subscriber.fullName}: ${res.message}`);
            }

            // Lưu log để không quét lại lần sau
            await prisma.subscriptionAuditLog.create({
                data: {
                    action: 'TAP_CARD',
                    entityType: 'ATTENDANCE',
                    entityId: record.EmployeeID,
                    performedBy: 'system',
                    details: { external_id: externalId, ...record }
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Lỗi hệ thống:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

forceSyncToday();
