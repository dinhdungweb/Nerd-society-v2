'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Button } from '@/shared/Button';
import Input from '@/shared/Input';
import { Badge } from '@/shared/Badge';
import { BanknotesIcon, ArrowUpCircleIcon, UserIcon, WalletIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { topUpWallet, payOutstandingBalance, payDebtWithWallet } from '@/lib/subscription/wallet-actions';
import { Subscriber } from './constants';
import NcModal from '@/shared/NcModal';

interface WalletManagementProps {
  subscribers: Subscriber[];
  onRefresh: () => void;
}

export default function WalletManagement({ subscribers, onRefresh }: WalletManagementProps) {
  const [showTopup, setShowTopup] = useState<{ id: string; name: string } | null>(null);
  const [showPayDebt, setShowPayDebt] = useState<{ id: string; name: string; debt: number; wallet: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTopup = async () => {
    if (!showTopup || !amount) return;
    setLoading(true);
    try {
      const res = await topUpWallet(showTopup.id, parseInt(amount));
      if (res.success) {
        setShowTopup(null);
        setAmount('');
        onRefresh();
      } else {
        alert('Lỗi: ' + res.error);
      }
    } catch (err) {
      alert('Có lỗi xảy ra');
    }
    setLoading(false);
  };

  const handlePayDebtWithWallet = async () => {
    if (!showPayDebt) return;
    setLoading(true);
    try {
      const res = await payDebtWithWallet(showPayDebt.id);
      if (res.success) {
        setShowPayDebt(null);
        onRefresh();
      } else {
        alert('Lỗi: Không thể cấn trừ nợ');
      }
    } catch (err) {
      alert('Có lỗi xảy ra');
    }
    setLoading(false);
  };

  const handlePayDebtCash = async () => {
    if (!showPayDebt) return;
    setLoading(true);
    try {
      const res = await payOutstandingBalance(showPayDebt.id, showPayDebt.debt, 'CASH_PAYMENT');
      if (res.success) {
        setShowPayDebt(null);
        onRefresh();
      } else {
        alert('Lỗi: ' + res.error);
      }
    } catch (err) {
      alert('Có lỗi xảy ra');
    }
    setLoading(false);
  };

  const renderTopupContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
        <div className="rounded-full bg-primary-100 p-3 dark:bg-primary-900/20">
          <WalletIcon className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">Người nhận</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">{showTopup?.name}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Số tiền muốn nạp (VNĐ)
        </label>
        <div className="relative">
          <Input
            type="number"
            value={amount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            placeholder="Ví dụ: 100000"
            className="pl-10 text-lg font-bold"
            autoFocus
          />
          <BanknotesIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
        </div>
        <p className="text-xs text-neutral-500 italic">Số tiền này sẽ được cộng vào ví số dư của hội viên</p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          outline
          className="flex-1"
          onClick={() => setShowTopup(null)}
        >
          Hủy bỏ
        </Button>
        <Button
          className="flex-1"
          onClick={handleTopup}
          loading={loading}
          disabled={!amount || parseInt(amount) <= 0}
        >
          Xác nhận nạp tiền
        </Button>
      </div>
    </div>
  );

  const renderPayDebtContent = () => {
    if (!showPayDebt) return null;
    const canReconcile = showPayDebt.wallet > 0;
    const reconcileAmount = Math.min(showPayDebt.wallet, showPayDebt.debt);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/20">
          <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/40">
            <DocumentCheckIcon className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-600/80">Khách hàng đang nợ</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-500">{showPayDebt.debt.toLocaleString()}đ</p>
          </div>
        </div>

        <div className="space-y-4">
          {canReconcile ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/20 dark:bg-emerald-900/10">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-400">
                Ví khách đang có sẵn <strong>{showPayDebt.wallet.toLocaleString()}đ</strong>.
              </p>
              <p className="mt-1 text-xs text-emerald-600/80">
                Bạn có thể tự động cấn trừ <strong>{reconcileAmount.toLocaleString()}đ</strong> từ ví để trả nợ.
              </p>
              <Button
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handlePayDebtWithWallet}
                loading={loading}
              >
                Cấn trừ từ ví
              </Button>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Khách không có số dư trong ví. Cần thu tiền mặt hoặc chuyển khoản trực tiếp.
            </p>
          )}

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800/50 dark:bg-neutral-800/50">
             <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
               Khách trả tiền mặt / chuyển khoản
             </p>
             <p className="mt-1 text-xs text-neutral-500">
               Đánh dấu là đã thu đủ {showPayDebt.debt.toLocaleString()}đ bên ngoài hệ thống.
             </p>
             <Button
                outline
                className="mt-4 w-full"
                onClick={handlePayDebtCash}
                loading={loading}
              >
                Xác nhận đã thu {showPayDebt.debt.toLocaleString()}đ
              </Button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button outline onClick={() => setShowPayDebt(null)} disabled={loading}>Đóng</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Quản lý Ví tiền & Công nợ</h3>
          <p className="text-sm text-neutral-500">Theo dõi số dư ví và các khoản nợ quá giờ của hội viên</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Table dense striped>
          <TableHead>
            <TableRow>
              <TableHeader className="pl-8">Thành viên</TableHeader>
              <TableHeader>Số dư Ví</TableHeader>
              <TableHeader>Công nợ quá giờ</TableHeader>
              <TableHeader className="pr-8 text-right">Hành động</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-12 text-center text-neutral-400">Không có dữ liệu ví</TableCell>
              </TableRow>
            ) : (
              subscribers.map((sub) => (
                <TableRow key={sub.id} className="group">
                  <TableCell className="pl-8">
                     <div className="flex items-center gap-3">
                       <div className="rounded-full bg-neutral-100 p-2 dark:bg-neutral-800">
                         <UserIcon className="h-5 w-5 text-neutral-400" />
                       </div>
                       <div>
                         <p className="font-semibold text-neutral-900 dark:text-white">{sub.fullName}</p>
                         <p className="text-xs text-neutral-500">{sub.phone}</p>
                       </div>
                     </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {(sub.walletBalance || 0).toLocaleString()}đ
                      {sub.walletBalance > 0 && <span className="flex h-2 w-2 rounded-full bg-emerald-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-mono text-sm font-bold ${sub.outstandingBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-neutral-400'}`}>
                       {(sub.outstandingBalance || 0).toLocaleString()}đ
                    </div>
                  </TableCell>
                  <TableCell className="pr-8 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        outline
                        onClick={() => setShowTopup({ id: sub.id, name: sub.fullName })}
                        className="text-xs group-hover:border-primary-500 group-hover:text-primary-600 transition-all"
                      >
                        <ArrowUpCircleIcon className="mr-1 h-4 w-4" />
                        Nạp
                      </Button>
                      {sub.outstandingBalance > 0 && (
                        <Button 
                          outline
                          onClick={() => setShowPayDebt({ id: sub.id, name: sub.fullName, debt: sub.outstandingBalance, wallet: sub.walletBalance || 0 })}
                          className="text-xs group-hover:border-amber-500 group-hover:text-amber-600 transition-all border-amber-200 text-amber-600 dark:border-amber-900/50 dark:text-amber-500"
                        >
                          <DocumentCheckIcon className="mr-1 h-4 w-4" />
                          Thu nợ
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NcModal
        isOpenProp={!!showTopup}
        onCloseModal={() => setShowTopup(null)}
        renderContent={renderTopupContent}
        modalTitle="Nạp tiền vào ví hội viên"
        contentExtraClass="max-w-md"
      />

      <NcModal
        isOpenProp={!!showPayDebt}
        onCloseModal={() => setShowPayDebt(null)}
        renderContent={renderPayDebtContent}
        modalTitle={`Thu nợ quá giờ — ${showPayDebt?.name}`}
        contentExtraClass="max-w-md"
      />
    </div>
  );
}
