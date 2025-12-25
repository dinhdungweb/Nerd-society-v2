const jwt = require('jsonwebtoken');
// Native fetch is available in Node 18+

// Config matches .env
const SECRET = 'nerd-secret-2024';
const URL = 'http://localhost:3000/api/payment/vietqr/bank/api/transaction-sync';

async function runbox() {
    console.log('1. Generating Valid Test Token...');
    const token = jwt.sign(
        { user: 'test-user', type: 'vietqr_webhook' },
        SECRET,
        { expiresIn: 300 }
    );
    console.log('   Token:', token);

    console.log('\n2. Sending Fake Webhook Transaction...');
    const payload = {
        notificationType: 'N05', // Balance fluctuation
        transactionid: 'TEST_TRANS_' + Date.now(),
        referencenumber: 'REF_' + Date.now(),
        amount: '10000',
        content: 'NERDTEST123', // Testing NO hyphen format
        transType: 'C', // Credit
        bankCode: 'TCB',
        transactionDate: new Date().toISOString()
    };

    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        let text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.log('Server returned non-JSON:', text.substring(0, 500));
            return;
        }

        console.log('\n3. Response from Server:');
        console.log('   Status:', res.status);
        console.log('   Body:', JSON.stringify(data, null, 2));

        if (res.status === 200 && data.code === '00') {
            console.log('\n✅ TEST PASSED: Webhook received and processed successfully!');
        } else {
            console.log('\n❌ TEST FAILED: Server returned error.');
        }

    } catch (err) {
        console.error('\n❌ connection Error:', err.message);
        console.log('Make sure your Next.js server is running on port 3000!');
    }
}

runbox();
