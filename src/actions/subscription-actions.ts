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
import {
  buildMembershipQrPayload,
  ensureMembershipQrCredential,
  issueMembershipQrCredentialInTx,
} from '@/lib/subscription/qr-credential';
import {
  createRegistrationOrderWithCode,
  getPlanEndDate,
  PLAN_HOURS_MIN,
  settleRegistrationOrderInTx,
} from '@/lib/subscription/order-lifecycle';
import { notifySubscriptionSuccess } from '@/lib/subscription/zalo-notifications';
import { getServerSession } from 'next-auth';
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

function getRenewalDebtMessage(outstandingBalance: number) {
  return `Bạn đang còn công nợ ${outstandingBalance.toLocaleString('vi-VN')}đ. Vui lòng thanh toán công nợ trước khi gia hạn.`;
}

function normalizePhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') || '';
  return digits.startsWith('84') && digits.length > 9 ? `0${digits.slice(2)}` : digits;
}

function phoneCandidates(phone?: string | null) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const values = new Set([phone?.trim() || '', normalized]);
  if (normalized.startsWith('0')) {
    values.add(`84${normalized.slice(1)}`);
    values.add(`+84${normalized.slice(1)}`);
  }
  return Array.from(values).filter(Boolean);
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

  const existingSubscriber = await prisma.subscriber.findFirst({
    where: {
      OR: [
        ...(session?.user?.id ? [{ userId: session.user.id }] : []),
        ...(phoneCandidates(data.phone).length ? [{ phone: { in: phoneCandidates(data.phone) } }] : []),
      ],
    },
    select: { id: true },
  });
  if (existingSubscriber) {
    return {
      success: false,
      error: 'Bạn đã có hồ sơ Monthly Beaver. Vui lòng sử dụng chức năng gia hạn trong hồ sơ.',
      errorCode: 'EXISTING_SUBSCRIBER' as const,
      redirectTo: '/profile/monthly-beaver',
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const order = await createRegistrationOrderWithCode({
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    branchPrimary: data.branchPrimary,
    planType: data.planType,
    selfieUrl: data.selfieUrl,
    amount,
    paymentMethod: data.paymentMethod,
    orderStatus: 'PENDING_PAYMENT',
    expiresAt,
    userId: linkedUserId,
  });

  // Tạo mã QR từ API chính thức để hỗ trợ xác nhận tự động
  let qrUrl = '';
  const bankConfig = getVietQRConfig();

  if (data.paymentMethod === 'online') {
    try {
      qrUrl = await generateOfficialQR({
        amount,
        description: order.orderCode,
      });
    } catch (error) {
      console.error('[createRegistrationOrder] QR Error:', error);
      // Fallback link if API fails
      qrUrl = `https://img.vietqr.io/image/${bankConfig.bankCode}-${bankConfig.accountNumber}-compact2.png?amount=${amount}&addInfo=${order.orderCode}&accountName=${encodeURIComponent(bankConfig.accountName)}`;
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
  if (['CANCELLED', 'ORDER_EXPIRED'].includes(order.orderStatus)) {
    return { success: false, error: 'Đơn đăng ký đã bị hủy hoặc hết hạn' };
  }

  const canPayOrder =
    order.userId === user.id ||
    (!order.userId && contactMatches(order, user));

  if (!canPayOrder) {
    return { success: false, error: 'Bạn không có quyền thanh toán đơn đăng ký này' };
  }

  if (['PAID', 'ACTIVATED'].includes(order.orderStatus)) {
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`wallet:${walletAccount.wallet.id}`}))`;
      const settlement = await settleRegistrationOrderInTx(tx, {
        orderId: order.id,
        paidAt,
        paymentRef: externalTransactionId,
        paymentMethod: 'wallet',
        performedBy: 'customer',
        auditAction: 'payment_confirmed_wallet',
      });
      if (settlement.outcome === 'EXPIRED') {
        return {
          settlement,
          walletTransaction: null,
          currentBalance: walletAccount.wallet.balance,
        };
      }
      if (settlement.outcome === 'ALREADY_SETTLED') {
        const [existingTransaction, currentWallet] = await Promise.all([
          tx.walletTransaction.findUnique({ where: { externalTransactionId } }),
          tx.wallet.findUnique({ where: { id: walletAccount.wallet.id }, select: { balance: true } }),
        ]);
        return {
          settlement,
          walletTransaction: existingTransaction,
          currentBalance: currentWallet?.balance ?? walletAccount.wallet.balance,
        };
      }

      const walletResult = await applyWalletTransactionInTx(tx, {
        walletId: walletAccount.wallet.id,
        type: 'SUBSCRIPTION_PURCHASE',
        amount: -amount,
        source: 'MONTHLY_BEAVER',
        referenceType: 'registration_order',
        referenceId: settlement.order.id,
        externalTransactionId,
        description: `Thanh toán gói Monthly Beaver ${settlement.order.orderCode}`,
      });
      const updatedOrder = await tx.registrationOrder.update({
        where: { id: settlement.order.id },
        data: { userId: settlement.order.userId || user.id },
      });

      return {
        settlement,
        order: updatedOrder,
        walletTransaction: walletResult.transaction,
        currentBalance: walletResult.balanceAfter,
      };
    });

    if (result.settlement.outcome === 'EXPIRED') {
      return { success: false, error: 'Đơn đăng ký đã hết hạn. Ví Nerd chưa bị trừ tiền.' };
    }

    if (result.settlement.isRenewal && result.settlement.order.subscriberId) {
      await ensureMembershipQrCredential(result.settlement.order.subscriberId);
      try {
        await notifySubscriptionSuccess(result.settlement.order.id, 'RENEWED');
      } catch (zaloError) {
        console.error('[payRegistrationOrderWithWallet] Zalo notification error:', zaloError);
      }
    }

    try {
      await sendSubscriptionPaidEmail(result.settlement.order);
    } catch (emailError) {
      console.error('[payRegistrationOrderWithWallet] Subscription email error:', emailError);
    }

    revalidatePath('/profile/wallet');
    revalidatePath('/profile/monthly-beaver');
    revalidatePath('/admin/subscriptions');
    revalidatePath('/admin/wallets');

    return {
      success: true,
      order: result.settlement.order,
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
  try {
    const settlement = await prisma.$transaction((tx) =>
      settleRegistrationOrderInTx(tx, {
        orderId,
        paidAt: new Date(),
        paymentRef: paymentRef || null,
        performedBy: 'admin',
        auditAction: 'payment_confirmed',
      })
    );
    if (settlement.outcome === 'EXPIRED') {
      return { success: false, error: 'Đơn đăng ký đã hết hạn và không thể xác nhận thanh toán.' };
    }

    if (settlement.isRenewal && settlement.order.subscriberId) {
      await ensureMembershipQrCredential(settlement.order.subscriberId);
      try {
        await notifySubscriptionSuccess(settlement.order.id, 'RENEWED');
      } catch (zaloError) {
        console.error('[confirmPayment] Zalo notification error:', zaloError);
      }
    }

    try {
      await sendSubscriptionPaidEmail(settlement.order);
    } catch (emailError) {
      console.error('[confirmPayment] Subscription email error:', emailError);
    }

    revalidatePath('/admin/subscriptions');
    revalidatePath('/profile/monthly-beaver');
    return { success: true, order: settlement.order };
  } catch (error: any) {
    return { success: false, error: error.message || 'Không thể xác nhận thanh toán' };
  }
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
  if (subscriber.outstandingBalance > 0) {
    return {
      success: false,
      error: getRenewalDebtMessage(subscriber.outstandingBalance),
    };
  }

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

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const order = await createRegistrationOrderWithCode({
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
    subscriberId: subscriber.id,
  });

  let qrUrl = '';
  const bankConfig = getVietQRConfig();

  if (data.paymentMethod === 'online') {
    try {
      qrUrl = await generateOfficialQR({ amount, description: order.orderCode });
    } catch (error) {
      qrUrl = `https://img.vietqr.io/image/${bankConfig.bankCode}-${bankConfig.accountNumber}-compact2.png?amount=${amount}&addInfo=${order.orderCode}&accountName=${encodeURIComponent(bankConfig.accountName)}`;
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

  const existingSubscriber = byUser || byPhone;
  if (existingSubscriber) {
    const renewed = await prisma.$transaction(async (tx) => {
      await tx.subscriber.update({
        where: { id: existingSubscriber.id },
        data: {
          fullName: order.fullName,
          email: order.email,
          photoUrl: order.selfieUrl,
          branchPrimary: order.branchPrimary,
          ...(orderBelongsToUser && order.userId ? { userId: order.userId } : {}),
        },
      });
      await tx.registrationOrder.update({
        where: { id: order.id },
        data: {
          subscriberId: existingSubscriber.id,
          userId: orderBelongsToUser ? order.userId : null,
        },
      });
      const settlement = await settleRegistrationOrderInTx(tx, {
        orderId: order.id,
        paidAt: order.paidAt || new Date(),
        paymentRef: order.paymentRef,
        performedBy: staffName,
        auditAction: 'payment_confirmed_before_qr_issue',
      });
      const credential = await issueMembershipQrCredentialInTx(tx, existingSubscriber.id);
      const subscription = settlement.order.subscriptionId
        ? await tx.subscription.findUnique({ where: { id: settlement.order.subscriptionId } })
        : null;
      return { settlement, credential, subscription };
    });

    if (order.userId && orderBelongsToUser) await ensureUserWalletAccount(order.userId);
    try {
      await notifySubscriptionSuccess(order.id, 'RENEWED');
    } catch (zaloError) {
      console.error('[issueQrAndCreate] Zalo notification error:', zaloError);
    }
    revalidatePath('/admin/subscriptions');
    revalidatePath('/profile/monthly-beaver');
    return {
      success: true,
      subscriber: existingSubscriber,
      subscription: renewed.subscription,
      credential: renewed.credential,
      qrPayload: buildMembershipQrPayload(renewed.credential),
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const subscriber = await tx.subscriber.create({
      data: {
        fullName: order.fullName,
        phone: order.phone,
        email: order.email,
        photoUrl: order.selfieUrl,
        branchPrimary: order.branchPrimary,
        userId: orderBelongsToUser ? order.userId : null,
      },
    });

    const totalMin = PLAN_HOURS_MIN[order.planType];
    const issuedAt = new Date();
    const startDate = businessDateOnly(issuedAt);
    const endDate = getPlanEndDate(startDate, order.planType);
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
    const credential = await issueMembershipQrCredentialInTx(tx, subscriber.id);
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
  try {
    await notifySubscriptionSuccess(order.id, 'REGISTERED');
  } catch (zaloError) {
    console.error('[issueQrAndCreate] Zalo notification error:', zaloError);
  }
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

