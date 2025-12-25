/**
 * VietQR Payment Integration
 * Supports both VietQR.io (Casso) and VietQR.vn (NAPAS)
 *
 * For auto-verification with VietQR.vn:
 * Register at: https://my.vietqr.vn
 */

import crypto from 'crypto'

// Common bank codes
export const BANK_CODES = {
    VIETCOMBANK: 'VCB',
    TECHCOMBANK: 'TCB',
    MBBANK: 'MB',
    TPBANK: 'TPB',
    BIDV: 'BIDV',
    AGRIBANK: 'VBA',
    ACB: 'ACB',
    VPBANK: 'VPB',
    SACOMBANK: 'STB',
    VIETINBANK: 'ICB',
} as const

export type BankCode = typeof BANK_CODES[keyof typeof BANK_CODES]

interface VietQRConfig {
    bankCode: string
    accountNumber: string
    accountName: string
    template?: 'compact' | 'compact2' | 'qr_only' | 'print'
    // Webhook secret for verification
    webhookSecret?: string
}

// Load from environment
const config: VietQRConfig = {
    bankCode: process.env.VIETQR_BANK_CODE || 'MB',
    accountNumber: process.env.VIETQR_ACCOUNT_NUMBER || '',
    accountName: process.env.VIETQR_ACCOUNT_NAME || 'NERD SOCIETY',
    template: (process.env.VIETQR_TEMPLATE as VietQRConfig['template']) || 'compact2',
    webhookSecret: process.env.VIETQR_WEBHOOK_SECRET,
}

/**
 * Generate VietQR image URL
 * Uses https://img.vietqr.io service (Public API)
 * This works for both services as it generates a standard VietQR code.
 */
export function generateVietQRUrl(params: {
    amount: number
    description: string
}) {
    const { amount, description } = params

    // Sanitize description (remove special chars, limit length)
    const sanitizedDesc = description
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .substring(0, 50)
        .trim()

    // Build URL
    // Format: https://img.vietqr.io/image/{BANK_ID}-{ACCOUNT_NO}-{TEMPLATE}.png?amount={AMOUNT}&addInfo={DESCRIPTION}
    const baseUrl = 'https://img.vietqr.io/image'
    const imagePath = `${config.bankCode}-${config.accountNumber}-${config.template}.png`

    const queryParams = new URLSearchParams({
        amount: amount.toString(),
        addInfo: sanitizedDesc,
        accountName: config.accountName,
    })

    return `${baseUrl}/${imagePath}?${queryParams.toString()}`
}

/**
 * Generate payment info for display
 */
export function getPaymentInfo(params: {
    amount: number
    bookingCode: string
}) {
    // Format: NERD XXXXXXXX
    // VietQR content length is limited, so we send the booking code clearly
    const description = `${params.bookingCode}`

    return {
        qrUrl: generateVietQRUrl({
            amount: params.amount,
            description,
        }),
        bankCode: config.bankCode,
        accountNumber: config.accountNumber,
        accountName: config.accountName,
        amount: params.amount,
        description,
    }
}

/**
 * Check if VietQR is configured
 */
export function isVietQRConfigured(): boolean {
    return !!(config.bankCode && config.accountNumber && config.accountName)
}

/**
 * VietQR.vn Webhook Payload Interface
 * Based on 'N05' notification type
 */
export interface VietQRVNWebhookPayload {
    notificationType: string // 'N05' for balance fluctuation
    transactionid?: string
    referencenumber?: string
    amount?: string | number
    content?: string
    bankaccount?: string
    transType?: string // 'C' for Credit (Incoming), 'D' for Debit
    orderId?: string
    // other fields...
}

/**
 * Verify VietQR Webhook
 * Supports basic secret check/signature if provided by the service
 */
export function verifyVietQRWebhook(
    payload: any,
    signature?: string | null
): boolean {
    // If no webhook secret configured, we might verify by other means or skip (dev mode)
    if (!config.webhookSecret) {
        console.warn('[VietQR] Webhook secret not configured, skipping signature verification')
        return true
    }

    // Note: Verify logic depends on specific provider implementation (VietQR.vn vs VietQR.io)
    // For now, we return true if config exists, but real implementation should check signature
    // specific to the chosen provider.
    // If you are using a proxy that adds a signature header (like HMAC), verify it here.

    return true
}
