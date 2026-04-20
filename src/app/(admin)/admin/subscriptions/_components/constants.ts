export type TabType = 'orders' | 'subscribers' | 'live' | 'wallet' | 'report';

export interface RegistrationOrder {
  id: string;
  orderCode: string;
  fullName: string;
  phone: string;
  email?: string;
  branchPrimary: string;
  planType: string;
  selfieUrl: string;
  orderStatus: string;
  amount: number;
  paymentMethod?: string;
  paidAt?: string;
  assignedCardNo?: string;
  assignedBy?: string;
  assignedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface Subscriber {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  photoUrl?: string;
  cardNo?: string;
  branchPrimary?: string;
  status: string;
  walletBalance: number;
  outstandingBalance: number;
  createdAt: string;
  subscriptions: Array<{
    id: string;
    planType: string;
    status: string;
    totalHoursMin?: number;
    usedHoursMin: number;
    carriedHoursMin: number;
    endDate?: string;
  }>;
}

export const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Tuần Limited',
  MONTHLY_LIMITED: 'Tháng Limited',
  MONTHLY_UNLIMITED: 'Tháng Unlimited',
};

export const STATUS_LABELS: Record<string, { label: string; color: any; bg?: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', color: 'amber' },
  PAID: { label: 'Đã thanh toán', color: 'blue' },
  CARD_ASSIGNED: { label: 'Đã gán thẻ', color: 'emerald' },
  ACTIVATED: { label: 'Đã kích hoạt', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'red' },
  ORDER_EXPIRED: { label: 'Hết hạn', color: 'zinc' },
  // Sub status
  PENDING_ACTIVATION: { label: 'Chờ kích hoạt', color: 'amber' },
  ACTIVE: { label: 'Active', color: 'emerald' },
  EXPIRED: { label: 'Hết hạn', color: 'red' },
  RENEWED: { label: 'Đã gia hạn', color: 'blue' },
};
