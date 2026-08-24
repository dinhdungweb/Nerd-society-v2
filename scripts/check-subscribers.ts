import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function checkSubscribers() {
  console.log('--- ĐANG TRUY VẤN DANH SÁCH HỘI VIÊN TRÊN WEB ---');
  try {
    const subscribers = await prisma.subscriber.findMany({
      select: {
        id: true,
        fullName: true,
        phone: true,
        branchPrimary: true,
        status: true,
        qrCredential: { select: { status: true, version: true } },
        createdAt: true,
        subscriptions: {
          select: {
            planType: true,
            status: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Tìm thấy tổng cộng ${subscribers.length} hội viên.`);
    for (const sub of subscribers) {
      console.log(`- Tên: ${sub.fullName} | SĐT: ${sub.phone} | QR: ${sub.qrCredential ? `${sub.qrCredential.status} v${sub.qrCredential.version}` : 'Chưa cấp'} | Chi nhánh: ${sub.branchPrimary || 'Chưa chọn'} | Trạng thái: ${sub.status}`);
      if (sub.subscriptions.length > 0) {
        console.log(`  Gói đăng ký: ${sub.subscriptions.map(s => `${s.planType} (${s.status})`).join(', ')}`);
      } else {
        console.log(`  Chưa đăng ký gói nào.`);
      }
    }
  } catch (err) {
    console.error('Lỗi khi truy vấn:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubscribers();
