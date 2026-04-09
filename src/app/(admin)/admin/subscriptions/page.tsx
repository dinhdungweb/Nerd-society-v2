'use client';

/**
 * Admin Subscription Management
 * Tab 1: Đơn đăng ký | Tab 2: Subscribers | Tab 3: Báo cáo
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UserIcon } from '@heroicons/react/24/solid';
import { differenceInMinutes } from 'date-fns';


type TabType = 'orders' | 'subscribers' | 'live' | 'wallet' | 'report';

// ============== TYPES ==============

interface RegistrationOrder {
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

interface Subscriber {
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

// ============== PLAN LABELS ==============

const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Tuần Limited',
  MONTHLY_LIMITED: 'Tháng Limited',
  MONTHLY_UNLIMITED: 'Tháng Unlimited',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  PAID: { label: 'Đã thanh toán', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  CARD_ASSIGNED: { label: 'Đã gán thẻ', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  ACTIVATED: { label: 'Đã kích hoạt', color: 'text-green-400', bg: 'bg-green-400/10' },
  CANCELLED: { label: 'Đã hủy', color: 'text-red-400', bg: 'bg-red-400/10' },
  ORDER_EXPIRED: { label: 'Hết hạn', color: 'text-neutral-400', bg: 'bg-neutral-400/10' },
  // Sub status
  PENDING_ACTIVATION: { label: 'Chờ kích hoạt', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ACTIVE: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  EXPIRED: { label: 'Hết hạn', color: 'text-red-400', bg: 'bg-red-400/10' },
  RENEWED: { label: 'Đã gia hạn', color: 'text-blue-400', bg: 'bg-blue-400/10' },
};

// ============== MAIN COMPONENT ==============

export default function SubscriptionsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<RegistrationOrder[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<RegistrationOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cardInput, setCardInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'orders') {
        const res = await fetch(`/api/admin/subscriptions/orders?${filterStatus ? `status=${filterStatus}` : ''}`);
        if (res.ok) setOrders(await res.json());
      } else if (activeTab === 'subscribers') {
        const res = await fetch(`/api/admin/subscriptions/subscribers?${searchTerm ? `search=${searchTerm}` : ''}`);
        if (res.ok) setSubscribers(await res.json());
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  }, [activeTab, filterStatus, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConfirmPayment = async (orderId: string) => {
    setActionLoading(true);
    await fetch('/api/admin/subscriptions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_payment', orderId }),
    });
    setActionLoading(false);
    fetchData();
    setSelectedOrder(null);
  };

  const handleAssignCard = async (orderId: string) => {
    if (!cardInput.trim()) return;
    setActionLoading(true);
    await fetch('/api/admin/subscriptions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_card', orderId, cardNo: cardInput, staffName: 'admin' }),
    });
    setActionLoading(false);
    setCardInput('');
    fetchData();
    setSelectedOrder(null);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Bạn chắc chắn muốn hủy đơn này?')) return;
    setActionLoading(true);
    await fetch('/api/admin/subscriptions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', orderId }),
    });
    setActionLoading(false);
    fetchData();
    setSelectedOrder(null);
  };

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, color: 'text-neutral-400', bg: 'bg-neutral-400/10' };
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color} ${s.bg}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý Subscription</h1>
        <p className="text-sm text-neutral-500">Quản lý đơn đăng ký, thành viên và báo cáo gói thành viên</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {[
          { key: 'orders' as TabType, label: '📋 Đơn đăng ký' },
          { key: 'subscribers' as TabType, label: '👥 Hội viên' },
          { key: 'live' as TabType, label: '🎯 Trực tuyến' },
          { key: 'wallet' as TabType, label: '💳 Ví tiền' },
          { key: 'report' as TabType, label: '📊 Báo cáo' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Orders */}
      {activeTab === 'orders' && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING_PAYMENT">Chờ thanh toán</option>
              <option value="PAID">Đã thanh toán (chờ gán thẻ)</option>
              <option value="CARD_ASSIGNED">Đã gán thẻ</option>
              <option value="ACTIVATED">Đã kích hoạt</option>
            </select>
          </div>

          {/* Orders table */}
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left text-xs font-medium text-neutral-500 uppercase">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Gói</th>
                  <th className="px-4 py-3">CS</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Đang tải...</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Chưa có đơn đăng ký nào</td></tr>
                ) : orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                    <td className="px-4 py-3 text-xs font-mono text-neutral-500">{order.orderCode}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {order.selfieUrl ? (
                          <img 
                            src={order.selfieUrl} 
                            alt="" 
                            className="h-8 w-8 rounded-full object-cover border border-neutral-200 dark:border-neutral-700" 
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(order.fullName) + '&background=random';
                            }}
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center dark:bg-neutral-800">
                            <UserIcon className="h-5 w-5 text-neutral-400" />
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{order.fullName}</p>
                          <p className="text-xs text-neutral-500">{order.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">{PLAN_LABELS[order.planType] || order.planType}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">{order.branchPrimary}</td>
                    <td className="px-4 py-3">{getStatusBadge(order.orderStatus)}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-4 py-3">
                      <button className="text-sm text-indigo-500 hover:text-indigo-400">Chi tiết</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Subscribers */}
      {activeTab === 'subscribers' && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="🔍 Tìm theo tên hoặc SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-900">
                <tr className="text-left text-xs font-medium text-neutral-500 uppercase">
                  <th className="px-4 py-3">Thành viên</th>
                  <th className="px-4 py-3">SĐT</th>
                  <th className="px-4 py-3">Gói</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Còn lại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">Đang tải...</td></tr>
                ) : subscribers.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">Chưa có subscriber</td></tr>
                ) : subscribers.map((sub) => {
                  const currentSub = sub.subscriptions[0];
                  const remaining = currentSub && currentSub.totalHoursMin
                    ? Math.max(0, currentSub.totalHoursMin + currentSub.carriedHoursMin - currentSub.usedHoursMin)
                    : null;

                  return (
                    <tr key={sub.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {sub.photoUrl ? (
                            <img 
                              src={sub.photoUrl} 
                              alt="" 
                              className="h-8 w-8 rounded-full object-cover border border-neutral-200" 
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(sub.fullName) + '&background=random';
                              }}
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-neutral-100 flex items-center justify-center dark:bg-neutral-800">
                              <UserIcon className="h-5 w-5 text-neutral-400" />
                            </div>
                          )}

                          <span className="text-sm font-medium text-neutral-900 dark:text-white">{sub.fullName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">{sub.phone}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
                        {currentSub ? PLAN_LABELS[currentSub.planType] || currentSub.planType : '—'}
                      </td>
                      <td className="px-4 py-3">{currentSub ? getStatusBadge(currentSub.status) : getStatusBadge('EXPIRED')}</td>
                      <td className="px-4 py-3 text-sm">
                        {remaining !== null ? (
                          <span className={remaining <= 300 ? 'text-red-400 font-medium' : 'text-neutral-400'}>
                            {Math.round(remaining / 60)}h
                          </span>
                        ) : currentSub?.planType === 'MONTHLY_UNLIMITED' ? (
                          <span className="text-emerald-400">∞</span>
                        ) : (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Live */}
      {activeTab === 'live' && (
        <LiveSessionsTab />
      )}

      {/* Tab: Wallet */}
      {activeTab === 'wallet' && (
        <WalletTab subscribers={subscribers} onRefresh={fetchData} />
      )}

      {/* Tab: Report */}
      {activeTab === 'report' && (
        <ReportTab />
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Đơn {selectedOrder.orderCode}
                </h3>
                <p className="text-sm text-neutral-500">{selectedOrder.fullName}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-neutral-400 hover:text-neutral-600">✕</button>
            </div>

            <div className="mb-4 flex gap-4">
              {selectedOrder.selfieUrl ? (
                <img 
                  src={selectedOrder.selfieUrl} 
                  alt="Selfie" 
                  className="h-24 w-24 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedOrder.fullName) + '&background=random';
                  }}
                />
              ) : (
                <div className="h-24 w-24 rounded-xl bg-neutral-100 flex items-center justify-center dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                  <UserIcon className="h-12 w-12 text-neutral-400" />
                </div>
              )}

              <div className="space-y-1 text-sm">
                <p><span className="text-neutral-500">SĐT:</span> <span className="dark:text-white">{selectedOrder.phone}</span></p>
                {selectedOrder.email && <p><span className="text-neutral-500">Email:</span> <span className="dark:text-white">{selectedOrder.email}</span></p>}
                <p><span className="text-neutral-500">Cơ sở:</span> <span className="dark:text-white">{selectedOrder.branchPrimary}</span></p>
                <p><span className="text-neutral-500">Gói:</span> <span className="dark:text-white">{PLAN_LABELS[selectedOrder.planType]} ({(selectedOrder.amount).toLocaleString()}đ)</span></p>
                <p><span className="text-neutral-500">Trạng thái:</span> {getStatusBadge(selectedOrder.orderStatus)}</p>
              </div>
            </div>

            {/* Actions based on status */}
            <div className="space-y-3 border-t pt-4 dark:border-neutral-800">
              {selectedOrder.orderStatus === 'PENDING_PAYMENT' && (
                <button
                  onClick={() => handleConfirmPayment(selectedOrder.id)}
                  disabled={actionLoading}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  ✅ Xác nhận đã thanh toán
                </button>
              )}

              {selectedOrder.orderStatus === 'PAID' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Gán thẻ cho khách</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cardInput}
                      onChange={(e) => setCardInput(e.target.value)}
                      placeholder="Nhập mã thẻ proximity..."
                      className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    />
                    <button
                      onClick={() => handleAssignCard(selectedOrder.id)}
                      disabled={actionLoading || !cardInput.trim()}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Gán thẻ & Tạo
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">Quẹt thẻ vào ZKTeco hoặc đọc mã trên thẻ</p>
                </div>
              )}

              {['PENDING_PAYMENT', 'PAID'].includes(selectedOrder.orderStatus) && (
                <button
                  onClick={() => handleCancelOrder(selectedOrder.id)}
                  disabled={actionLoading}
                  className="w-full rounded-lg border border-red-200 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  ❌ Hủy đơn
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== LIVE SESSIONS TAB ========================

function LiveSessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/subscriptions/sessions?status=ACTIVE')
      .then(r => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <table className="w-full">
        <thead className="bg-neutral-50 dark:bg-neutral-900">
          <tr className="text-left text-xs font-medium text-neutral-500 uppercase">
            <th className="px-4 py-3">Thành viên</th>
            <th className="px-4 py-3">Cơ sở</th>
            <th className="px-4 py-3">Vào lúc</th>
            <th className="px-4 py-3">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {loading ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Đang tải...</td></tr>
          ) : sessions.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Không có ai đang ngồi</td></tr>
          ) : sessions.map((s) => (
            <tr key={s.id} className="text-sm">
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">{s.subscriber.fullName}</td>
              <td className="px-4 py-3 text-neutral-500">{s.branch}</td>
              <td className="px-4 py-3 text-neutral-500">{new Date(s.checkInTime).toLocaleTimeString('vi-VN')}</td>
              <td className="px-4 py-3">
                <span className="text-indigo-500 font-mono">
                  {Math.floor(differenceInMinutes(new Date(), new Date(s.checkInTime)))} m
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ======================== WALLET TAB ========================

import { topUpWallet } from '@/lib/subscription/wallet-actions';

function WalletTab({ subscribers, onRefresh }: { subscribers: Subscriber[], onRefresh: () => void }) {
  const [showTopup, setShowTopup] = useState<{ id: string; name: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopup = async () => {
    if (!showTopup || !amount) return;
    setLoading(true);
    const res = await topUpWallet(showTopup.id, parseInt(amount));
    if (res.success) {
      alert(`Đã nạp ${parseInt(amount).toLocaleString()}đ cho ${showTopup.name}`);
      setShowTopup(null);
      setAmount('');
      onRefresh();
    } else {
      alert('Lỗi: ' + res.error);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full">
          <thead className="bg-neutral-50 dark:bg-neutral-900">
            <tr className="text-left text-xs font-medium text-neutral-500 uppercase">
              <th className="px-4 py-3">Thành viên</th>
              <th className="px-4 py-3">Số dư Ví</th>
              <th className="px-4 py-3">Nợ quá giờ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {subscribers.map((sub) => (
              <tr key={sub.id} className="text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                <td className="px-4 py-3">
                   <p className="font-medium text-neutral-900 dark:text-white">{sub.fullName}</p>
                   <p className="text-xs text-neutral-500">{sub.phone}</p>
                </td>
                <td className="px-4 py-3 font-mono text-emerald-500">
                   {(sub.walletBalance || 0).toLocaleString()}đ
                </td>
                <td className="px-4 py-3 font-mono text-red-500">
                   {(sub.outstandingBalance || 0).toLocaleString()}đ
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => setShowTopup({ id: sub.id, name: sub.fullName })}
                    className="text-xs bg-indigo-500 text-white px-3 py-1 rounded-lg hover:bg-indigo-400"
                  >
                    Nạp tiền
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showTopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Nạp tiền cho {showTopup.name}</h3>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Nhập số tiền (VNĐ)..."
              className="mb-4 w-full rounded-lg border border-neutral-200 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            />
            <div className="flex gap-2">
               <button 
                onClick={() => setShowTopup(null)} 
                className="flex-1 rounded-lg bg-neutral-100 py-2 text-sm font-medium dark:bg-neutral-800"
               >
                 Hủy
               </button>
               <button 
                onClick={handleTopup}
                disabled={loading || !amount}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
               >
                 {loading ? 'Đang nạp...' : 'Xác nhận nạp'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== REPORT TAB ========================

function ReportTab() {
  const [report, setReport] = useState<{
    activeSubs: number; newOrders: number; totalRevenue: number;
    totalSessions: number; byPlan: Array<{ plan: string; count: number }>;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    fetch(`/api/admin/subscriptions/report?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      .then(r => r.json())
      .then(setReport)
      .catch(console.error);
  }, []);

  if (!report) return <div className="py-8 text-center text-neutral-400">Đang tải báo cáo...</div>;

  const statCards = [
    { label: 'Subscriber Active', value: report.activeSubs, icon: '👥', color: 'border-emerald-500/20 bg-emerald-500/5' },
    { label: 'Đơn mới tháng này', value: report.newOrders, icon: '📋', color: 'border-blue-500/20 bg-blue-500/5' },
    { label: 'Doanh thu', value: `${(report.totalRevenue / 1000).toLocaleString()}k`, icon: '💰', color: 'border-amber-500/20 bg-amber-500/5' },
    { label: 'Sessions tháng này', value: report.totalSessions, icon: '🎯', color: 'border-purple-500/20 bg-purple-500/5' },
  ];

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Báo cáo — Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}
      </h2>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.color}`}>
            <div className="mb-1 text-2xl">{card.icon}</div>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{card.value}</p>
            <p className="text-xs text-neutral-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Phân bổ theo gói</h3>
        {report.byPlan.map((p) => (
          <div key={p.plan} className="mb-2 flex items-center justify-between text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{PLAN_LABELS[p.plan] || p.plan}</span>
            <span className="font-medium text-neutral-900 dark:text-white">{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
