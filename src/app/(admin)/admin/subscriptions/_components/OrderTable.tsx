'use client';

import React from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Badge } from '@/shared/Badge';
import { RegistrationOrder, PLAN_LABELS, STATUS_LABELS } from './constants';

interface OrderTableProps {
  orders: RegistrationOrder[];
  loading: boolean;
  onSelectOrder: (order: RegistrationOrder) => void;
}

export default function OrderTable({ orders, loading, onSelectOrder }: OrderTableProps) {
  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, color: 'zinc' };
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  if (!loading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 py-12 dark:border-neutral-700">
        <div className="rounded-full bg-neutral-100 p-4 dark:bg-neutral-800">
          <UserIcon className="h-8 w-8 text-neutral-400" />
        </div>
        <p className="mt-4 text-sm text-neutral-500">Chưa có đơn đăng ký nào được tìm thấy</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Table dense striped>
        <TableHead>
          <TableRow>
            <TableHeader>Mã đơn</TableHeader>
            <TableHeader>Khách hàng</TableHeader>
            <TableHeader>Gói dịch vụ</TableHeader>
            <TableHeader>Cơ sở</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Ngày đăng ký</TableHeader>
            <TableHeader className="text-right">Thao tác</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="space-y-1">
                      <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                      <div className="h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-6 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="ml-auto h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
              </TableRow>
            ))
          ) : (
            orders.map((order) => (
              <TableRow 
                key={order.id} 
                className="group cursor-pointer transition-colors" 
                onClick={() => onSelectOrder(order)}
              >
                <TableCell className="font-mono text-xs font-medium text-neutral-500">{order.orderCode}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <img 
                      src={order.selfieUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(order.fullName)}&background=random`} 
                      alt="" 
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-white transition-transform group-hover:scale-110 dark:ring-neutral-800"
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(order.fullName)}&background=random`;
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{order.fullName}</p>
                      <p className="text-xs text-neutral-500">{order.phone}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-neutral-700 dark:text-neutral-300">
                  {PLAN_LABELS[order.planType] || order.planType}
                </TableCell>
                <TableCell className="text-sm text-neutral-500">{order.branchPrimary}</TableCell>
                <TableCell>{getStatusBadge(order.orderStatus)}</TableCell>
                <TableCell className="text-xs text-neutral-500">
                  {new Date(order.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </TableCell>
                <TableCell className="text-right">
                  <button className="text-sm font-medium text-primary-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary-400">
                    Chi tiết
                  </button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
