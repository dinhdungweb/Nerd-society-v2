const dotenv = require('dotenv');
dotenv.config();

async function testFullResponse() {
    const username = process.env.VIETQR_SYSTEM_USERNAME;
    const password = process.env.VIETQR_SYSTEM_PASSWORD;
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');

    console.log("1. Token...");
    const r1 = await fetch('https://api.vietqr.org/vqr/api/token_generate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
        }
    });
    const d1 = await r1.json();
    const token = d1.access_token;

    console.log("2. Generate...");
    const r2 = await fetch('https://api.vietqr.org/vqr/api/qr/generate-customer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            bankCode: 'TCB',
            bankAccount: '19075232403013',
            userBankName: 'LE PHUONG UYEN',
            content: 'TEST LOGO',
            qrType: 0,
            amount: 10000,
            orderId: 'TEST123',
            transType: 'C'
        })
    });
    const d2 = await r2.json();
    console.log("Full Response Keys:", Object.keys(d2));
    console.log("Full Response:", JSON.stringify(d2, null, 2));
}

testFullResponse();
