import { prisma } from '@/lib/prisma';
import { differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { $Enums } from '@prisma/client';

const RATE_PER_HOUR = 15000;
const DAILY_CAP_MIN = 480; // 8 hours

export type CheckInResult = {
    success: boolean;
    message: string;
    subscriberName?: string;
    remainingMin?: number;
    walletBalance?: number;
    outstandingBalance?: number;
    errorType?: 'BLOCK_DEBT' | 'BLOCK_EXPIRED' | 'BLOCK_LOW_BALANCE' | 'BLOCK_CAP_REACHED' | 'NOT_FOUND';
};

/**
 * Xử lý Check-in khi tap thẻ
 */
export async function handleCheckIn(cardNo: string, branch: string, customTime?: Date): Promise<CheckInResult> {
    const now = customTime || new Date();
    // 1. Tìm subscriber
    const subscriber = await prisma.subscriber.findUnique({
        where: { cardNo },
        include: {
            subscriptions: {
                where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] as $Enums.SubscriptionStatus[] } },
                orderBy: { createdAt: 'desc' },
            }
        }
    });

    if (!subscriber) {
        return { success: false, message: 'Không tìm thấy thông tin thẻ này.', errorType: 'NOT_FOUND' };
    }

    // 2. Kiểm tra nợ tồn đọng (Outstanding Balance)
    if (subscriber.outstandingBalance > 0) {
        return {
            success: false,
            message: `Vui lòng thanh toán ${subscriber.outstandingBalance.toLocaleString()}đ phí quá giờ để tiếp tục.`,
            outstandingBalance: subscriber.outstandingBalance,
            errorType: 'BLOCK_DEBT'
        };
    }

    // 3. Ưu tiên 1: Subscription (Gói tháng)
    const activeSub = subscriber.subscriptions[0];
    if (activeSub) {
        // Kiểm tra hết hạn nếu đã kích hoạt
        if (activeSub.status === 'ACTIVE' && activeSub.endDate && activeSub.endDate < now) {
            // Auto-expire sub
            await prisma.subscription.update({
                where: { id: activeSub.id },
                data: { status: 'EXPIRED' }
            });
            // Tiếp tục xuống kiểm tra Wallet...
        } else {
            // Kích hoạt nếu là lần đầu tap
            if (activeSub.status === 'PENDING_ACTIVATION') {
                const activationTime = now;
                const endDate = new Date(activationTime);
                endDate.setDate(endDate.getDate() + 30);

                await prisma.subscription.update({
                    where: { id: activeSub.id },
                    data: {
                        status: 'ACTIVE',
                        activationDate: now,
                        startDate: now,
                        endDate: endDate,
                    }
                });
            }

            // Tính toán Cap 8h
            const today = startOfDay(now);

            const usageToday = await prisma.dailyUsage.findUnique({
                where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } }
            });

            const usedMin = usageToday?.totalMin || 0;
            const remainingMin = Math.max(0, DAILY_CAP_MIN - usedMin);

            // Theo spec v4: Check-in block nếu đã hết 8h
            if (remainingMin <= 0) {
                return {
                    success: false,
                    message: 'Bạn đã sử dụng hết 8h miễn phí hôm nay. Vui lòng quay lại vào ngày mai hoặc dùng Wallet.',
                    errorType: 'BLOCK_CAP_REACHED'
                };
            }

            // Tạo Session
            await prisma.subscriptionSession.create({
                data: {
                    subscriberId: subscriber.id,
                    subscriptionId: activeSub.id,
                    branch,
                    checkInTime: now,
                    status: 'ACTIVE' as $Enums.SessionStatus,
                    source: 'card'
                }
            });

            return {
                success: true,
                message: `Chào ${subscriber.fullName}! Hôm nay bạn còn ${Math.floor(remainingMin / 60)}h ${remainingMin % 60}m.`,
                subscriberName: subscriber.fullName,
                remainingMin
            };
        }
    }

    // 4. Ưu tiên 2: Wallet (Ví tiền)
    if (subscriber.walletBalance < (RATE_PER_HOUR / 4)) {
        return {
            success: false,
            message: `Số dư ví (${subscriber.walletBalance.toLocaleString()}đ) không đủ. Vui lòng nạp thêm.`,
            walletBalance: subscriber.walletBalance,
            errorType: 'BLOCK_LOW_BALANCE'
        };
    }

    // Tạo Session cho Wallet
    await prisma.subscriptionSession.create({
        data: {
            subscriberId: subscriber.id,
            branch,
            checkInTime: now,
            status: 'ACTIVE' as $Enums.SessionStatus,
            source: 'card'
        }
    });

    return {
        success: true,
        message: `Chào ${subscriber.fullName}! Số dư ví: ${subscriber.walletBalance.toLocaleString()}đ.`,
        subscriberName: subscriber.fullName,
        walletBalance: subscriber.walletBalance
    };
}

/**
 * Xử lý Check-out khi tap thẻ
 */
export async function handleCheckOut(cardNo: string, customTime?: Date): Promise<CheckInResult> {
    const now = customTime || new Date();
    const subscriber = await prisma.subscriber.findUnique({
        where: { cardNo },
        include: {
            sessions: {
                where: { status: 'ACTIVE' as $Enums.SessionStatus },
                orderBy: { checkInTime: 'desc' },
                take: 1
            }
        }
    });

    if (!subscriber || !subscriber.sessions[0]) {
        return { success: false, message: 'Không tìm thấy phiên check-in đang hoạt động.', errorType: 'NOT_FOUND' };
    }

    const session = subscriber.sessions[0];
    const durationMin = differenceInMinutes(now, session.checkInTime);

    // Quy tắc làm tròn 15 phút (CEIL)
    const roundedMin = Math.ceil(durationMin / 15) * 15;
    const chargeAmountPerHour = RATE_PER_HOUR;

    let message = `Tạm biệt ${subscriber.fullName}! Phiên ngồi của bạn kéo dài ${Math.floor(durationMin / 60)}h ${durationMin % 60}m.`;

    // 1. Nếu là Subscription
    if (session.subscriptionId) {
        const today = startOfDay(session.checkInTime);
        const usage = await prisma.dailyUsage.upsert({
            where: { subscriberId_usageDate: { subscriberId: subscriber.id, usageDate: today } },
            create: { subscriberId: subscriber.id, subscriptionId: session.subscriptionId, usageDate: today, totalMin: durationMin },
            update: { totalMin: { increment: durationMin } }
        });

        // 🟢 BỔ SUNG: Cập nhật tổng số phút đã dùng vào Gói dịch vụ
        await prisma.subscription.update({
            where: { id: session.subscriptionId },
            data: { usedHoursMin: { increment: durationMin } }
        });

        // Tính overage
        const usedMinBefore = (usage.totalMin - durationMin);
        const capRemaining = Math.max(0, DAILY_CAP_MIN - usedMinBefore);
        const overageMin = Math.max(0, durationMin - capRemaining);

        if (overageMin > 0) {
            const roundedOverage = Math.ceil(overageMin / 15) * 15;
            const overageCharge = (roundedOverage / 60) * chargeAmountPerHour;

            await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { outstandingBalance: { increment: Math.round(overageCharge) } }
            });

            await prisma.transaction.create({
                data: {
                    subscriberId: subscriber.id,
                    type: 'OVERAGE_CHARGE' as $Enums.TransactionType,
                    amount: -Math.round(overageCharge),
                    balanceBefore: subscriber.walletBalance,
                    balanceAfter: subscriber.walletBalance,
                    reference: session.id,
                    description: `Phí quá giờ (${overageMin}m)`
                }
            });

            message += ` Phí quá giờ: ${Math.round(overageCharge).toLocaleString()}đ (vui lòng TT lần sau).`;
        }
    } else {
        // 2. Nếu dùng Wallet
        const amount = (roundedMin / 60) * chargeAmountPerHour;
        const paidAmount = Math.min(subscriber.walletBalance, amount);
        const debtAmount = Math.max(0, amount - paidAmount);

        await prisma.subscriber.update({
            where: { id: subscriber.id },
            data: {
                walletBalance: { decrement: paidAmount },
                outstandingBalance: { increment: debtAmount }
            }
        });

        await prisma.transaction.create({
            data: {
                subscriberId: subscriber.id,
                type: 'SESSION_CHARGE' as $Enums.TransactionType,
                amount: -Math.round(amount),
                balanceBefore: subscriber.walletBalance,
                balanceAfter: subscriber.walletBalance - paidAmount,
                reference: session.id,
                description: `Phí sử dụng Wallet (${durationMin}m)`
            }
        });

        if (debtAmount > 0) {
            message += ` Trừ ví ${paidAmount.toLocaleString()}đ và ghi nợ ${debtAmount.toLocaleString()}đ.`;
        } else {
            message += ` Đã trừ ${paidAmount.toLocaleString()}đ. Số dư: ${(subscriber.walletBalance - paidAmount).toLocaleString()}đ.`;
        }
    }

    await prisma.subscriptionSession.update({
        where: { id: session.id },
        data: {
            checkOutTime: now,
            durationMin,
            status: 'COMPLETED' as $Enums.SessionStatus,
        }
    });

    return { success: true, message, subscriberName: subscriber.fullName };
}
