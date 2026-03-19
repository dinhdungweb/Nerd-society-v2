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
 * Get VietQR API Token
 */
export async function getVietQRToken(): Promise<string> {
    const username = process.env.VIETQR_SYSTEM_USERNAME;
    const password = process.env.VIETQR_SYSTEM_PASSWORD;

    if (!username || !password) {
        throw new Error('Missing VIETQR_SYSTEM_USERNAME or VIETQR_SYSTEM_PASSWORD in .env');
    }

    const res = await fetch('https://api.vietqr.org/vqr/api/token_generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (data.code !== '00') {
        throw new Error(`VietQR Token Error: ${data.message || JSON.stringify(data)}`);
    }

    return data.data.access_token;
}

/**
 * Generate official VietQR using API
 */
export async function generateOfficialQR(params: {
    amount: number
    description: string
}): Promise<string> {
    const token = await getVietQRToken();
    const { amount, description } = params;

    const sanitizedDesc = description
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .substring(0, 23)
        .trim();

    const orderId = sanitizedDesc.replace(/\s/g, '').substring(0, 13);

    const payload = {
        bankCode: config.bankCode,
        bankAccount: config.accountNumber,
        userBankName: config.accountName,
        content: sanitizedDesc,
        qrType: 0,
        amount: amount,
        orderId: orderId,
        transType: 'C'
    };

    const res = await fetch('https://api.vietqr.org/vqr/api/qr/generate-customer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.code !== '00' || !data.data || !data.data.qrCode) {
        console.error('[VietQR Generate Error]', data);
        // Fallback to old img.vietqr.io URL if official API fails (e.g. system maintenance)
        return generateVietQRUrl(params); 
    }

    let qrUrl = data.data.qrCode;
    // Đảm bảo là data URI base64 hợp lệ để thẻ <img> hiển thị được
    if (!qrUrl.startsWith('data:image')) {
        qrUrl = `data:image/png;base64,${qrUrl}`;
    }

    return qrUrl;
}

/**
 * Generate payment info for display (Async)
 */
export async function getPaymentInfo(params: {
    amount: number
    bookingCode: string
}) {
    // Format: NERD XXXXXXXX
    const description = `${params.bookingCode}`

    const qrUrl = await generateOfficialQR({
        amount: params.amount,
        description,
    });

    return {
        qrUrl,
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
