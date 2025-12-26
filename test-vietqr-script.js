// Configuration
const BASE_URL = 'http://160.30.112.47:3000';
const USERNAME = '0904521145';
const PASSWORD = 'Dinhdung12345@';

async function testVietQR() {
    console.log('🚀 Starting VietQR Integration Test...\n');

    // 1. Get Token
    console.log('1️⃣  Step 1: Getting Access Token...');
    const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    try {
        const tokenResponse = await fetch(`${BASE_URL}/api/payment/vietqr/api/token_generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        });

        const tokenData = await tokenResponse.json();
        console.log('Response Status:', tokenResponse.status);
        console.log('Response Body:', tokenData);

        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('❌ Failed to get access token.');
            return;
        }

        const accessToken = tokenData.access_token;
        console.log('✅ Access Token retrieved successfully.\n');

        // 2. Simulate Transaction Sync
        console.log('2️⃣  Step 2: Simulating Transaction Sync (Webhook)...');

        // Payload with a dummy booking code to test structure
        // This makes sure we pass the initial checks up to the DB lookup
        const webhookPayload = {
            notificationType: "CREDIT",
            transactionid: `TEST_${Date.now()}`,
            amount: "100000",
            content: "NERD 20251225 999",
            transType: "C"
        };

        const syncResponse = await fetch(`${BASE_URL}/api/payment/vietqr/bank/api/transaction-sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(webhookPayload)
        });

        const syncData = await syncResponse.json();
        console.log('Response Status:', syncResponse.status);
        console.log('Response Body:', syncData);

        if (syncResponse.ok) {
            console.log('✅ Webhook call executed successfully.');
        } else {
            console.warn('⚠️ Webhook call returned an error (likely logic error like Booking Not Found).');
        }

    } catch (error) {
        console.error('❌ Error during test execution:', error.message);
        if (error.cause) console.error('Cause:', error.cause);
        console.log('Make sure the Next.js server is running on http://localhost:3000');
    }
}

testVietQR();
