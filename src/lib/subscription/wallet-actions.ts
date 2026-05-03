/**
 * Wallet Server Actions
 */
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { $Enums } from '@prisma/client';

/**
 * Nạp tiền vào Wallet (Dùng cho Admin nạp thủ công hoặc Webhook gọi)
 */
export async function topUpWallet(subscriberId: string, amount: number, reference?: string, description?: string) {
    if (amount <= 0) throw new Error('Số tiền nạp phải lớn hơn 0');

    try {
        const subscriber = await prisma.subscriber.findUnique({
            where: { id: subscriberId }
        });

        if (!subscriber) throw new Error('Không tìm thấy hội viên');

        const balanceBefore = subscriber.walletBalance;
        const balanceAfter = balanceBefore + amount;

        // Cập nhật số dư và lưu Transaction theo thứ tự nguyên tử
        const result = await prisma.$transaction([
            prisma.subscriber.update({
                where: { id: subscriberId },
                data: { walletBalance: balanceAfter }
            }),
            prisma.transaction.create({
                data: {
                    subscriberId,
                    type: 'TOPUP' as $Enums.TransactionType,
                    amount: amount,
                    balanceBefore,
                    balanceAfter,
                    reference,
                    description: description || `Nạp tiền vào ví`
                }
            })
        ]);

        revalidatePath('/admin/subscriptions');
        revalidatePath('/member/dashboard');
        
        return { success: true, newBalance: balanceAfter };
    } catch (error: any) {
        console.error('[Wallet] Top-up failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Thanh toán nợ quá giờ (Outstanding Balance)
 */
export async function payOutstandingBalance(subscriberId: string, amount: number, reference?: string) {
    try {
        const subscriber = await prisma.subscriber.findUnique({
            where: { id: subscriberId }
        });

        if (!subscriber) throw new Error('Không tìm thấy hội viên');

        const payAmount = Math.min(amount, subscriber.outstandingBalance);
        const remainingDebt = subscriber.outstandingBalance - payAmount;

        await prisma.$transaction([
            prisma.subscriber.update({
                where: { id: subscriberId },
                data: { outstandingBalance: remainingDebt }
            }),
            prisma.transaction.create({
                data: {
                    subscriberId,
                    type: 'OVERAGE_PAYMENT' as $Enums.TransactionType,
                    amount: payAmount,
                    balanceBefore: subscriber.walletBalance,
                    balanceAfter: subscriber.walletBalance,
                    reference,
                    description: `Thanh toán phí quá giờ`
                }
            })
        ]);

        revalidatePath('/admin/subscriptions');
        return { success: true, remainingDebt };
    } catch (error: any) {
        console.error('[Wallet] Payment failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Tự động cấn trừ công nợ quá giờ bằng số dư ví
 */
export async function payDebtWithWallet(subscriberId: string) {
    try {
        const subscriber = await prisma.subscriber.findUnique({
            where: { id: subscriberId }
        });

        if (!subscriber) throw new Error('Không tìm thấy hội viên');
        if (subscriber.walletBalance <= 0 || subscriber.outstandingBalance <= 0) {
            throw new Error('Số dư ví hoặc công nợ không hợp lệ để cấn trừ');
        }

        const payAmount = Math.min(subscriber.walletBalance, subscriber.outstandingBalance);
        const newWalletBalance = subscriber.walletBalance - payAmount;
        const newDebt = subscriber.outstandingBalance - payAmount;

        await prisma.$transaction([
            prisma.subscriber.update({
                where: { id: subscriberId },
                data: { 
                    walletBalance: newWalletBalance,
                    outstandingBalance: newDebt
                }
            }),
            prisma.transaction.create({
                data: {
                    subscriberId,
                    type: 'OVERAGE_PAYMENT' as $Enums.TransactionType,
                    amount: payAmount,
                    balanceBefore: subscriber.walletBalance,
                    balanceAfter: newWalletBalance,
                    description: `Tự động cấn trừ nợ quá giờ từ số dư ví`
                }
            })
        ]);

        revalidatePath('/admin/subscriptions');
        return { success: true, newDebt, newWalletBalance };
    } catch (error: any) {
        console.error('[Wallet] Reconcile failed:', error);
        return { success: false, error: error.message };
    }
}
