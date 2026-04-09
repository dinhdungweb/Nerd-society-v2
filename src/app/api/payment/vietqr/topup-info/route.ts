import { NextRequest, NextResponse } from 'next/server';
import { generateOfficialQR, isVietQRConfigured, getVietQRConfig } from '@/lib/vietqr';

/**
 * GET /api/payment/vietqr/topup-info?empId=xxx
 * Sinh mã QR nạp tiền ví từ API chính gốc (EMVCo chuẩn)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const empId = searchParams.get('empId');

        if (!empId) {
            return NextResponse.json({ error: 'empId is required' }, { status: 400 });
        }

        // Kiểm tra cấu hình VietQR
        if (!isVietQRConfigured()) {
            return NextResponse.json({ error: 'VietQR is not configured' }, { status: 500 });
        }

        const transferContent = `TU ${empId}`;
        const config = getVietQRConfig();

        // Sinh mã QR từ API chính gốc (Base64)
        const qrUrl = await generateOfficialQR({
            amount: 0, // Nạp tiền tùy chọn
            description: transferContent
        });

        return NextResponse.json({
            success: true,
            qrUrl,
            bankCode: config.bankCode,
            accountNumber: config.accountNumber,
            accountName: config.accountName,
            description: transferContent,
            empId
        });

    } catch (error: any) {
        console.error('[API TopupInfo] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
