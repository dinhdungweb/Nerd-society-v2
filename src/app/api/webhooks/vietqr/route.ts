import { verifyVietQRWebhook } from '@/lib/vietqr'
import { processVietQRWalletTopup, recordBankTransaction } from '@/lib/wallet-ledger'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const body = await request.json()
    const signature = request.headers.get('x-signature')

    if (!verifyVietQRWebhook(body, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    try {
        const content = String(body.content || body.description || '')
        const amount = Number(body.amount)
        const transactionId = String(body.transactionid || body.id || body.reference || '')

        if (!transactionId || !Number.isFinite(amount) || amount <= 0) {
            return NextResponse.json({ message: 'Ignore: invalid transaction payload' })
        }

        const transactionTime = body.transactiontime ? new Date(Number(body.transactiontime)) : new Date()
        const parsedTransactionTime = Number.isNaN(transactionTime.getTime()) ? new Date() : transactionTime

        if (!content.toUpperCase().includes('VI')) {
            await recordBankTransaction({
                externalTransactionId: transactionId,
                bankAccount: body.bankaccount,
                amount: Math.round(amount),
                transType: body.transType || 'C',
                content,
                transactionTime: parsedTransactionTime,
                status: 'ERROR',
                rawPayload: body,
                note: 'No wallet code in transfer content',
            })
            return NextResponse.json({ message: 'No wallet code found' })
        }

        const result = await processVietQRWalletTopup({
            externalTransactionId: transactionId,
            bankAccount: body.bankaccount,
            amount: Math.round(amount),
            transType: body.transType || 'C',
            content,
            transactionTime: parsedTransactionTime,
            rawPayload: body,
        })

        return NextResponse.json({
            success: result.success,
            alreadyProcessed: result.alreadyProcessed || false,
            message: result.message,
            newBalance: result.newBalance,
        })
    } catch (error: any) {
        console.error('[Webhook] Error processing VietQR webhook:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
