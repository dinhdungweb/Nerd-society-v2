'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { differenceInMinutes } from 'date-fns';
import toast from 'react-hot-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Badge } from '@/shared/Badge';
import {
  ArrowRightOnRectangleIcon,
  ClockIcon,
  MapPinIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

type ActiveSession = {
  id: string;
  branch: string;
  checkInTime: string;
  subscriber: {
    fullName: string;
  };
};

export default function LiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/sessions?status=ACTIVE');
      if (!response.ok) throw new Error('Could not fetch active sessions');

      const data = await response.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[LiveSessions] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 60000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleManualCheckout = async (session: ActiveSession) => {
    const confirmed = window.confirm(`Check-out thủ công cho ${session.subscriber.fullName}?`);
    if (!confirmed) return;

    setCheckoutLoadingId(session.id);
    try {
      const response = await fetch('/api/admin/subscriptions/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_checkout', sessionId: session.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Không thể check-out thủ công');
      }

      setSessions((current) => current.filter((item) => item.id !== session.id));
      toast.success(`Đã check-out ${session.subscriber.fullName}`);
      fetchSessions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể check-out thủ công';
      toast.error(message);
    } finally {
      setCheckoutLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Khách đang ngồi</h3>
          <p className="text-sm text-neutral-500">
            Danh sách hội viên đang sử dụng dịch vụ trực tuyến tại các cơ sở
          </p>
        </div>
        <Badge color="emerald" className="animate-pulse">
          {sessions.length} người trực tuyến
        </Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Table dense striped>
          <TableHead>
            <TableRow>
              <TableHeader className="pl-8">Hội viên</TableHeader>
              <TableHeader>Cơ sở</TableHeader>
              <TableHeader>Vào lúc</TableHeader>
              <TableHeader>Thời gian đã ngồi</TableHeader>
              <TableHeader className="pr-8 text-right">Thao tác</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-8">
                    <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </TableCell>
                  <TableCell className="pr-8">
                    <div className="ml-auto h-8 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  </TableCell>
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <UserCircleIcon className="h-10 w-10 text-neutral-300" />
                    <p className="text-neutral-400">Hiện tại không có ai đang ngồi</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="pl-8 font-semibold text-neutral-900 dark:text-white">
                    {session.subscriber.fullName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <MapPinIcon className="h-4 w-4" />
                      {session.branch}
                    </div>
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {new Date(session.checkInTime).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono font-medium text-primary-600 dark:text-primary-400">
                      <ClockIcon className="h-4 w-4" />
                      {Math.max(0, Math.floor(differenceInMinutes(new Date(), new Date(session.checkInTime))))} m
                    </div>
                  </TableCell>
                  <TableCell className="pr-8">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleManualCheckout(session)}
                        disabled={checkoutLoadingId === session.id}
                        title="Check-out thủ công"
                        className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <ArrowRightOnRectangleIcon className="h-4 w-4" />
                        {checkoutLoadingId === session.id ? 'Đang xử lý' : 'Check-out'}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
