/**
 * Compatibility actions for old Monthly Beaver admin components.
 * New wallet balance lives in Wallet/WalletTransaction.
 */
'use server'

import { prisma } from '@/lib/prisma'
import { applyWalletTransaction, paySubscriberDebtWithWallet } from '@/lib/wallet-ledger'
import { revalidatePath } from 'next/cache'

async function getSubscriberWallet(subscriberId: string) {
    const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: {
            id: true,
            fullName: true,
            user: {
                select: {
                    wallet: {
                        select: { id: true, balance: true },
                    },
                },
            },
        },
    })

    if (!subscriber) throw new Error('Khong tim thay hoi vien')
    if (!subscriber.user?.wallet) throw new Error('Hoi vien chua co vi user')

    return { subscriber, wallet: subscriber.user.wallet }
}

export async function topUpWallet(subscriberId: string, amount: number, reference?: string, description?: string) {
    try {
        if (amount <= 0) throw new Error('So tien nap phai lon hon 0')

        const { subscriber, wallet } = await getSubscriberWallet(subscriberId)
        const result = await applyWalletTransaction({
            walletId: wallet.id,
            type: 'TOPUP',
            amount,
            source: 'MANUAL_ADMIN',
            referenceType: reference ? 'manual_reference' : 'subscriber',
            referenceId: reference || subscriber.id,
            externalTransactionId: reference,
            description: description || 'Nap tien vao vi',
        })

        revalidatePath('/admin/subscriptions')
        return { success: true, newBalance: result.balanceAfter }
    } catch (error: any) {
        console.error('[Wallet] Top-up failed:', error)
        return { success: false, error: error.message }
    }
}

export async function payOutstandingBalance(subscriberId: string, amount: number, reference?: string) {
    try {
        const subscriber = await prisma.subscriber.findUnique({
            where: { id: subscriberId },
            select: { id: true, outstandingBalance: true },
        })

        if (!subscriber) throw new Error('Khong tim thay hoi vien')

        const payAmount = Math.min(amount, subscriber.outstandingBalance)
        const remainingDebt = subscriber.outstandingBalance - payAmount

        await prisma.subscriber.update({
            where: { id: subscriberId },
            data: { outstandingBalance: remainingDebt },
        })

        await prisma.subscriptionAuditLog.create({
            data: {
                action: 'wallet_debt_cash_payment',
                entityType: 'subscriber',
                entityId: subscriberId,
                performedBy: 'admin',
                details: { amount: payAmount, reference },
            },
        })

        revalidatePath('/admin/subscriptions')
        revalidatePath('/admin/wallets')
        return { success: true, remainingDebt }
    } catch (error: any) {
        console.error('[Wallet] Payment failed:', error)
        return { success: false, error: error.message }
    }
}

export async function payDebtWithWallet(subscriberId: string) {
    try {
        const result = await paySubscriberDebtWithWallet({ subscriberId })
        revalidatePath('/admin/subscriptions')
        return {
            success: true,
            newDebt: result.remainingDebt,
            newWalletBalance: result.newWalletBalance,
        }
    } catch (error: any) {
        console.error('[Wallet] Reconcile failed:', error)
        return { success: false, error: error.message }
    }
}
