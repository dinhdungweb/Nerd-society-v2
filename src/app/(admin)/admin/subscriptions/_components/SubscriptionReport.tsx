'use client';

import React, { useState, useEffect } from 'react';
import { PLAN_LABELS } from './constants';
import { UserGroupIcon, ClipboardDocumentListIcon, CurrencyDollarIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

export default function SubscriptionReport() {
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

  if (!report) {
    return (
      <div className="grid gap-6 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
    );
  }

  const stats = [
    { 
      label: 'Subscriber Active', 
      value: report.activeSubs, 
      icon: UserGroupIcon, 
      color: 'blue',
      description: 'Hội viên đang kích hoạt'
    },
    { 
      label: 'Đơn mới tháng này', 
      value: report.newOrders, 
      icon: ClipboardDocumentListIcon, 
      color: 'emerald',
      description: 'Đơn đăng ký mới tạo'
    },
    { 
      label: 'Tổng doanh thu', 
      value: `${(report.totalRevenue).toLocaleString()}đ`, 
      icon: CurrencyDollarIcon, 
      color: 'amber',
      description: 'Doanh thu từ gói tháng này'
    },
    { 
      label: 'Sessions tháng này', 
      value: report.totalSessions, 
      icon: RocketLaunchIcon, 
      color: 'purple',
      description: 'Lượt check-in thành viên'
    },
  ];

  const getColorClasses = (color: string) => {
    const maps: Record<string, string> = {
      blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800',
      emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800',
      amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-800',
      purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-800',
    };
    return maps[color] || maps.blue;
  };

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div 
            key={item.label} 
            className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm transition-all hover:shadow-md ${getColorClasses(item.color)}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider opacity-80">{item.label}</p>
                <h3 className="mt-1 text-2xl font-black">{item.value}</h3>
              </div>
              <div className="rounded-2xl bg-white/50 p-3 dark:bg-neutral-800/50">
                <item.icon className="h-6 w-6" />
              </div>
            </div>
            <p className="mt-4 text-xs opacity-70">{item.description}</p>
            {/* Background Decoration */}
            <div className="absolute -bottom-4 -right-4 h-20 w-20 opacity-10">
              <item.icon className="h-full w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Plan Distribution */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-6 text-lg font-bold text-neutral-900 dark:text-white">Phân bổ theo gói hội viên</h3>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {report.byPlan.map((p) => {
            const totalCount = report.byPlan.reduce((acc, curr) => acc + curr.count, 0);
            const percentage = totalCount > 0 ? (p.count / totalCount) * 100 : 0;
            
            return (
              <div key={p.plan} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {PLAN_LABELS[p.plan] || p.plan}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    {p.count} <span className="text-xs font-normal text-neutral-400">({Math.round(percentage)}%)</span>
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div 
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-1000"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
