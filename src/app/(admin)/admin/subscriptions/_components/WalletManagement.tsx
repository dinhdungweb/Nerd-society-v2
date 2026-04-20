'use client';

import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Button } from '@/shared/Button';
import Input from '@/shared/Input';
import { Badge } from '@/shared/Badge';
import { BanknotesIcon, ArrowUpCircleIcon, UserIcon, WalletIcon } from '@heroicons/react/24/outline';
import { topUpWallet } from '@/lib/subscription/wallet-actions';
import { Subscriber } from './constants';
import NcModal from '@/shared/NcModal';

interface WalletManagementProps {
  subscribers: Subscriber[];
  onRefresh: () => void;
}

export default function WalletManagement({ subscribers, onRefresh }: WalletManagementProps) {
  const [showTopup, setShowTopup] = useState<{ id: string; name: string } | null>(null);
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
              <TableHeader className="pl-6">Thành viên</TableHeader>
              <TableHeader>Số dư Ví</TableHeader>
              <TableHeader>Công nợ quá giờ</TableHeader>
              <TableHeader className="pr-6 text-right">Hành động</TableHeader>
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
                  <TableCell className="pl-6">
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
                  <TableCell className="pr-6 text-right">
                    <Button 
                      outline
                      onClick={() => setShowTopup({ id: sub.id, name: sub.fullName })}
                      className="text-xs group-hover:border-primary-500 group-hover:text-primary-600 transition-all"
                    >
                      <ArrowUpCircleIcon className="mr-1 h-4 w-4" />
                      Nạp tiền
                    </Button>
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
    </div>
  );
}
