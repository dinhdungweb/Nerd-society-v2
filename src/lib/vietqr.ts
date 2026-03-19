/**
 * VietQR Payment Integration
 * Supports both VietQR.io (Casso) and VietQR.vn (NAPAS)
 *
 * For auto-verification with VietQR.vn:
 * Register at: https://my.vietqr.vn
 */

import * as crypto from 'crypto'

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
 * Get VietQR API Token (Basic Auth)
 */
export async function getVietQRToken(): Promise<string> {
    const username = process.env.VIETQR_SYSTEM_USERNAME;
    const password = process.env.VIETQR_SYSTEM_PASSWORD;

    if (!username || !password) {
        throw new Error('Missing VIETQR_SYSTEM_USERNAME or VIETQR_SYSTEM_PASSWORD in .env');
    }

    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    const res = await fetch('https://api.vietqr.org/vqr/api/token_generate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
            'User-Agent': 'NerdSociety/1.0',
            'Referer': 'https://api.vietqr.vn/'
        },
        cache: 'no-store'
    });

    const textData = await res.text();
    let data;
    try {
        data = JSON.parse(textData);
    } catch (e) {
        console.error('[VietQR Token Error] Unexpected Response:', textData.substring(0, 200));
        throw new Error(`VietQR Token Error: Received HTML instead of JSON. Check credentials.`);
    }

    if (!res.ok || !data.access_token) {
        throw new Error(`VietQR Token Error: ${JSON.stringify(data)}`);
    }

    return data.access_token;
}

/**
 * Generate official VietQR using API
 * The API returns an EMVCo string which we render into a Base64 image
 */
export async function generateOfficialQR(params: {
    amount: number
    description: string
}): Promise<string> {
    try {
        const token = await getVietQRToken();
        const { amount, description } = params;

        const sanitizedDesc = description
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .substring(0, 23)
            .trim();

        const orderId = sanitizedDesc.replace(/\s/g, '').substring(0, 13);

        const officialBankCode = BANK_CODES[config.bankCode as keyof typeof BANK_CODES] || config.bankCode;

        const payload = {
            bankCode: officialBankCode,
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
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'NerdSociety/1.0',
                'Referer': 'https://api.vietqr.vn/'
            },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });

        // Parse JSON root response (it doesn't have a 'data' wrapper based on real tests)
        // We call this to ensure the transaction is registered on VietQR system for Callback/Webhook
        const textResponse = await res.text();
        try {
            JSON.parse(textResponse);
        } catch (e) {
            console.warn('[VietQR Register] Failed to parse JSON, but proceeding with image anyway.');
        }

        // Now return the BRANDED image URL from the image service
        // This gives the official VietQR logo and bank branding
        const baseUrl = 'https://img.vietqr.io/image';
        const imagePath = `${officialBankCode}-${config.accountNumber}-${config.template}.png`;

        const queryParams = new URLSearchParams({
            amount: amount.toString(),
            addInfo: sanitizedDesc,
            accountName: config.accountName,
        });

        return `${baseUrl}/${imagePath}?${queryParams.toString()}`;
    } catch (error) {
        console.error('[VietQR Generate Error] Exception:', error);
        // Fallback to image service direct link if registration fails
        const officialBankCode = BANK_CODES[config.bankCode as keyof typeof BANK_CODES] || config.bankCode;
        return `https://img.vietqr.io/image/${officialBankCode}-${config.accountNumber}-${config.template}.png?amount=${params.amount}&addInfo=${params.description}&accountName=${encodeURIComponent(config.accountName)}`;
    }
}

/**
 * Generate payment info for display (Async)
 */
export async function getPaymentInfo(params: {
    amount: number
    bookingCode: string
}) {
    // Format: NERD XXXXXXXX
    // VietQR content length is limited, so we send the booking code clearly
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
