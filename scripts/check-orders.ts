import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function checkOrders() {
  console.log('--- ĐANG TRUY VẤN DANH SÁCH ĐƠN ĐĂNG KÝ TRÊN WEB ---');
  try {
    const orders = await prisma.registrationOrder.findMany({
      select: {
        id: true,
        orderCode: true,
        fullName: true,
        phone: true,
        planType: true,
        orderStatus: true,
        amount: true,
        assignedCardNo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Tìm thấy tổng cộng ${orders.length} đơn đăng ký.`);
    for (const order of orders) {
      console.log(`- Mã: ${order.orderCode} | Tên: ${order.fullName} | Gói: ${order.planType} | Trạng thái: ${order.orderStatus} | Thẻ: ${order.assignedCardNo || 'Chưa gán'} | Ngày tạo: ${order.createdAt}`);
    }
  } catch (err) {
    console.error('Lỗi khi truy vấn:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrders();
