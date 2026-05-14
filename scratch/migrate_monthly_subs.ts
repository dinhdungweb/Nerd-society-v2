import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Bắt đầu cập nhật dữ liệu Subscriber gói tháng...')

  // Cập nhật tất cả các Subscription đang ACTIVE hoặc PENDING của gói tháng
  const result = await prisma.subscription.updateMany({
    where: {
      planType: {
        in: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED']
      }
    },
    data: {
      totalHoursMin: null,   // Đặt về null để giao diện hiểu là không dùng giới hạn tổng
      dailyLimitMin: 480,    // Đặt 8 tiếng mỗi ngày
    }
  })

  console.log(`✅ Đã cập nhật xong ${result.count} bản ghi.`)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi cập nhật:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
