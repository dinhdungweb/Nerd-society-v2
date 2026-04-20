'use client';

import React, { useState, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table';
import { Badge } from '@/shared/Badge';
import { UserCircleIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function LiveSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = () => {
      fetch('/api/admin/subscriptions/sessions?status=ACTIVE')
        .then(r => r.json())
        .then(setSessions)
        .finally(() => setLoading(false));
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 60000); // Làm mới mỗi phút
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Khách đang ngồi</h3>
          <p className="text-sm text-neutral-500">Danh sách hội viên đang sử dụng dịch vụ trực tuyến tại các cơ sở</p>
        </div>
        <Badge color="emerald" className="animate-pulse">
           {sessions.length} Người trực tuyến
        </Badge>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Table dense striped>
          <TableHead>
            <TableRow>
              <TableHeader>Công dân hội viên</TableHeader>
              <TableHeader>Cơ sở</TableHeader>
              <TableHeader>Vào lúc</TableHeader>
              <TableHeader>Thời gian đã ngồi</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                  <TableCell><div className="h-4 w-12 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" /></TableCell>
                </TableRow>
              ))
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <UserCircleIcon className="h-10 w-10 text-neutral-300" />
                    <p className="text-neutral-400">Hiện tại không có ai đang ngồi</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-semibold text-neutral-900 dark:text-white">
                    {s.subscriber.fullName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <MapPinIcon className="h-4 w-4" />
                      {s.branch}
                    </div>
                  </TableCell>
                  <TableCell className="text-neutral-500">
                    {new Date(s.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-mono font-medium">
                      <ClockIcon className="h-4 w-4" />
                      {Math.floor(differenceInMinutes(new Date(), new Date(s.checkInTime)))} m
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
