/**
 * Script kiểm thử hệ thống Wallet & Subscription v4
 * Cách chạy: node scripts/test-v4.mjs
 */

const BASE_URL = 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || ''; // Lấy từ .env nếu chạy qua shell có load env

async function runTests() {
    console.log('🚀 Bắt đầu kiểm thử hệ thống Nerd v4...\n');

    // 1. Kiểm tra nạp tiền qua Webhook (VietQR)
    console.log('--- Case 1: Nạp tiền tự động (VietQR Webhook) ---');
    try {
        const topupRes = await fetch(`${BASE_URL}/api/webhooks/vietqr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionid: 'TEST_TX_' + Date.now(),
                amount: 200000,
                content: 'TU NS010' // TU + Mã hội viên đã có trong DB (tạo bởi seed script)
            })
        });
        const topupData = await topupRes.json();
        if (topupRes.ok) {
            console.log('✅ Kết quả nạp tiền:', topupData);
        } else {
            console.error('❌ Lỗi nạp tiền (API trả về lỗi):', topupData);
        }
    } catch (e) {
        console.error('❌ Lỗi nạp tiền (Network/Fatal):', e.message);
    }

    console.log('\n--- Case 2: Mô phỏng Polling (Quẹt thẻ ZKTeco) ---');
    try {
        const headers = {};
        if (CRON_SECRET) {
            headers['Authorization'] = `Bearer ${CRON_SECRET}`;
        }

        const pollRes = await fetch(`${BASE_URL}/api/cron/attendance-polling`, {
            method: 'GET',
            headers: headers
        });
        const pollData = await pollRes.json();
        if (pollRes.ok) {
            console.log('✅ Kết quả Polling (ZKTeco Sync):', pollData);
        } else {
            console.error('❌ Lỗi Polling (API trả về lỗi):', pollData);
        }
    } catch (e) {
        console.error('❌ Lỗi Polling (Network/Fatal):', e.message);
    }

    console.log('\n--- Case 3: Kiểm tra Dashboard hôi viên ---');
    console.log('👉 Hãy mở trình duyệt: http://localhost:3000/member/dashboard');
    console.log('👉 Đăng nhập và kiểm tra số dư ví đã tăng lên hay chưa.');

    console.log('\n--- Case 4: Kiểm tra Admin ---');
    console.log('👉 Mở Admin: http://localhost:3000/admin/subscriptions');
    console.log('👉 Kiểm tra Tab "Ví tiền" và "Trực tuyến"');

    console.log('\n✨ Kiểm thử hoàn tất.');
}

runTests();
