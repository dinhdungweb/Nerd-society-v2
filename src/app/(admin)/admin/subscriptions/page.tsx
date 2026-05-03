'use client';

/**
 * Admin Subscription Management (Refactored & Optimized)
 * Tab: Đơn đăng ký | Hội viên | Trực tuyến | Ví tiền | Báo cáo
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  GlobeAltIcon,
  WalletIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

// Components
import OrderTable from './_components/OrderTable';
import SubscriberTable from './_components/SubscriberTable';
import LiveSessions from './_components/LiveSessions';
import WalletManagement from './_components/WalletManagement';
import SubscriptionReport from './_components/SubscriptionReport';
import OrderDetailsModal from './_components/OrderDetailsModal';

// Constants & Types
import { TabType, RegistrationOrder, Subscriber } from './_components/constants';

export default function SubscriptionsAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [orders, setOrders] = useState<RegistrationOrder[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<RegistrationOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
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
      } else if (activeTab === 'wallet') {
        const res = await fetch(`/api/admin/subscriptions/subscribers`);
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

  // Actions
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

  const handleAssignCard = async (orderId: string, cardNo: string) => {
    setActionLoading(true);
    await fetch('/api/admin/subscriptions/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_card', orderId, cardNo, staffName: 'admin' }),
    });
    setActionLoading(false);
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

  const handleDeleteSubscriber = async (sub: Subscriber) => {
    if (!confirm(`Bạn chắc chắn muốn xóa hội viên "${sub.fullName}"?\nLưu ý: Toàn bộ dữ liệu của người này trên Web và MyTime sẽ bị xóa sạch và không thể khôi phục.`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/subscriptions/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sub.id }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể xóa'));
      }
    } catch (err) {
      alert('Có lỗi xảy ra khi xóa');
    }
    setActionLoading(false);
  };

  const tabs: Array<{ key: TabType, label: string, icon: any }> = [
    { key: 'orders', label: 'Đơn đăng ký', icon: ClipboardDocumentListIcon },
    { key: 'subscribers', label: 'Hội viên', icon: UserGroupIcon },
    { key: 'live', label: 'Trực tuyến', icon: GlobeAltIcon },
    { key: 'wallet', label: 'Ví tiền', icon: WalletIcon },
    { key: 'report', label: 'Báo cáo', icon: ChartBarIcon },
  ];

  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
            Quản lý Subscription
          </h1>
          <p className="mt-1 text-sm font-medium text-neutral-500">
            Hệ thống quản lý gói thành viên, thẻ vật lý và báo cáo doanh thu
          </p>
        </div>
        
        {activeTab === 'subscribers' && (
           <div className="relative max-w-xs">
             <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
               <MagnifyingGlassIcon className="h-4 w-4 text-neutral-400" />
             </div>
             <input
               type="text"
               placeholder="Tìm kiếm hội viên..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="block w-full rounded-2xl border-none bg-white py-2.5 pl-10 pr-4 text-sm font-medium shadow-sm ring-1 ring-neutral-200 focus:ring-2 focus:ring-primary-500 dark:bg-neutral-900 dark:ring-neutral-700"
             />
           </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2 rounded-2xl bg-neutral-100 p-1.5 dark:bg-neutral-800/50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-white text-neutral-900 border border-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white'
                  : 'text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-900 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300'
              }`}
            >
              <tab.icon className={`h-5 w-5 ${activeTab === tab.key ? 'text-white' : 'text-neutral-500'}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="min-h-[400px]">
        {/* Tab content with subtle transition wrapper if needed */}
        <div className="transition-all duration-300">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                 <FunnelIcon className="h-4 w-4 text-neutral-400" />
                 <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="rounded-xl border-none bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-700 focus:ring-2 focus:ring-primary-500 dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="PENDING_PAYMENT">Chờ thanh toán</option>
                    <option value="PAID">Chờ gán thẻ</option>
                    <option value="CARD_ASSIGNED">Đã gán thẻ</option>
                    <option value="ACTIVATED">Đã kích hoạt</option>
                  </select>
              </div>
              <OrderTable 
                orders={orders} 
                loading={loading} 
                onSelectOrder={setSelectedOrder} 
              />
            </div>
          )}

          {activeTab === 'subscribers' && (
            <SubscriberTable 
              subscribers={subscribers} 
              loading={loading} 
              onDelete={handleDeleteSubscriber}
              actionLoading={actionLoading}
            />
          )}

          {activeTab === 'live' && (
            <LiveSessions />
          )}

          {activeTab === 'wallet' && (
            <WalletManagement 
              subscribers={subscribers} 
              onRefresh={fetchData} 
            />
          )}

          {activeTab === 'report' && (
            <SubscriptionReport />
          )}
        </div>
      </main>

      {/* Modals */}
      <OrderDetailsModal 
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onConfirmPayment={handleConfirmPayment}
        onAssignCard={handleAssignCard}
        onCancelOrder={handleCancelOrder}
        actionLoading={actionLoading}
      />
    </div>
  );
}
