const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
// Native fetch is available in Node 18+
// const fetch = require('node-fetch'); 

const prisma = new PrismaClient();

// Config
const SECRET = 'nerd-secret-2024';
const WEBHOOK_URL = 'http://localhost:3000/api/payment/vietqr/bank/api/transaction-sync';

async function runE2E() {
    console.log('🚀 Starting VietQR E2E Auto-Confirmation Test...');

    // 1. Create a Fake Booking
    const bookingCode = 'NERD-E2E-' + Date.now();
    console.log(`\n1. Creating Pending Booking: ${bookingCode}`);

    // Create a dummy user first if needed, or link to existing. 
    // To be safe, let's create a user or pick one. For simplicity, we create a booking without linking strictly if schema allows, 
    // BUT schema likely requires User/Room.
    // Let's try to find a room first.
    const room = await prisma.room.findFirst();
    if (!room) {
        console.error('❌ No rooms found in DB. Cannot create booking.');
        return;
    }
    const user = await prisma.user.findFirst();
    if (!user) {
        console.error('❌ No users found in DB. Cannot create booking.');
        return;
    }

    const booking = await prisma.booking.create({
        data: {
            userId: user.id,
            roomId: room.id,
            locationId: room.locationId,
            date: new Date(),
            startTime: '10:00',
            endTime: '12:00',
            estimatedAmount: 50000,
            depositAmount: 10000,
            status: 'PENDING',
            bookingCode: bookingCode,
            customerName: 'E2E Tester',
            customerPhone: '0123456789',
            depositStatus: 'PENDING'
        }
    });
    console.log('   ✅ Booking Created! ID:', booking.id);

    // 2. Generate Token
    const token = jwt.sign({ user: 'tester', type: 'vietqr_webhook' }, SECRET, { expiresIn: 60 });

    // 3. Send Webhook
    console.log('\n2. Sending Webhook with content:', bookingCode);
    const payload = {
        notificationType: 'N05',
        transactionid: 'TRANS_' + Date.now(),
        amount: '10000',
        content: `Transfer for ${bookingCode}`, // Test flexible regex
        transType: 'C',
        bankCode: 'TCB'
    };

    // Use native fetch if node-fetch missing (Node 18+)
    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
    });
    const resData = await response.json();
    console.log('   Webhook Response:', resData);

    // 4. Verify DB Status
    console.log('\n3. Verifying Database Status...');
    const updatedBooking = await prisma.booking.findUnique({ where: { id: booking.id } });

    if (updatedBooking.status === 'CONFIRMED' && updatedBooking.depositPaidAt) {
        console.log('   ✅ SUCCESS: Booking status changed to CONFIRMED!');
        console.log('   ✅ Payment Time:', updatedBooking.depositPaidAt);
    } else {
        console.log('   ❌ FAILED: Booking is still', updatedBooking.status);
    }
}

runE2E()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
