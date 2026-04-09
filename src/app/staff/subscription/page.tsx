'use client';

/**
 * Staff Dashboard — Live View tại quầy (Tablet)
 * Phong cách: Đồng bộ với website (Light, Warm Beige Tones)
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============== TYPES ==============

interface ActiveSession {
  id: string;
  subscriberName: string;
  subscriberPhoto: string | null;
  planType: string;
  branch: string;
  checkInTime: string;
  durationSoFar: number;
  remainingMin: number | null;
  isUnlimited: boolean;
  staffVerified: boolean;
  needsVerification: boolean;
}

interface Warning {
  type: string;
  severity: string;
  message: string;
  sessionId?: string;
}

interface DashboardData {
  activeSessions: ActiveSession[];
  recentEvents: Array<{ id: string; action: string; details: Record<string, unknown>; createdAt: string }>;
  warnings: Warning[];
  stats: { activeCount: number; todayCheckIns: number; branch: string };
}

// ============== HELPERS ==============

const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Tuần LT',
  MONTHLY_LIMITED: 'Tháng LT',
  MONTHLY_UNLIMITED: 'Tháng UL',
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}m`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// ============== MAIN COMPONENT ==============

export default function StaffDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [branch, setBranch] = useState('HTM');
  const [showManualCheckin, setShowManualCheckin] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [flashEvent, setFlashEvent] = useState<{ name: string; type: string; plan: string; remaining: string; photo?: string | null } | null>(null);
  const [clock, setClock] = useState(new Date());

  // Clock update
  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/dashboard?branch=${branch}`);
      if (res.ok) {
        const newData = await res.json();

        // Flash animation for new check-in events
        if (data && newData.activeSessions.length > data.activeSessions.length) {
          const newest = newData.activeSessions[0];
          if (newest) {
            setFlashEvent({
              name: newest.subscriberName,
              type: 'CHECK_IN',
              plan: PLAN_LABELS[newest.planType] || newest.planType,
              remaining: newest.remainingMin ? formatDuration(newest.remainingMin) : '∞',
              photo: newest.subscriberPhoto,
            });
            setTimeout(() => setFlashEvent(null), 8000);
          }
        }

        setData(newData);
      }
    } catch (err) {
      console.error('[Staff] Fetch error:', err);
    }
  }, [branch, data]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10000); // Poll mỗi 10s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const handleVerify = async (sessionId: string, verified: boolean) => {
    setActionLoading(true);
    await fetch('/api/staff/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', sessionId, verified, staffName: 'staff' }),
    });
    setActionLoading(false);
    fetchDashboard();
  };

  const handleManualCheckin = async () => {
    if (!phoneInput.trim()) return;
    setActionLoading(true);
    const res = await fetch('/api/staff/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'manual_checkin', phone: phoneInput, branch, staffName: 'staff' }),
    });
    const result = await res.json();
    setActionLoading(false);
    setPhoneInput('');
    setShowManualCheckin(false);

    if (result.type === 'CHECK_IN') {
      setFlashEvent({
        name: result.subscriber?.fullName || phoneInput,
        type: 'MANUAL_CHECK_IN',
        plan: PLAN_LABELS[result.subscription?.planType] || '',
        remaining: result.remainingMin ? formatDuration(result.remainingMin) : '∞',
      });
      setTimeout(() => setFlashEvent(null), 8000);
    }
    fetchDashboard();
  };

  const handleManualCheckout = async (sessionId: string) => {
    setActionLoading(true);
    await fetch('/api/staff/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'manual_checkout', sessionId }),
    });
    setActionLoading(false);
    fetchDashboard();
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h15a3 3 0 013 3v1a3 3 0 01-3 3h-1.5M3 8v8a4 4 0 004 4h5a4 4 0 004-4v-3M3 8l1-4h13l1 4M7.5 8v1.5m4-1.5v1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-900">NERD SOCIETY — {branch === 'HTM' ? 'Hồ Tùng Mậu' : 'Tây Sơn'}</h1>
              <p className="text-xs text-neutral-400">Staff Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none"
            >
              <option value="HTM">📍 HTM</option>
              <option value="TS">📍 TS</option>
            </select>
            <span className="font-mono text-2xl font-bold tabular-nums text-primary-700">
              {clock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-4">
        {/* Flash Event Banner */}
        {flashEvent && (
          <div className="mb-4 rounded-3xl border-2 border-green-400 bg-green-50 p-5 animate-pulse">
            <div className="flex items-center gap-5">
              {flashEvent.photo ? (
                <img src={flashEvent.photo} alt="" className="h-16 w-16 rounded-2xl object-cover border-2 border-green-300 shadow" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-3xl">
                  ✅
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Vừa quẹt thẻ</p>
                <p className="text-xl font-bold text-neutral-900">{flashEvent.name}</p>
                <p className="text-sm text-neutral-500">
                  {flashEvent.plan} · Còn {flashEvent.remaining}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {data?.warnings && data.warnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.warnings.map((w, i) => (
              <div
                key={i}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  w.severity === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : w.severity === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {w.severity === 'error' ? '🔴' : w.severity === 'warning' ? '⚠️' : 'ℹ️'} {w.message}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mb-5 flex gap-4">
          <div className="flex-1 rounded-3xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-primary-700">{data?.stats.activeCount || 0}</p>
            <p className="text-xs text-neutral-400 mt-1">Đang ngồi</p>
          </div>
          <div className="flex-1 rounded-3xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-bold text-neutral-900">{data?.stats.todayCheckIns || 0}</p>
            <p className="text-xs text-neutral-400 mt-1">Check-in hôm nay</p>
          </div>
        </div>

        {/* Active Sessions */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Đang ngồi trong quán ({data?.activeSessions.length || 0} người)
          </h2>

          <div className="space-y-2">
            {data?.activeSessions.length === 0 && (
              <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-neutral-400 shadow-sm">
                Chưa có ai check-in
              </div>
            )}

            {data?.activeSessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition-all shadow-sm ${
                  session.needsVerification
                    ? 'border-amber-300 bg-amber-50/30'
                    : session.durationSoFar >= 450 && session.isUnlimited
                      ? 'border-red-200 bg-red-50/30'
                      : 'border-neutral-200'
                }`}
              >
                {/* Photo */}
                {session.subscriberPhoto ? (
                  <img
                    src={session.subscriberPhoto}
                    alt=""
                    className={`h-14 w-14 rounded-2xl object-cover border-2 shadow-sm flex-shrink-0 ${
                      session.needsVerification ? 'border-amber-400' : 'border-primary-200'
                    }`}
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 text-xl flex-shrink-0">
                    👤
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-neutral-900 truncate">{session.subscriberName}</p>
                  <p className="text-xs text-neutral-400">
                    {PLAN_LABELS[session.planType] || session.planType} ·
                    Vào {formatTime(session.checkInTime)} ·
                    <span className={session.durationSoFar >= 450 ? 'text-red-600 font-medium' : ''}>
                      {' '}{formatDuration(session.durationSoFar)}
                    </span>
                  </p>
                </div>

                {/* Remaining */}
                <div className="flex-shrink-0 text-right">
                  {session.remainingMin !== null ? (
                    <span className={`text-sm font-medium ${session.remainingMin <= 300 ? 'text-red-600' : 'text-neutral-500'}`}>
                      Còn {formatDuration(session.remainingMin)}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-primary-600">∞</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex gap-1.5">
                  {session.needsVerification && (
                    <>
                      <button
                        onClick={() => handleVerify(session.id, true)}
                        disabled={actionLoading}
                        className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        ✅ OK
                      </button>
                      <button
                        onClick={() => handleVerify(session.id, false)}
                        disabled={actionLoading}
                        className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50"
                      >
                        ❌
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleManualCheckout(session.id)}
                    disabled={actionLoading}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Out
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowManualCheckin(true)}
            className="flex-1 rounded-full border border-neutral-300 bg-white py-3.5 text-sm font-medium text-neutral-700 hover:border-primary-400 hover:bg-primary-50 transition-colors shadow-sm"
          >
            ➕ Check-in thủ công
          </button>
          <button
            onClick={() => fetchDashboard()}
            className="rounded-full border border-neutral-300 bg-white px-5 py-3.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors shadow-sm"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Manual Check-in Modal */}
      {showManualCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setShowManualCheckin(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl border border-neutral-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-neutral-900">Check-in thủ công</h3>
            <p className="mb-4 text-sm text-neutral-400">Nhập SĐT khách quên thẻ</p>
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="0987654321"
              autoFocus
              className="mb-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-lg tracking-wider text-neutral-900 focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowManualCheckin(false)}
                className="flex-1 rounded-full border border-neutral-300 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Hủy
              </button>
              <button
                onClick={handleManualCheckin}
                disabled={actionLoading || !phoneInput.trim()}
                className="flex-1 rounded-full bg-primary-500 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 hover:bg-primary-600 disabled:opacity-50"
              >
                {actionLoading ? '⏳' : '✅ Check-in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
