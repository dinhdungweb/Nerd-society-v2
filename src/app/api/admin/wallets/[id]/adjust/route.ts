import { canManage } from '@/lib/apiPermissions'
import { prisma } from '@/lib/prisma'
import { applyWalletTransaction, paySubscriberDebtWithWallet } from '@/lib/wallet-ledger'
import { WalletTransactionType } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { session, hasAccess } = await canManage('Wallets')
        if (!session || !hasAccess) {
            return NextResponse.json({ error: 'Không có quyền quản lý ví' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const action = String(body.action || '').toUpperCase()
        const amount = Number(body.amount)
        const note = String(body.note || '').trim()

        if (!note) {
            return NextResponse.json({ error: 'Vui long nhap ly do thao tac' }, { status: 400 })
        }

        const wallet = await prisma.wallet.findUnique({
            where: { id },
            include: { user: { select: { subscriber: { select: { id: true } } } } },
        })

        if (!wallet) {
            return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 })
        }

        if (action === 'PAY_DEBT') {
            const subscriberId = wallet.user.subscriber?.id
            if (!subscriberId) {
                return NextResponse.json({ error: 'User này không có Monthly Beaver subscriber' }, { status: 400 })
            }

            const result = await paySubscriberDebtWithWallet({
                subscriberId,
                amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : undefined,
                note,
                createdById: session.user.id,
            })

            return NextResponse.json({ success: true, result })
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ error: 'Số tiền phải lớn hơn 0' }, { status: 400 })
        }

        const signedAmount = action === 'DEBIT' ? -Math.round(amount) : Math.round(amount)
        const type: WalletTransactionType =
            action === 'REFUND' ? 'REFUND' :
                action === 'DEBIT' ? 'DEBIT' :
                    action === 'ADJUSTMENT' ? 'ADJUSTMENT' :
                        'TOPUP'

        const result = await applyWalletTransaction({
            walletId: wallet.id,
            type,
            amount: signedAmount,
            source: 'MANUAL_ADMIN',
            referenceType: 'admin_adjustment',
            referenceId: session.user.id,
            description: `Admin điều chỉnh ví: ${action}`,
            note,
            createdById: session.user.id,
        })

        return NextResponse.json({ success: true, result })
    } catch (error: any) {
        console.error('[AdminWalletAdjust] Error:', error)
        return NextResponse.json({ error: error.message || 'Không thể điều chỉnh ví' }, { status: 500 })
    }
}
