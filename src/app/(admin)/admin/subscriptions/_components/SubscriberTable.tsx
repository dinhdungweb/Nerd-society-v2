'use client';

import React from 'react';
import { UserIcon, TrashIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Badge } from '@/shared/Badge';
import { Button } from '@/shared/Button';
import { Subscriber, PLAN_LABELS, STATUS_LABELS } from './constants';

interface SubscriberTableProps {
  subscribers: Subscriber[];
  loading: boolean;
  onDelete: (sub: Subscriber) => Promise<void>;
  actionLoading: boolean;
}

export default function SubscriberTable({ subscribers, loading, onDelete, actionLoading }: SubscriberTableProps) {
  const getStatusBadge = (status: string) => {
    const s = STATUS_LABELS[status] || { label: status, color: 'zinc' };
    return <Badge color={s.color}>{s.label}</Badge>;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Table dense striped>
        <TableHead>
          <TableRow>
            <TableHeader>Thành viên</TableHeader>
            <TableHeader>Liên hệ</TableHeader>
            <TableHeader>Gói hiện tại</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Thời lượng còn lại</TableHeader>
            <TableHeader className="text-right">Thao tác</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </div>
                </TableCell>
                <TableCell><div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-6 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                <TableCell><div className="ml-auto h-8 w-8 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" /></TableCell>
              </TableRow>
            ))
          ) : subscribers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-neutral-400">Không tìm thấy hội viên nào</TableCell>
            </TableRow>
          ) : (
            subscribers.map((sub) => {
              const currentSub = sub.subscriptions[0];
              const remaining = currentSub && currentSub.totalHoursMin
                ? Math.max(0, currentSub.totalHoursMin + currentSub.carriedHoursMin - currentSub.usedHoursMin)
                : null;

              return (
                <TableRow key={sub.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img 
                        src={sub.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.fullName)}&background=random`} 
                        alt="" 
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-white transition-shadow group-hover:shadow-md dark:ring-neutral-800"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.fullName)}&background=random`;
                        }}
                      />
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{sub.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-neutral-500">
                      <p>{sub.phone}</p>
                      {sub.email && <p className="text-[10px] opacity-70">{sub.email}</p>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {currentSub ? PLAN_LABELS[currentSub.planType] || currentSub.planType : '—'}
                  </TableCell>
                  <TableCell>
                    {currentSub ? getStatusBadge(currentSub.status) : getStatusBadge('EXPIRED')}
                  </TableCell>
                  <TableCell>
                    {remaining !== null ? (
                      <div className="flex items-center gap-1.5">
                        <ClockIcon className={`h-4 w-4 ${remaining <= 300 ? 'text-red-500' : 'text-neutral-400'}`} />
                        <span className={`text-sm font-medium ${remaining <= 300 ? 'text-red-600 dark:text-red-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                          {Math.round(remaining / 60)}h
                        </span>
                      </div>
                    ) : currentSub?.planType === 'MONTHLY_UNLIMITED' ? (
                      <Badge color="emerald">Vô hạn</Badge>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(sub); }}
                      disabled={actionLoading}
                      className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 disabled:opacity-50"
                      title="Xóa hội viên"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
