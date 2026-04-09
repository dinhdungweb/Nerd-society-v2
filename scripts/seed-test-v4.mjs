import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Đang tạo dữ liệu hôi viên mẫu...');

    try {
        const subscriber = await prisma.subscriber.upsert({
            where: { mytimeEmpId: 'NS010' },
            update: {},
            create: {
                fullName: 'Hội Viên Thử Nghiệm',
                phone: '0987654321',
                email: 'test@nerdsociety.vn',
                cardNo: '1234567890',
                mytimeEmpId: 'NS010',
                status: 'ACTIVE',
                walletBalance: 50000,
                outstandingBalance: 0
            }
        });

        console.log('✅ Đã tạo/cập nhật hội viên:', subscriber.fullName, `(Mã: ${subscriber.mytimeEmpId})`);
    } catch (e) {
        console.error('❌ Lỗi Seeding:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

seed();
