'use server';

/**
 * Server Actions cho hệ thống Subscription
 */

import { prisma } from '@/lib/prisma';
import { importEmployee, generateNextEmployeeId } from '@/lib/mytime-api';
import { revalidatePath } from 'next/cache';

// ============= REGISTRATION (Khách đăng ký online) =============

const PLAN_PRICES: Record<string, number> = {
  WEEKLY_LIMITED: 199000,
  MONTHLY_LIMITED: 549000,
  MONTHLY_UNLIMITED: 1199000,
};

const PLAN_HOURS_MIN: Record<string, number> = {
  WEEKLY_LIMITED: 15 * 60,
  MONTHLY_LIMITED: 50 * 60,
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
  return `NP-${dateStr}-${String(count + 1).padStart(3, '0')}`;
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

  return { 
    success: true, 
    order, 
    qrUrl,
    bankInfo: bankConfig
  };
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
      dailyLimitMin: order.planType === 'MONTHLY_UNLIMITED' ? 480 : null,
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
      accId: empId,
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
  await prisma.registrationOrder.update({
    where: { id: orderId },
    data: { orderStatus: 'CANCELLED' },
  });

  await prisma.subscriptionAuditLog.create({
    data: {
      action: 'order_cancelled',
      entityType: 'registration_order',
      entityId: orderId,
      performedBy: 'admin',
      details: { reason },
    },
  });

  revalidatePath('/admin/subscriptions');
  return { success: true };
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
    ];
  }

  return prisma.subscriber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

/**
 * Lấy danh sách sessions đang mở (đang ngồi)
 */
export async function getActiveSessions(branch?: string) {
  const where: Record<string, unknown> = { checkOutTime: null };
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
