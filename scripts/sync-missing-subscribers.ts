import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { importEmployee } from '../src/lib/mytime-api';

async function syncAllSubscribersToMytime() {
  console.log('=== BẮT ĐẦU ĐỒNG BỘ BÙ HỘI VIÊN SANG MYTIME PC ===');
  
  try {
    // 1. Lấy tất cả hội viên đã gán thẻ từ DB
    const subscribers = await prisma.subscriber.findMany({
      where: {
        mytimeEmpId: { not: null },
        cardNo: { not: null }
      },
      include: {
        user: {
          select: {
            dateOfBirth: true,
            gender: true
          }
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (subscribers.length === 0) {
      console.log('ℹ Không có hội viên nào đã gán thẻ trong DB cần đồng bộ.');
      return;
    }

    console.log(`Tìm thấy ${subscribers.length} hội viên cần kiểm tra/đồng bộ.`);

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscribers) {
      console.log(`\n🔄 Đang đồng bộ hội viên: ${sub.fullName} (Mã: ${sub.mytimeEmpId}, Thẻ: ${sub.cardNo})...`);
      
      const planType = sub.subscriptions[0]?.planType || 'WEEKLY_LIMITED';
      
      try {
        const response = await importEmployee({
          employeeId: sub.mytimeEmpId!,
          fullName: sub.fullName,
          planType,
          accId: sub.mytimeEmpId!.replace('NS', ''),
          cardNo: sub.cardNo!,
          birthday: sub.user?.dateOfBirth || undefined,
          gender: (sub.user?.gender?.toLowerCase() === 'male' || sub.user?.gender?.toLowerCase() === 'nam') ? 'male' : 
                  (sub.user?.gender?.toLowerCase() === 'female' || sub.user?.gender?.toLowerCase() === 'nữ') ? 'female' : undefined,
          branch: sub.branchPrimary || 'HTM',
        });

        if (response.result === 'success') {
          console.log(`✅ Đồng bộ thành công hội viên ${sub.fullName}!`);
          successCount++;
        } else {
          console.error(`❌ Đồng bộ thất bại cho ${sub.fullName}:`, response.reason);
          failCount++;
        }
      } catch (err) {
        console.error(`❌ Lỗi hệ thống khi đồng bộ ${sub.fullName}:`, err);
        failCount++;
      }
    }

    console.log(`\n=== KẾT QUẢ ĐỒNG BỘ ===`);
    console.log(`- Tổng số hội viên: ${subscribers.length}`);
    console.log(`- Đồng bộ thành công: ${successCount}`);
    console.log(`- Thất bại/Lỗi: ${failCount}`);

  } catch (err) {
    console.error('❌ Lỗi không xác định trong quá trình đồng bộ:', err);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

syncAllSubscribersToMytime();
