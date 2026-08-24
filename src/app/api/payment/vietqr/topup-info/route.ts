import { prisma } from '@/lib/prisma'
import { generateOfficialQR, getVietQRConfig, isVietQRConfigured } from '@/lib/vietqr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/payment/vietqr/topup-info?walletCode=xxx
 * Wallet top-up lookup uses the canonical wallet code only.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const walletCode = searchParams.get('walletCode')
        if (!walletCode) {
            return NextResponse.json({ error: 'walletCode is required' }, { status: 400 })
        }

        const wallet = await prisma.wallet.findUnique({ where: { walletCode } })

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet account not found' }, { status: 404 })
        }

        if (!isVietQRConfigured()) {
            return NextResponse.json({ error: 'VietQR is not configured' }, { status: 500 })
        }

        const transferContent = `VI ${wallet.walletCode}`
        const config = getVietQRConfig()
        const qrUrl = await generateOfficialQR({
            amount: 0,
            description: transferContent,
        })

        return NextResponse.json({
            success: true,
            qrUrl,
            bankCode: config.bankCode,
            accountNumber: config.accountNumber,
            accountName: config.accountName,
            description: transferContent,
            walletCode: wallet.walletCode,
        })
    } catch (error: any) {
        console.error('[API TopupInfo] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
