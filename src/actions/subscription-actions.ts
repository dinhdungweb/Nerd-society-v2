'use server';

/**
 * Server Actions cho hệ thống Subscription
 */

import { prisma } from '@/lib/prisma';
import { importEmployee, deleteEmployee, generateNextEmployeeId } from '@/lib/mytime-api';
import { revalidatePath } from 'next/cache';
import { ensureUserWalletAccount } from '@/lib/wallet-account';
import { applyWalletTransactionInTx, refundRegistrationOrderToWallet } from '@/lib/wallet-ledger';
import { authOptions } from '@/lib/auth';
import { businessDateOnly } from '@/lib/subscription/date-utils';
import { getServerSession } from 'next-auth';
import {
  sendAdminNewSubscriptionOrderEmail,
  sendSubscriptionOrderEmail,
  sendSubscriptionPaidEmail,
} from '@/lib/email';

// ============= REGISTRATION (Khách đăng ký online) =============

const PLAN_PRICES: Record<string, number> = {
  WEEKLY_LIMITED: 199000,
  MONTHLY_LIMITED: 549000,
  MONTHLY_UNLIMITED: 1199000,
};

const PLAN_HOURS_MIN: Record<string, number> = {
  WEEKLY_LIMITED: 15 * 60,
  MONTHLY_LIMITED: 0, // Không giới hạn tổng giờ/tháng, chỉ có daily cap 8h
  MONTHLY_UNLIMITED: 0,
};

/**
 * Tạo mã đơn hàng: NERD-YYYYMMDD-XXX
 */
async function generateOrderCode(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
  const count = await prisma.registrationOrder.count({
    where: {
      createdAt: {
        gte: new Date(today.toISOString().split('T')[0]),
      },
    },
  });
  return `MB-${dateStr}-${String(count + 1).padStart(3, '0')}`;
}

import { generateOfficialQR, getVietQRConfig } from '@/lib/vietqr';

/**
 * Bước 1: Khách submit đăng ký online
 */
export async function createRegistrationOrder(data: {
  fullName: string;
  phone: string;
  email?: string;
  branchPrimary: string;
  planType: 'WEEKLY_LIMITED' | 'MONTHLY_LIMITED' | 'MONTHLY_UNLIMITED';
  selfieUrl: string;
  paymentMethod: string;
  userId?: string;
}) {
  // Validate
  if (!data.fullName || !data.phone || !data.planType || !data.selfieUrl) {
    return { success: false, error: 'Thiếu thông tin bắt buộc' };
  }

  const amount = PLAN_PRICES[data.planType];
  if (!amount) return { success: false, error: 'Gói không hợp lệ' };

  const orderCode = await generateOrderCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const order = await prisma.registrationOrder.create({
    data: {
      orderCode,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      branchPrimary: data.branchPrimary,
      planType: data.planType as 'WEEKLY_LIMITED' | 'MONTHLY_LIMITED' | 'MONTHLY_UNLIMITED',
      selfieUrl: data.selfieUrl,
      amount,
      paymentMethod: data.paymentMethod,
      orderStatus: 'PENDING_PAYMENT',
      expiresAt,
      userId: data.userId,
    },
  });

  // Tạo mã QR từ API chính thức để hỗ trợ xác nhận tự động
  let qrUrl = '';
  const bankConfig = getVietQRConfig();
  
  if (data.paymentMethod === 'online') {
    try {
      qrUrl = await generateOfficialQR({
        amount,
        description: orderCode,
      });
    } catch (error) {
      console.error('[createRegistrationOrder] QR Error:', error);
      // Fallback link if API fails
      qrUrl = `https://img.vietqr.io/image/${bankConfig.bankCode}-${bankConfig.accountNumber}-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=${encodeURIComponent(bankConfig.accountName)}`;
    }
  }

  Promise.all([
    sendSubscriptionOrderEmail(order),
    sendAdminNewSubscriptionOrderEmail(order),
  ]).catch((error) => {
    console.error('[createRegistrationOrder] Email error:', error);
  });

  return { 
    success: true, 
    order, 
    qrUrl,
    bankInfo: bankConfig
  };
}

export async function payRegistrationOrderWithWallet(orderId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Vui lòng đăng nhập để thanh toán bằng Ví Nerd' };
  }

  const [order, user] = await Promise.all([
    prisma.registrationOrder.findUnique({ where: { id: orderId } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, phone: true },
    }),
  ]);

  if (!order || !user) return { success: false, error: 'Không tìm thấy đơn đăng ký' };
  if (order.orderStatus === 'CANCELLED') return { success: false, error: 'Đơn đăng ký đã bị hủy' };

  const canPayOrder =
    order.userId === user.id ||
    (!order.userId && (
      (!!order.email && order.email.toLowerCase() === user.email.toLowerCase()) ||
      (!!user.phone && order.phone === user.phone)
    ));

  if (!canPayOrder) {
    return { success: false, error: 'Bạn không có quyền thanh toán đơn đăng ký này' };
  }

  if (order.orderStatus === 'PAID') {
    const walletAccount = await ensureUserWalletAccount(user.id);
    return {
      success: true,
      order,
      currentBalance: walletAccount.success ? walletAccount.wallet.balance : undefined,
      message: 'Đơn đăng ký đã được thanh toán',
    };
  }

  if (order.orderStatus !== 'PENDING_PAYMENT') {
    return { success: false, error: 'Không thể thanh toán đơn đăng ký ở trạng thái hiện tại' };
  }

  const amount = Math.round(order.amount || 0);
  if (amount <= 0) return { success: false, error: 'Số tiền thanh toán không hợp lệ' };

  const walletAccount = await ensureUserWalletAccount(user.id);
  if (!walletAccount.success) {
    return { success: false, error: walletAccount.message };
  }

  if (walletAccount.wallet.balance < amount) {
    return {
      success: false,
      error: `Số dư Ví Nerd không đủ. Cần ${amount.toLocaleString()}đ, hiện có ${walletAccount.wallet.balance.toLocaleString()}đ.`,
      currentBalance: walletAccount.wallet.balance,
    };
  }

  const paidAt = new Date();
  const externalTransactionId = `WALLET-MB-${order.id}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const freshOrder = await tx.registrationOrder.findUnique({
        where: { id: order.id },
      });

      if (!freshOrder) throw new Error('Không tìm thấy đơn đăng ký');
      if (freshOrder.orderStatus === 'PAID') {
        const existing = await tx.walletTransaction.findUnique({
          where: { externalTransactionId },
        });
        return {
          order: freshOrder,
          walletTransaction: existing,
          currentBalance: walletAccount.wallet.balance,
        };
      }
      if (freshOrder.orderStatus !== 'PENDING_PAYMENT') {
        throw new Error('Không thể thanh toán đơn đăng ký ở trạng thái hiện tại');
      }

      const walletResult = await applyWalletTransactionInTx(tx, {
        walletId: walletAccount.wallet.id,
        type: 'SUBSCRIPTION_PURCHASE',
        amount: -amount,
        source: 'MONTHLY_BEAVER',
        referenceType: 'registration_order',
        referenceId: freshOrder.id,
        externalTransactionId,
        description: `Thanh toán gói Monthly Beaver ${freshOrder.orderCode}`,
      });

      const updatedOrder = await tx.registrationOrder.update({
        where: { id: freshOrder.id },
        data: {
          orderStatus: 'PAID',
          paidAt,
          paymentMethod: 'wallet',
          paymentRef: walletResult.transaction.id,
          userId: freshOrder.userId || user.id,
        },
      });

      await tx.subscriptionAuditLog.create({
        data: {
          action: 'payment_confirmed_wallet',
          entityType: 'registration_order',
          entityId: freshOrder.id,
          performedBy: 'customer',
          details: {
            orderCode: freshOrder.orderCode,
            walletTransactionId: walletResult.transaction.id,
            amount,
          },
        },
      });

      return {
        order: updatedOrder,
        walletTransaction: walletResult.transaction,
        currentBalance: walletResult.balanceAfter,
      };
    });

    try {
      await sendSubscriptionPaidEmail(result.order);
    } catch (emailError) {
      console.error('[payRegistrationOrderWithWallet] Subscription email error:', emailError);
    }

    revalidatePath('/profile/wallet');
    revalidatePath('/profile/monthly-beaver');
    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin/wallets');

    return {
      success: true,
      order: result.order,
      currentBalance: result.currentBalance,
      walletTransaction: result.walletTransaction,
      message: 'Thanh toán bằng Ví Nerd thành công',
    };
  } catch (error: any) {
    console.error('[payRegistrationOrderWithWallet] Error:', error);
    return { success: false, error: error.message || 'Không thể thanh toán bằng Ví Nerd' };
  }
}

/**
 * Admin: Xác nhận thanh toán đơn
 */
export async function confirmPayment(orderId: string, paymentRef?: string) {
  const order = await prisma.registrationOrder.update({
    where: { id: orderId },
    data: {
      orderStatus: 'PAID',
      paidAt: new Date(),
      paymentRef,
    },
  });

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'payment_confirmed',
      entityType: 'registration_order',
      entityId: orderId,
      performedBy: 'admin',
      details: { paymentRef, orderCode: order.orderCode },
    },
  });

  try {
    await sendSubscriptionPaidEmail(order);
  } catch (emailError) {
    console.error('[confirmPayment] Subscription email error:', emailError);
  }

  revalidatePath('/admin/subscriptions');
  return { success: true, order };
}

/**
 * Admin: Gán thẻ + Tạo subscriber + subscription
 */
export async function assignCardAndCreate(orderId: string, cardNo: string, staffName: string) {
  const order = await prisma.registrationOrder.findUnique({ where: { id: orderId } });
  if (!order) return { success: false, error: 'Đơn không tồn tại' };
  if (order.orderStatus !== 'PAID') return { success: false, error: 'Đơn chưa thanh toán' };

  // Kiểm tra thẻ đã được dùng chưa
  const existingCard = await prisma.subscriber.findFirst({ where: { cardNo } });
  if (existingCard) return { success: false, error: 'Thẻ này đã được gán cho người khác' };

  // Tạo MyTime employee ID
  const empId = await generateNextEmployeeId(prisma);

  // Tìm hoặc tạo subscriber
  let subscriber = await prisma.subscriber.findFirst({ where: { phone: order.phone } });
  if (!subscriber) {
    subscriber = await prisma.subscriber.create({
      data: {
        fullName: order.fullName,
        phone: order.phone,
        email: order.email,
        photoUrl: order.selfieUrl,
        cardNo,
        mytimeEmpId: empId,
        branchPrimary: order.branchPrimary,
        userId: order.userId,
      },
    });
  } else {
    subscriber = await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        cardNo,
        mytimeEmpId: empId,
        photoUrl: order.selfieUrl,
        userId: order.userId,
      },
    });
  }

  // Tạo subscription (pending_activation)
  if (order.userId) {
    await ensureUserWalletAccount(order.userId);
  }

  const totalMin = PLAN_HOURS_MIN[order.planType] || 0;
  const activationDeadline = new Date();
  activationDeadline.setDate(activationDeadline.getDate() + 30);

  const subscription = await prisma.subscription.create({
    data: {
      subscriberId: subscriber.id,
      planType: order.planType,
      pricePaid: order.amount,
      status: 'PENDING_ACTIVATION',
      totalHoursMin: totalMin > 0 ? totalMin : null,
      dailyLimitMin: (order.planType === 'MONTHLY_LIMITED' || order.planType === 'MONTHLY_UNLIMITED') ? 480 : null, // Daily cap 8h
      paymentMethod: order.paymentMethod,
      paymentRef: order.paymentRef,
      cardAssigned: cardNo,
      cardAssignedAt: new Date(),
      activationDeadline,
    },
  });

  // Truy vấn thông tin bổ sung từ User (nếu có) để đồng bộ đầy đủ sang MyTime
  const linkedUser = order.userId ? await prisma.user.findUnique({
    where: { id: order.userId },
    select: { dateOfBirth: true, gender: true }
  }) : null;

  // Gọi MyTime API tạo employee
  try {
    await importEmployee({
      employeeId: empId,
      fullName: order.fullName,
      planType: order.planType,
      accId: empId.replace('NS', ''),
      cardNo,
      birthday: linkedUser?.dateOfBirth || undefined,
      gender: (linkedUser?.gender?.toLowerCase() === 'male' || linkedUser?.gender?.toLowerCase() === 'nam') ? 'male' : 
              (linkedUser?.gender?.toLowerCase() === 'female' || linkedUser?.gender?.toLowerCase() === 'nữ') ? 'female' : undefined,
      branch: order.branchPrimary, // Đồng bộ vào đúng máy theo chi nhánh
    });
  } catch (err) {
    console.error('MyTime API error (non-fatal):', err);
    // Non-fatal: vẫn tạo subscriber, khi nào connect lại thì sync
  }

  // Cập nhật order
  await prisma.registrationOrder.update({
    where: { id: orderId },
    data: {
      orderStatus: 'CARD_ASSIGNED',
      assignedCardNo: cardNo,
      assignedBy: staffName,
      assignedAt: new Date(),
      subscriberId: subscriber.id,
      subscriptionId: subscription.id,
    },
  });

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'card_assigned',
      entityType: 'registration_order',
      entityId: orderId,
      performedBy: staffName,
      details: { cardNo, empId, subscriberName: order.fullName },
    },
  });

  revalidatePath('/admin/subscriptions');
  return { success: true, subscriber, subscription };
}

/**
 * Admin: Hủy đơn
 */
export async function cancelOrder(orderId: string, reason?: string) {
  const order = await prisma.registrationOrder.update({
    where: { id: orderId },
    data: { orderStatus: 'CANCELLED' },
  });

  let refundResult = null;
  try {
    refundResult = await refundRegistrationOrderToWallet({
      orderId,
      note: reason || `Hủy đơn ${order.orderCode}`,
    });
  } catch (error) {
    console.error('[cancelOrder] Refund failed:', error);
  }

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'order_cancelled',
      entityType: 'registration_order',
      entityId: orderId,
      performedBy: 'admin',
      details: { reason, refund: refundResult },
    },
  });

  revalidatePath('/admin/subscriptions');
  return { success: true, refund: refundResult };
}

// ============= QUERY HELPERS =============

/**
 * Lấy danh sách đơn đăng ký
 */
export async function getRegistrationOrders(filters?: {
  id?: string;
  status?: string;
  branch?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.id) where.id = filters.id;
  if (filters?.status) where.orderStatus = filters.status;
  if (filters?.branch) where.branchPrimary = filters.branch;

  return prisma.registrationOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      subscriber: true,
      subscription: true,
    },
  });
}

/**
 * Lấy danh sách subscribers
 */
export async function getSubscribers(filters?: {
  status?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { mytimeEmpId: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const today = businessDateOnly();

  const subscribers = await prisma.subscriber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          wallet: {
            select: {
              balance: true,
              walletCode: true,
            },
          },
        },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          dailyUsages: {
            where: {
              usageDate: today
            }
          }
        }
      },
    },
  });

  return subscribers.map((subscriber) => {
    const currentSub = subscriber.subscriptions[0];
    const todayUsage = currentSub?.dailyUsages?.[0]?.totalMin || 0;

    return {
      ...subscriber,
      walletBalance: subscriber.user?.wallet?.balance || 0,
      walletCode: subscriber.user?.wallet?.walletCode || subscriber.walletCode,
      todayUsedMin: todayUsage,
    };
  });
}

/**
 * Lấy danh sách sessions đang mở (đang ngồi)
 */
export async function getActiveSessions(branch?: string) {
  const where: Record<string, unknown> = { checkOutTime: null, status: 'ACTIVE' };
  if (branch) where.branch = branch;

  return prisma.subscriptionSession.findMany({
    where,
    orderBy: { checkInTime: 'desc' },
    include: {
      subscriber: true,
      subscription: true,
    },
  });
}

/**
 * Báo cáo tháng
 */
export async function getMonthlyReport(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const [activeSubs, newOrders, revenue, sessions] = await Promise.all([
    // Active subscriptions
    prisma.subscription.count({
      where: { status: 'ACTIVE' },
    }),
    // New orders
    prisma.registrationOrder.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        orderStatus: { in: ['PAID', 'CARD_ASSIGNED', 'ACTIVATED'] },
      },
    }),
    // Revenue
    prisma.subscription.aggregate({
      _sum: { pricePaid: true },
      where: {
        purchasedAt: { gte: startDate, lte: endDate },
        status: { not: 'CANCELLED' },
      },
    }),
    // Sessions
    prisma.subscriptionSession.count({
      where: {
        checkInTime: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  // Count by plan type
  const byPlan = await prisma.subscription.groupBy({
    by: ['planType'],
    where: { status: 'ACTIVE' },
    _count: true,
  });

  return {
    activeSubs,
    newOrders,
    totalRevenue: revenue._sum.pricePaid || 0,
    totalSessions: sessions,
    byPlan: byPlan.map(p => ({ plan: p.planType, count: p._count })),
  };
}

/**
 * Admin: Xóa hội viên và các dữ liệu liên quan
 */
export async function deleteSubscriber(id: string) {
  try {
    const sub = await prisma.subscriber.findUnique({
      where: { id },
      include: {
        subscriptions: true,
      }
    });

    if (!sub) return { success: false, error: 'Hội viên không tồn tại' };

    // Thực hiện xóa theo transaction để đảm bảo toàn vẹn dữ liệu
    await prisma.$transaction([
      prisma.registrationOrder.deleteMany({ where: { subscriberId: id } }),
      prisma.subscriptionSession.deleteMany({ where: { subscriberId: id } }),
      prisma.dailyUsage.deleteMany({ where: { subscriberId: id } }),
      prisma.subscription.deleteMany({ where: { subscriberId: id } }),
      prisma.transaction.deleteMany({ where: { subscriberId: id } }),
      prisma.quickCall.deleteMany({ where: { subscriberId: id } }),
      prisma.subscriber.delete({ where: { id } }),
    ]);

    // Đồng bộ xóa trên MyTime (không chặn nếu MyTime lỗi)
    if (sub.mytimeEmpId) {
      try {
        await deleteEmployee(sub.mytimeEmpId);
      } catch (err) {
        console.error('[deleteSubscriber] MyTime Sync Error:', err);
      }
    }

    revalidatePath('/admin/subscriptions');
    return { success: true };
  } catch (err) {
    console.error('[deleteSubscriber] Error:', err);
    return { success: false, error: 'Không thể xóa hội viên. Có lỗi xảy ra.' };
  }
}

/**
 * Admin: Gán lại thẻ (đổi thẻ mới) cho hội viên hiện tại
 */
export async function reassignSubscriberCard(subscriberId: string, newCardNo: string, staffName: string) {
  try {
    // 1. Kiểm tra hội viên tồn tại
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: subscriberId },
      include: {
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        user: {
          select: {
            dateOfBirth: true,
            gender: true
          }
        }
      }
    });

    if (!subscriber) return { success: false, error: 'Hội viên không tồn tại' };

    // 2. Kiểm tra xem thẻ mới đã có người khác sử dụng chưa
    const existingCard = await prisma.subscriber.findFirst({
      where: {
        cardNo: newCardNo,
        id: { not: subscriberId }
      }
    });
    if (existingCard) return { success: false, error: 'Thẻ này đã được gán cho hội viên khác' };

    const oldCardNo = subscriber.cardNo;

    // 3. Cập nhật thẻ mới cho hội viên và subscription đang hoạt động
    await prisma.$transaction(async (tx) => {
      await tx.subscriber.update({
        where: { id: subscriberId },
        data: { cardNo: newCardNo }
      });

      if (subscriber.subscriptions.length > 0) {
        await tx.subscription.update({
          where: { id: subscriber.subscriptions[0].id },
          data: { cardAssigned: newCardNo }
        });
      }

      await tx.subscriptionAuditLog.create({
        data: {
          action: 'card_reassigned',
          entityType: 'subscriber',
          entityId: subscriberId,
          performedBy: staffName,
          details: { oldCardNo, newCardNo, subscriberName: subscriber.fullName, empId: subscriber.mytimeEmpId }
        }
      });
    });

    // 4. Đồng bộ đổi thẻ sang MyTime PC app
    if (subscriber.mytimeEmpId) {
      const planType = subscriber.subscriptions[0]?.planType || 'WEEKLY_LIMITED';
      try {
        await importEmployee({
          employeeId: subscriber.mytimeEmpId,
          fullName: subscriber.fullName,
          planType,
          accId: subscriber.mytimeEmpId.replace('NS', ''),
          cardNo: newCardNo,
          birthday: subscriber.user?.dateOfBirth || undefined,
          gender: (subscriber.user?.gender?.toLowerCase() === 'male' || subscriber.user?.gender?.toLowerCase() === 'nam') ? 'male' : 
                  (subscriber.user?.gender?.toLowerCase() === 'female' || subscriber.user?.gender?.toLowerCase() === 'nữ') ? 'female' : undefined,
          branch: subscriber.branchPrimary || 'HTM',
        });
      } catch (err) {
        console.error('[reassignSubscriberCard] MyTime Sync Error (non-fatal):', err);
        // Non-fatal: PostgreSQL đã lưu thẻ mới, chạy sync sau
      }
    }

    revalidatePath('/admin/subscriptions');
    return { success: true };
  } catch (err) {
    console.error('[reassignSubscriberCard] Error:', err);
    return { success: false, error: 'Không thể gán lại thẻ. Có lỗi xảy ra.' };
  }
}

