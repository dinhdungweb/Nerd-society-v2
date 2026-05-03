'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ClockIcon,
  ArrowDownTrayIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
} from '@heroicons/react/24/outline';
import NcModal from '@/shared/NcModal';
import { Badge } from '@/shared/Badge';
import { Button } from '@/shared/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';

interface SessionRecord {
  id: string;
  branch: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMin: number | null;
  source: string;
  status: string;
  overageMin: number;
  amountCharged: number;
  subscriber: {
    fullName: string;
    cardNo: string | null;
    phone: string;
  };
}

interface SessionHistoryModalProps {
  subscriberId: string | null;
  subscriberName: string;
  onClose: () => void;
}

export default function SessionHistoryModal({
  subscriberId,
  subscriberName,
  onClose,
}: SessionHistoryModalProps) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchSessions = useCallback(async () => {
    if (!subscriberId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await fetch(
        `/api/admin/subscriptions/subscribers/${subscriberId}/sessions?${params}`
      );
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error('Fetch sessions error:', err);
    }
    setLoading(false);
  }, [subscriberId, dateFrom, dateTo]);

  useEffect(() => {
    if (subscriberId) fetchSessions();
  }, [subscriberId, fetchSessions]);

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0) return `${h}h ${m}p`;
    return `${m}p`;
  };

  const exportCSV = () => {
    if (sessions.length === 0) return;

    const headers = [
      'Hội viên',
      'SĐT',
      'Mã thẻ',
      'Cơ sở',
      'Check-in',
      'Check-out',
      'Thời lượng (phút)',
      'Trạng thái',
      'Quá giờ (phút)',
      'Phí phát sinh (VNĐ)',
      'Nguồn',
    ];

    const rows = sessions.map((s) => [
      s.subscriber.fullName,
      s.subscriber.phone,
      s.subscriber.cardNo || '',
      s.branch,
      formatDateTime(s.checkInTime),
      s.checkOutTime ? formatDateTime(s.checkOutTime) : 'Đang ngồi',
      s.durationMin?.toString() || '',
      s.status === 'ACTIVE' ? 'Đang ngồi' : s.status === 'COMPLETED' ? 'Hoàn thành' : s.status,
      s.overageMin.toString(),
      s.amountCharged.toString(),
      s.source,
    ]);

    const csvContent =
      '\uFEFF' + // BOM for Excel UTF-8
      [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `lich-su-${subscriberName.replace(/\s+/g, '-')}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalDuration = sessions.reduce((acc, s) => acc + (s.durationMin || 0), 0);
  const totalCharged = sessions.reduce((acc, s) => acc + s.amountCharged, 0);

  const renderContent = () => (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-500">Từ ngày</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-neutral-500">Đến ngày</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <Button outline onClick={fetchSessions} className="text-sm">
          <CalendarDaysIcon className="mr-1 h-4 w-4" />
          Lọc
        </Button>
        <div className="flex-1" />
        <Button
          outline
          onClick={exportCSV}
          disabled={sessions.length === 0}
          className="text-sm text-emerald-600 hover:!border-emerald-500 hover:!text-emerald-700"
        >
          <ArrowDownTrayIcon className="mr-1 h-4 w-4" />
          Xuất CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
          <p className="text-[10px] font-bold uppercase text-neutral-400">Tổng phiên</p>
          <p className="mt-1 text-xl font-black text-neutral-900 dark:text-white">{sessions.length}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/20 dark:bg-blue-900/10">
          <p className="text-[10px] font-bold uppercase text-blue-500">Tổng thời lượng</p>
          <p className="mt-1 text-xl font-black text-blue-700 dark:text-blue-400">
            {totalDuration > 0 ? formatDuration(totalDuration) : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/20 dark:bg-amber-900/10">
          <p className="text-[10px] font-bold uppercase text-amber-500">Phí phát sinh</p>
          <p className="mt-1 text-xl font-black text-amber-700 dark:text-amber-400">
            {totalCharged > 0 ? `${totalCharged.toLocaleString()}đ` : '0đ'}
          </p>
        </div>
      </div>

      {/* Session Table */}
      <div className="max-h-[400px] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <Table dense striped>
          <TableHead>
            <TableRow>
              <TableHeader className="pl-4">Ngày</TableHeader>
              <TableHeader>
                <div className="flex items-center gap-1">
                  <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" /> Check-in
                </div>
              </TableHeader>
              <TableHeader>
                <div className="flex items-center gap-1">
                  <ArrowLeftStartOnRectangleIcon className="h-3.5 w-3.5" /> Check-out
                </div>
              </TableHeader>
              <TableHeader>Cơ sở</TableHeader>
              <TableHeader>Thời lượng</TableHeader>
              <TableHeader className="pr-4">Trạng thái</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-4"><div className="h-4 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-14 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-14 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-10 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell className="pr-4"><div className="h-5 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-neutral-400">
                    <ClockIcon className="h-8 w-8" />
                    <p>Không có lịch sử check-in nào</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4 text-xs font-medium text-neutral-500">
                    {new Date(s.checkInTime).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-neutral-900 dark:text-white">
                    {new Date(s.checkInTime).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-neutral-600 dark:text-neutral-400">
                    {s.checkOutTime
                      ? new Date(s.checkOutTime).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      {s.branch}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.durationMin ? (
                      <span className="text-sm font-mono font-medium text-primary-600 dark:text-primary-400">
                        {formatDuration(s.durationMin)}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    {s.status === 'ACTIVE' ? (
                      <Badge color="emerald">
                        <span className="flex items-center gap-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          Đang ngồi
                        </span>
                      </Badge>
                    ) : s.status === 'COMPLETED' ? (
                      <Badge color="zinc">Hoàn thành</Badge>
                    ) : (
                      <Badge color="amber">{s.status}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <NcModal
      isOpenProp={!!subscriberId}
      onCloseModal={onClose}
      modalTitle={`Lịch sử check-in — ${subscriberName}`}
      renderContent={renderContent}
      contentExtraClass="max-w-4xl"
    />
  );
}
