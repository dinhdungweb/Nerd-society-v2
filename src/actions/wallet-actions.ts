'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { paySubscriberDebtWithWallet } from '@/lib/wallet-ledger'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

export async function payOwnDebtWithWallet() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return { success: false as const, error: 'Vui lòng đăng nhập để thanh toán công nợ' }
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { userId: session.user.id },
    select: { id: true, outstandingBalance: true },
  })

  if (!subscriber) {
    return { success: false as const, error: 'Không tìm thấy thông tin Monthly Beaver' }
  }
  if (subscriber.outstandingBalance <= 0) {
    return { success: false as const, error: 'Bạn không có công nợ cần thanh toán' }
  }

  try {
    const result = await paySubscriberDebtWithWallet({
      subscriberId: subscriber.id,
      createdById: session.user.id,
      note: 'Khách tự thanh toán công nợ qua Ví Nerd',
    })

    revalidatePath('/profile/wallet')
    return {
      success: true as const,
      paidAmount: result.paidAmount,
      remainingDebt: result.remainingDebt,
      newWalletBalance: result.newWalletBalance,
    }
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Không thể thanh toán công nợ',
    }
  }
}
