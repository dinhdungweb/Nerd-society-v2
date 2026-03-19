// Configuration from local .env
require('dotenv').config();

const IS_PROD = process.argv.includes('--prod');

// Credentials (Try .env first, then fallback)
const VIETQR_SYSTEM_USERNAME = process.env.VIETQR_SYSTEM_USERNAME || "customer-nerd-user25466";
const VIETQR_SYSTEM_PASSWORD = process.env.VIETQR_SYSTEM_PASSWORD || "Y3VzdG9tZXItbmVyZC11c2VyMjU0NjY=";

// VietQR API Endpoints
const API_BASE = IS_PROD ? "https://api.vietqr.org" : "https://dev.vietqr.org";
const VQR_TOKEN_URL = `${API_BASE}/vqr/api/token_generate`;
const VQR_CALLBACK_TRIGGER_URL = `${API_BASE}/vqr/bank/api/test/transaction-callback`;

// Your System Info
const MY_BANK_CODE = process.env.VIETQR_BANK_CODE || "TECHCOMBANK";
const MY_BANK_ACCOUNT = process.env.VIETQR_ACCOUNT_NUMBER || "19075232403013";

async function triggerVietQRTest() {
    console.log(`🚀 Starting VietQR Test Callback Trigger [Mode: ${IS_PROD ? 'PROD' : 'DEV'}]...\n`);

    // 1. Get Token from VietQR System
    console.log(`1️⃣  Step 1: Authenticating with VietQR ${IS_PROD ? 'Production' : 'Dev'} System...`);

    const credentials = Buffer.from(`${VIETQR_SYSTEM_USERNAME}:${VIETQR_SYSTEM_PASSWORD}`).toString('base64');

    try {
        const tokenResponse = await fetch(VQR_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`
            }
        });

        const tokenData = await tokenResponse.json();
        
        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('❌ Failed to get access token from VietQR.');
            console.error('Response Status:', tokenResponse.status);
            console.error('Response Body:', tokenData);
            return;
        }

        const accessToken = tokenData.access_token;
        console.log('✅ Got VietQR System Token retrieved successfully.\n');

        // 2. Trigger the Test Callback
        console.log('2️⃣  Step 2: Requesting Test Callback (Simulating payment)...');

        // Note: You should check your DB for a PENDING booking code to test realistically
        const testBookingCode = "NERD 20251226 001"; 

        const payload = {
            bankAccount: MY_BANK_ACCOUNT,
            bankCode: MY_BANK_CODE,
            amount: "10000",
            content: `VQR${Math.random().toString(16).slice(2, 10)} ${testBookingCode}`, 
            transType: "C"
        };

        console.log('Sending Payload to VietQR Test API:', payload);

        const triggerResponse = await fetch(VQR_CALLBACK_TRIGGER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        const triggerData = await triggerResponse.json();
        console.log('Response Status:', triggerResponse.status);
        console.log('Response Body:', triggerData);

        if (triggerResponse.ok && (triggerData.status === 'SUCCESS' || triggerData.error === false)) {
            console.log('\n✅ Call Success! VietQR System is now sending the webhook to your VPS.');
            console.log(`👉 Destination: ${process.env.NEXT_PUBLIC_SITE_URL || 'Your Configured Site URL'}`);
            console.log('👉 Check your VPS logs (pm2 logs) to see the incoming sync request.');
        } else {
            console.warn('\n⚠️ Call Failed or returned error status.');
        }

    } catch (error) {
        console.error('❌ Error execution:', error);
    }
}

triggerVietQRTest();
