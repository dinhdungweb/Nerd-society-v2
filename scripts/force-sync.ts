import { pollAttendanceRecords } from '../src/lib/subscription/attendance-polling';
import { prisma } from '../src/lib/prisma';

async function forceSync() {
    console.log('--- ĐANG ÉP BUỘC ĐỒNG BỘ CHẤM CÔNG ---');
    console.log('Thời gian bắt đầu:', new Date().toLocaleString('vi-VN'));
    
    try {
        await pollAttendanceRecords();
        console.log('✅ Hoàn thành tiến trình quét dữ liệu.');
        
        // Kiểm tra xem record mới nhất đã vào DB chưa
        const latestLog = await prisma.subscriptionAuditLog.findFirst({
            where: { action: 'TAP_CARD' },
            orderBy: { createdAt: 'desc' }
        });
        
        if (latestLog) {
            console.log('Bản ghi quẹt thẻ mới nhất tìm thấy:', JSON.stringify(latestLog.details, null, 2));
        } else {
            console.log('Chưa tìm thấy bản ghi quẹt thẻ nào trong Database.');
        }
        
    } catch (error) {
        console.error('❌ Lỗi khi đồng bộ:', error);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

forceSync();
