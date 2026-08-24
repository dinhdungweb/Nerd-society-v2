'use server';

/**
 * Server Actions cho hệ thống Subscription
 */

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ensureUserWalletAccount } from '@/lib/wallet-account';
import { applyWalletTransactionInTx, refundRegistrationOrderToWallet } from '@/lib/wallet-ledger';
import { authOptions } from '@/lib/auth';
import { businessDateOnly } from '@/lib/subscription/date-utils';
import { getRenewalEligibility, RENEWAL_WINDOW_DAYS } from '@/lib/subscription/renewal-policy';
import { buildMembershipQrPayload, ensureMembershipQrCredential } from '@/lib/subscription/qr-credential';
import { getServerSession } from 'next-auth';
import { randomUUID } from 'crypto';
import {
  sendAdminNewSubscriptionOrderEmail,
  sendSubscriptionOrderEmail,
  sendSubscriptionPaidEmail,
} from '@/lib/email';
import { isMonthlyBeaverRegistrationOpen } from '@/lib/monthly-beaver-registration';

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

const PLAN_DURATION_DAYS: Record<string, number> = {
  WEEKLY_LIMITED: 7,
  MONTHLY_LIMITED: 30,
  MONTHLY_UNLIMITED: 30,
};

function normalizePhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') || '';
  return digits.startsWith('84') && digits.length > 9 ? `0${digits.slice(2)}` : digits;
}
function contactMatches(
  order: { phone: string; email?: string | null },
  user: { phone?: string | null; email?: string | null } | null | undefined
) {
  if (!user) return false;

  const phoneMatches =
    !!normalizePhone(order.phone) && normalizePhone(order.phone) === normalizePhone(user.phone);
  const emailMatches =
    !!order.email && !!user.email && order.email.trim().toLowerCase() === user.email.trim().toLowerCase();

  return phoneMatches || emailMatches;
}

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
  if (!(await isMonthlyBeaverRegistrationOpen())) {
    return {
      success: false,
      error: 'Monthly Beaver đang tạm ngừng nhận đăng ký mới. Vui lòng quay lại sau.',
    };
  }

  // Validate
  if (!data.fullName || !data.phone || !data.planType || !data.selfieUrl) {
    return { success: false, error: 'Thiếu thông tin bắt buộc' };
  }

  const amount = PLAN_PRICES[data.planType];
  if (!amount) return { success: false, error: 'Gói không hợp lệ' };

  // Never trust a userId supplied by the browser. In particular, an admin can
  // be logged in while filling this public form on behalf of another customer.
  // Only link the order when its contact details belong to the signed-in user.
  const session = await getServerSession(authOptions);
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, phone: true, email: true },
      })
    : null;
  const linkedUserId = signedInUser && contactMatches(data, signedInUser) ? signedInUser.id : null;

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
      userId: linkedUserId,
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
        isRenewal: !!freshOrder.subscriberId,
      };
    });

    if (result.isRenewal) {
      await prisma.$transaction(async (tx) => {
        await processRenewalSubscription(tx, result.order.id, result.walletTransaction?.id || null);
      });
      if (result.order.subscriberId) await ensureMembershipQrCredential(result.order.subscriberId);
    }

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

  if (order.subscriberId) {
    await prisma.$transaction(async (tx) => {
      await processRenewalSubscription(tx, order.id, paymentRef || null);
    });
    await ensureMembershipQrCredential(order.subscriberId);
  }

  try {
    await sendSubscriptionPaidEmail(order);
  } catch (emailError) {
    console.error('[confirmPayment] Subscription email error:', emailError);
  }

  revalidatePath('/admin/subscriptions');
  return { success: true, order };
}

/**
 * Admin: Hủy đơn đăng ký.
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

// ============= RENEWAL HELPERS =============

/**
 * Xử lý tự động tạo Subscription cho đơn gia hạn (nội bộ)
 */
async function processRenewalSubscription(tx: any, orderId: string, paymentRef: string | null) {
  const order = await tx.registrationOrder.findUnique({ where: { id: orderId } });
  if (!order || !order.subscriberId || order.orderStatus !== 'PAID') return null;

  const subscriber = await tx.subscriber.findUnique({ where: { id: order.subscriberId } });
  if (!subscriber) return null;

  const totalMin = PLAN_HOURS_MIN[order.planType] || 0;
  const today = businessDateOnly();
  const currentSubscription = await tx.subscription.findFirst({
    where: {
      subscriberId: subscriber.id,
      status: 'ACTIVE',
      endDate: { gte: today },
    },
    orderBy: { endDate: 'desc' },
  });

  if (currentSubscription) {
    if (currentSubscription.planType !== order.planType) {
      throw new Error('Chỉ có thể gia hạn đúng gói đang sử dụng khi gói hiện tại chưa hết hạn');
    }

    const endDate = new Date(currentSubscription.endDate);
    endDate.setUTCDate(endDate.getUTCDate() + (PLAN_DURATION_DAYS[order.planType] || 30));

    const subscription = await tx.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        endDate,
        ...(totalMin > 0 ? { totalHoursMin: { increment: totalMin } } : {}),
        paymentMethod: order.paymentMethod,
        paymentRef,
      },
    });

    await tx.registrationOrder.update({
      where: { id: order.id },
      data: {
        subscriptionId: subscription.id,
        orderStatus: 'ACTIVATED',
        assignedBy: 'system',
        assignedAt: new Date(),
      },
    });

    await tx.subscriptionAuditLog.create({
      data: {
        action: 'renewal_subscription_extended',
        entityType: 'registration_order',
        entityId: order.id,
        performedBy: 'system',
        details: {
          credential: 'qr',
          planType: order.planType,
          subscriptionId: subscription.id,
          previousEndDate: currentSubscription.endDate,
          newEndDate: endDate,
        },
      },
    });

    return subscription;
  }

  const issuedAt = new Date();
  const startDate = businessDateOnly(issuedAt);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + (PLAN_DURATION_DAYS[order.planType] || 30));

  const subscription = await tx.subscription.create({
    data: {
      subscriberId: subscriber.id,
      planType: order.planType,
      pricePaid: order.amount,
      status: 'ACTIVE',
      activationDate: issuedAt,
      startDate,
      endDate,
      totalHoursMin: totalMin > 0 ? totalMin : null,
      dailyLimitMin: (order.planType === 'MONTHLY_LIMITED' || order.planType === 'MONTHLY_UNLIMITED') ? 480 : null,
      paymentMethod: order.paymentMethod,
      paymentRef: paymentRef,
    },
  });

  await tx.registrationOrder.update({
    where: { id: order.id },
    data: {
      subscriptionId: subscription.id,
      orderStatus: 'ACTIVATED',
      assignedBy: 'system',
      assignedAt: issuedAt,
    },
  });

  await tx.subscriptionAuditLog.create({
    data: {
      action: 'renewal_subscription_activated',
      entityType: 'registration_order',
      entityId: order.id,
      performedBy: 'system',
      details: {
        credential: 'qr',
        planType: order.planType,
        subscriptionId: subscription.id,
        activationPolicy: 'qr_issued',
        startDate,
        endDate,
      },
    },
  });

  return subscription;
}

/**
 * Khách tự tạo đơn gia hạn (renew)
 */
export async function createRenewalOrder(data: {
  subscriberId: string;
  planType: 'WEEKLY_LIMITED' | 'MONTHLY_LIMITED' | 'MONTHLY_UNLIMITED';
  paymentMethod: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: 'Chưa đăng nhập' };

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: data.subscriberId },
    include: {
      subscriptions: {
        where: { status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!subscriber) return { success: false, error: 'Không tìm thấy thông tin hội viên' };
  if (subscriber.userId !== session.user.id) return { success: false, error: 'Không có quyền thao tác' };

  const pendingActivation = subscriber.subscriptions.find(
    (subscription) => subscription.status === 'PENDING_ACTIVATION'
  );
  if (pendingActivation) {
    return { success: false, error: 'Gói hiện tại đang chờ cấp QR nên chưa thể gia hạn' };
  }

  const activeSubscription = subscriber.subscriptions.find(
    (subscription) => subscription.status === 'ACTIVE'
  );
  const renewalEligibility = getRenewalEligibility(activeSubscription);
  if (!renewalEligibility.eligible) {
    const availableFrom = renewalEligibility.availableFrom?.toLocaleDateString('vi-VN') || '';
    return {
      success: false,
      error: `Chỉ có thể gia hạn trong ${RENEWAL_WINDOW_DAYS} ngày trước khi gói hết hạn${availableFrom ? `, từ ngày ${availableFrom}` : ''}`,
    };
  }

  if (activeSubscription && activeSubscription.planType !== data.planType) {
    return { success: false, error: 'Vui lòng gia hạn đúng gói hiện tại' };
  }

  const existingRenewalOrder = await prisma.registrationOrder.findFirst({
    where: {
      subscriberId: subscriber.id,
      orderStatus: { in: ['PENDING_PAYMENT', 'PAID'] },
    },
    select: { id: true },
  });
  if (existingRenewalOrder) {
    return { success: false, error: 'Bạn đang có một đơn gia hạn chưa hoàn tất' };
  }

  const amount = PLAN_PRICES[data.planType];
  if (!amount) return { success: false, error: 'Gói không hợp lệ' };

  const orderCode = await generateOrderCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const order = await prisma.registrationOrder.create({
    data: {
      orderCode,
      fullName: subscriber.fullName,
      phone: subscriber.phone,
      email: subscriber.email,
      branchPrimary: subscriber.branchPrimary || 'HTM',
      planType: data.planType,
      selfieUrl: subscriber.photoUrl || '/placeholder-selfie.jpg',
      amount,
      paymentMethod: data.paymentMethod,
      orderStatus: 'PENDING_PAYMENT',
      expiresAt,
      userId: session.user.id,
      subscriberId: subscriber.id, // Đánh dấu là đơn gia hạn
    },
  });

  let qrUrl = '';
  const bankConfig = getVietQRConfig();

  if (data.paymentMethod === 'online') {
    try {
      qrUrl = await generateOfficialQR({ amount, description: orderCode });
    } catch (error) {
      qrUrl = `https://img.vietqr.io/image/${bankConfig.bankCode}-${bankConfig.accountNumber}-compact2.png?amount=${amount}&addInfo=${orderCode}&accountName=${encodeURIComponent(bankConfig.accountName)}`;
    }
  }

  return { success: true, order, qrUrl, bankInfo: bankConfig };
}

// ============= QUERY HELPERS =============

/**
 * Lấy danh sách đơn đăng ký
 */
export async function getRegistrationOrders(filters?: {
  id?: string;
  status?: string;
  branch?: string;
  page?: number;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.id) where.id = filters.id;
  if (filters?.status) where.orderStatus = filters.status;
  if (filters?.branch) where.branchPrimary = filters.branch;

  const query = {
    where,
    orderBy: { createdAt: 'desc' as const },
    include: {
      subscriber: true,
      subscription: true,
    },
  };

  // Keep the legacy array response for callers that fetch one order to poll
  // payment status. Admin list requests provide page/limit and get metadata.
  if (filters?.page === undefined && filters?.limit === undefined) {
    return prisma.registrationOrder.findMany(query);
  }

  const page = Number.isFinite(filters?.page) ? Math.max(1, Math.floor(filters!.page!)) : 1;
  const limit = Number.isFinite(filters?.limit)
    ? Math.min(100, Math.max(1, Math.floor(filters!.limit!)))
    : 20;

  const [data, total] = await prisma.$transaction([
    prisma.registrationOrder.findMany({
      ...query,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.registrationOrder.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Admin: cấp QR và tạo hồ sơ membership.
 */
export async function issueQrAndCreate(orderId: string, staffName: string) {
  const order = await prisma.registrationOrder.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, phone: true, email: true } } },
  });
  if (!order) return { success: false, error: 'Đơn không tồn tại' };
  if (order.orderStatus !== 'PAID') return { success: false, error: 'Đơn chưa thanh toán' };

  const orderBelongsToUser = contactMatches(order, order.user);
  const [byUser, byPhone] = await Promise.all([
    order.userId && orderBelongsToUser
      ? prisma.subscriber.findUnique({ where: { userId: order.userId } })
      : Promise.resolve(null),
    prisma.subscriber.findUnique({ where: { phone: order.phone } }),
  ]);
  if (byUser && byPhone && byUser.id !== byPhone.id) {
    return { success: false, error: 'Tài khoản và số điện thoại đang thuộc hai hồ sơ khác nhau.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    let subscriber = byUser || byPhone;
    if (!subscriber) {
      subscriber = await tx.subscriber.create({
        data: {
          fullName: order.fullName,
          phone: order.phone,
          email: order.email,
          photoUrl: order.selfieUrl,
          branchPrimary: order.branchPrimary,
          userId: orderBelongsToUser ? order.userId : null,
        },
      });
    } else {
      subscriber = await tx.subscriber.update({
        where: { id: subscriber.id },
        data: {
          fullName: order.fullName,
          email: order.email,
          photoUrl: order.selfieUrl,
          branchPrimary: order.branchPrimary,
          ...(orderBelongsToUser && order.userId ? { userId: order.userId } : {}),
        },
      });
    }

    const totalMin = PLAN_HOURS_MIN[order.planType] || 0;
    const issuedAt = new Date();
    const startDate = businessDateOnly(issuedAt);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + (PLAN_DURATION_DAYS[order.planType] || 30));
    const subscription = await tx.subscription.create({
      data: {
        subscriberId: subscriber.id,
        planType: order.planType,
        pricePaid: order.amount,
        status: 'ACTIVE',
        activationDate: issuedAt,
        startDate,
        endDate,
        totalHoursMin: totalMin > 0 ? totalMin : null,
        dailyLimitMin: ['MONTHLY_LIMITED', 'MONTHLY_UNLIMITED'].includes(order.planType) ? 480 : null,
        paymentMethod: order.paymentMethod,
        paymentRef: order.paymentRef,
      },
    });
    const existingCredential = await tx.membershipQrCredential.findUnique({
      where: { subscriberId: subscriber.id },
    });
    const credential = existingCredential || await tx.membershipQrCredential.create({
      data: { subscriberId: subscriber.id, publicId: randomUUID() },
    });
    await tx.registrationOrder.update({
      where: { id: orderId },
      data: {
        orderStatus: 'ACTIVATED',
        assignedBy: staffName,
        assignedAt: issuedAt,
        subscriberId: subscriber.id,
        subscriptionId: subscription.id,
        userId: orderBelongsToUser ? order.userId : null,
      },
    });
    await tx.subscriptionAuditLog.create({
      data: {
        action: 'qr_issued',
        entityType: 'registration_order',
        entityId: orderId,
        performedBy: staffName,
        details: {
          subscriberId: subscriber.id,
          subscriberName: subscriber.fullName,
          activationPolicy: 'qr_issued',
          startDate,
          endDate,
        },
      },
    });
    return { subscriber, subscription, credential };
  });

  if (order.userId && orderBelongsToUser) await ensureUserWalletAccount(order.userId);
  revalidatePath('/admin/subscriptions');
  revalidatePath('/profile/monthly-beaver');
  return { success: true, ...result, qrPayload: buildMembershipQrPayload(result.credential) };
}

/**
 * Lấy danh sách subscribers
 */
export async function getSubscribers(filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { fullName: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
    ];
  }

  const today = businessDateOnly();

  const page = Number.isFinite(filters?.page) ? Math.max(1, Math.floor(filters!.page!)) : 1;
  const limit = Number.isFinite(filters?.limit)
    ? Math.min(100, Math.max(1, Math.floor(filters!.limit!)))
    : 20;

  const [subscribers, total] = await prisma.$transaction([
    prisma.subscriber.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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
                usageDate: today,
              },
            },
          },
        },
      },
    }),
    prisma.subscriber.count({ where }),
  ]);

  const data = subscribers.map((subscriber) => {
    const currentSub = subscriber.subscriptions[0];
    const todayUsage = currentSub?.dailyUsages?.[0]?.totalMin || 0;

    return {
      ...subscriber,
      walletBalance: subscriber.user?.wallet?.balance || 0,
      walletCode: subscriber.user?.wallet?.walletCode || subscriber.walletCode,
      todayUsedMin: todayUsage,
    };
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
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
        orderStatus: { in: ['PAID', 'QR_ISSUED', 'CARD_ASSIGNED', 'ACTIVATED'] },
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

    revalidatePath('/admin/subscriptions');
    return { success: true };
  } catch (err) {
    console.error('[deleteSubscriber] Error:', err);
    return { success: false, error: 'Không thể xóa hội viên. Có lỗi xảy ra.' };
  }
}

