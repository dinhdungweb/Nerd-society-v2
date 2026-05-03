'use client';

import React, { useState } from 'react';
import { UserIcon, MapPinIcon, DevicePhoneMobileIcon, EnvelopeIcon, CreditCardIcon, CalendarIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import NcModal from '@/shared/NcModal';
import { Button } from '@/shared/Button';
import Input from '@/shared/Input';
import { Badge } from '@/shared/Badge';
import { RegistrationOrder, PLAN_LABELS, STATUS_LABELS } from './constants';

interface OrderDetailsModalProps {
  order: RegistrationOrder | null;
  onClose: () => void;
  onConfirmPayment: (orderId: string) => Promise<void>;
  onAssignCard: (orderId: string, cardNo: string) => Promise<void>;
  onCancelOrder: (orderId: string) => Promise<void>;
  actionLoading: boolean;
}

export default function OrderDetailsModal({
  order,
  onClose,
  onConfirmPayment,
  onAssignCard,
  onCancelOrder,
  actionLoading,
}: OrderDetailsModalProps) {
  const [cardInput, setCardInput] = useState('');

  if (!order) return null;

  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, color: 'zinc' };
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  const renderContent = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Profile Section */}
        <div className="flex shrink-0 flex-col items-center gap-4">
          <div className="relative group">
            <img 
              src={order.selfieUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(order.fullName)}&background=random`} 
              alt="Selfie" 
              className="h-40 w-40 rounded-2xl object-cover shadow-lg ring-4 ring-neutral-50 dark:ring-neutral-800"
              onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(order.fullName)}&background=random`;
              }}
            />
            {order.selfieUrl && (
              <a 
                href={order.selfieUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <IdentificationIcon className="h-8 w-8 text-white" />
              </a>
            )}
          </div>
          <div className="text-center">
            <h4 className="text-xl font-bold text-neutral-900 dark:text-white">{order.fullName}</h4>
            <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">{order.orderCode}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-2 flex-1 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <DevicePhoneMobileIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Số điện thoại</p>
                <p className="text-sm font-medium dark:text-white">{order.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <EnvelopeIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Email</p>
                <p className="text-sm font-medium dark:text-white truncate max-w-[150px]">{order.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <MapPinIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Cơ sở chính</p>
                <p className="text-sm font-medium dark:text-white">{order.branchPrimary}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <CreditCardIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Gói thành viên</p>
                <p className="text-sm font-medium dark:text-white">{PLAN_LABELS[order.planType] || order.planType}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <CalendarIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Ngày đăng ký</p>
                <p className="text-sm font-medium dark:text-white">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
              <IdentificationIcon className="h-5 w-5 text-neutral-400" />
              <div>
                <p className="text-[10px] uppercase text-neutral-400">Tổng thanh toán</p>
                <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{(order.amount).toLocaleString()}đ</p>
              </div>
            </div>
            {order.assignedCardNo && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 dark:border-emerald-900/20 dark:bg-emerald-900/10 col-span-1 sm:col-span-2">
                <CreditCardIcon className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-[10px] uppercase text-emerald-500 font-bold">Mã thẻ đã gán</p>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 tracking-widest">{order.assignedCardNo}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-2">
            <span className="text-sm text-neutral-500">Trạng thái hiện tại: </span>
            {getStatusBadge(order.orderStatus)}
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="mt-8 space-y-4 border-t border-neutral-100 pt-6 dark:border-neutral-800">
        {order.orderStatus === 'PENDING_PAYMENT' && (
          <Button
            className="w-full shadow-lg shadow-blue-500/20 py-3"
            onClick={() => onConfirmPayment(order.id)}
            loading={actionLoading}
          >
            Xác nhận đã thanh toán
          </Button>
        )}

        {order.orderStatus === 'PAID' && (
          <div className="rounded-2xl bg-emerald-50/50 p-4 dark:bg-emerald-900/10">
            <label className="mb-2 block text-sm font-semibold text-neutral-800 dark:text-neutral-200">Gán mã thẻ vật lý cho khách</label>
            <div className="flex gap-3">
              <Input
                value={cardInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardInput(e.target.value)}
                placeholder="Mã thẻ ( proximity / barcode )..."
                className="bg-white dark:bg-neutral-900"
              />
              <Button
                onClick={() => onAssignCard(order.id, cardInput)}
                disabled={!cardInput.trim() || actionLoading}
                loading={actionLoading}
                color="emerald"
                className="shrink-0"
              >
                Gán thẻ & Hoàn tất
              </Button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">Mã thẻ sẽ dùng để check-in tại các cơ sở Nerd Society</p>
          </div>
        )}

        {['PENDING_PAYMENT', 'PAID'].includes(order.orderStatus) && (
          <Button
            outline
            className="w-full text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
            onClick={() => onCancelOrder(order.id)}
            disabled={actionLoading}
          >
            Hủy đơn đăng ký này
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <NcModal
      isOpenProp={!!order}
      onCloseModal={onClose}
      modalTitle={`Thông tin đơn đăng ký ${order.orderCode}`}
      renderContent={renderContent}
      contentExtraClass="max-w-3xl"
    />
  );
}
