'use client'

import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  IdentificationIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  SignalIcon,
  UserGroupIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type LocationOption = { id: string; code: string; name: string }
type ActiveSession = {
  id: string
  subscriberName: string
  subscriberPhoto: string | null
  planType: string
  branch: string
  checkInTime: string
  durationSoFar: number
  remainingMin: number | null
  staffVerified: boolean
  needsVerification: boolean
}
type DashboardData = {
  activeSessions: ActiveSession[]
  warnings: Array<{
    type: string
    severity: 'warning' | 'error' | 'info'
    message: string
    sessionId?: string
  }>
  stats: { activeCount: number; todayCheckIns: number; branch: string }
}
type ScanResult = {
  code: string
  success: boolean
  message: string
  subscriberName?: string
  subscriberPhoto?: string | null
  planType?: string
  branch?: string
  durationMin?: number
  quotaMin?: number
  remainingMin?: number
  walletBalance?: number
  outstandingBalance?: number
  amountCharged?: number
  openSessionBranch?: string
}

const PLAN_LABELS: Record<string, string> = {
  WEEKLY_LIMITED: 'Tuần Limited',
  MONTHLY_LIMITED: 'Tháng Limited',
  MONTHLY_UNLIMITED: 'Tháng Unlimited',
  WALLET: 'Ví Nerd',
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`
}

function resultTone(code?: string) {
  if (code === 'CHECK_IN_SUCCESS' || code === 'VERIFIED') return 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
  if (code === 'CHECK_OUT_SUCCESS') return 'border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30'
  if (code === 'DUPLICATE_IGNORED') return 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800'
  if (code === 'TIMEOUT') return 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30'
  return 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30'
}

function resultIconTone(code?: string) {
  if (code === 'CHECK_IN_SUCCESS' || code === 'VERIFIED') return 'bg-emerald-600 text-white'
  if (code === 'CHECK_OUT_SUCCESS') return 'bg-sky-600 text-white'
  if (code === 'DUPLICATE_IGNORED') return 'bg-neutral-700 text-white'
  if (code === 'TIMEOUT') return 'bg-amber-500 text-white'
  return 'bg-red-600 text-white'
}

function resultLabel(code?: string) {
  const labels: Record<string, string> = {
    CHECK_IN_SUCCESS: 'Check-in thành công',
    CHECK_OUT_SUCCESS: 'Check-out thành công',
    DUPLICATE_IGNORED: 'Đã bỏ qua lượt quét lặp',
    BLOCK_CROSS_BRANCH: 'Đang mở session ở cơ sở khác',
    BLOCK_MEMBER_STATUS: 'Hội viên đang bị khóa',
    BLOCK_DEBT: 'Còn công nợ',
    BLOCK_EXPIRED: 'Gói đã hết hạn',
    BLOCK_DAILY_LIMIT: 'Đã hết quota',
    BLOCK_LOW_BALANCE: 'Số dư không đủ',
    INVALID_QR: 'QR không hợp lệ',
    REVOKED_QR: 'QR đã bị thu hồi',
    NO_ELIGIBLE_ACCOUNT: 'Không có tài khoản phù hợp',
    VERIFIED: 'Đã xác minh khách',
    TIMEOUT: 'Quá thời gian phản hồi',
    OFFLINE: 'Mất kết nối',
  }
  return labels[code || ''] || 'Không thể xử lý'
}

function resultIcon(code?: string) {
  if (code === 'CHECK_IN_SUCCESS' || code === 'CHECK_OUT_SUCCESS' || code === 'VERIFIED') return CheckCircleIcon
  if (code === 'DUPLICATE_IGNORED' || code === 'TIMEOUT') return ExclamationTriangleIcon
  return XCircleIcon
}

function resultSpeech(result: ScanResult) {
  if (result.code === 'CHECK_IN_SUCCESS') return 'Ghi nhận khách vào thành công.'
  if (result.code === 'CHECK_OUT_SUCCESS') return 'Ghi nhận khách ra thành công.'
  if (result.code === 'VERIFIED') return 'Xác minh khách thành công.'
  if (result.code === 'DUPLICATE_IGNORED') return 'Đã bỏ qua lượt quét lặp.'
  return `Quét mã thất bại... ${resultLabel(result.code)}.`
}

function selectVietnameseFemaleVoice(voices: SpeechSynthesisVoice[]) {
  const vietnameseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('vi'))
  const femaleNamePattern = /microsoft\s+an|\ban\b|hoai\s*my|hoài\s*my|female|woman|giọng nữ|google.*tiếng việt/i
  const maleNamePattern = /nam\s*minh|male|man|giọng nam/i

  return vietnameseVoices.find((voice) => femaleNamePattern.test(voice.name))
    || vietnameseVoices.find((voice) => !maleNamePattern.test(voice.name))
    || vietnameseVoices[0]
    || null
}

function speakResult(result: ScanResult, preferredVoice: SpeechSynthesisVoice | null) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return

  try {
    const speech = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(resultSpeech(result))
    utterance.lang = 'vi-VN'
    utterance.rate = 0.78
    utterance.pitch = 1.08
    utterance.volume = 1
    utterance.voice = preferredVoice
      || selectVietnameseFemaleVoice(speech.getVoices())
    speech.cancel()
    speech.speak(utterance)
  } catch {
    // Visual feedback remains available if speech synthesis is unavailable.
  }
}

async function sendScanRequest(payload: string, locationId: string, requestId: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)
  try {
    return await fetch('/api/staff/subscriptions/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, payload, locationId }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export default function StaffSubscriptionKiosk() {
  const router = useRouter()
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [locationId, setLocationId] = useState('')
  const [requestedBranch, setRequestedBranch] = useState('')
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string, fullName: string, phone: string, photoUrl: string | null }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [clock, setClock] = useState(new Date())
  const scanBuffer = useRef('')
  const lastKeyAt = useRef(0)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speechVoice = useRef<SpeechSynthesisVoice | null>(null)

  const location = locations.find((item) => item.id === locationId)

  useEffect(() => {
    const syncBranchFromUrl = () => {
      const branch = new URLSearchParams(window.location.search).get('branch')?.trim().toUpperCase() || ''
      setRequestedBranch(branch)
    }

    syncBranchFromUrl()
    window.addEventListener('popstate', syncBranchFromUrl)
    return () => window.removeEventListener('popstate', syncBranchFromUrl)
  }, [])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const selectVietnameseVoice = () => {
      speechVoice.current = selectVietnameseFemaleVoice(window.speechSynthesis.getVoices())
    }
    selectVietnameseVoice()
    const voiceReloadTimers = [250, 1_000, 2_500].map((delay) => setTimeout(selectVietnameseVoice, delay))
    window.speechSynthesis.addEventListener('voiceschanged', selectVietnameseVoice)
    return () => {
      voiceReloadTimers.forEach(clearTimeout)
      window.speechSynthesis.removeEventListener('voiceschanged', selectVietnameseVoice)
      window.speechSynthesis.cancel()
    }
  }, [])

  useEffect(() => {
    fetch('/api/staff/subscriptions/scan')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được cơ sở')
        return response.json()
      })
      .then((data) => {
        const availableLocations: LocationOption[] = data.locations || []
        const branchFromUrl = new URLSearchParams(window.location.search).get('branch')?.trim().toUpperCase() || ''
        const linkedLocation = availableLocations.find((item) => item.code.toUpperCase() === branchFromUrl)
        const assignedLocation = availableLocations.find((item) => item.id === data.assignedLocationId)
        const selectedLocation = linkedLocation || assignedLocation || availableLocations[0]
        const selectedBranch = selectedLocation?.code.toUpperCase() || ''

        setLocations(availableLocations)
        setRequestedBranch(selectedBranch)
        setLocationId(selectedLocation?.id || '')

        if (selectedBranch && selectedBranch !== branchFromUrl) {
          router.replace(`/staff/subscription?branch=${encodeURIComponent(selectedBranch)}`, { scroll: false })
        }
      })
      .catch(() => setScanResult({ code: 'OFFLINE', success: false, message: 'Không tải được cấu hình trạm quét.' }))
  }, [router])

  useEffect(() => {
    if (!requestedBranch || locations.length === 0) return
    const linkedLocation = locations.find((item) => item.code.toUpperCase() === requestedBranch)
    if (linkedLocation && linkedLocation.id !== locationId) setLocationId(linkedLocation.id)
  }, [locationId, locations, requestedBranch])

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const refreshDashboard = useCallback(async () => {
    if (!location?.code) return
    const response = await fetch(`/api/staff/dashboard?branch=${encodeURIComponent(location.code)}`)
    if (response.ok) setDashboard(await response.json())
  }, [location?.code])

  useEffect(() => {
    refreshDashboard()
    const timer = setInterval(refreshDashboard, 10_000)
    return () => clearInterval(timer)
  }, [refreshDashboard])

  const showResult = useCallback((result: ScanResult) => {
    setScanResult(result)
    speakResult(result, speechVoice.current)
    if (clearResultTimer.current) clearTimeout(clearResultTimer.current)
    clearResultTimer.current = setTimeout(() => setScanResult(null), 5_000)
  }, [])

  const submitScan = useCallback(async (payload: string) => {
    if (!locationId || scanLoading) return
    setScanLoading(true)
    const requestId = crypto.randomUUID()
    try {
      let response: Response | undefined
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await sendScanRequest(payload, locationId, requestId)
          break
        } catch (error) {
          lastError = error
        }
      }
      if (!response) throw lastError
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Không xử lý được lần quét')
      showResult(data)
      await refreshDashboard()
    } catch (error) {
      showResult({
        code: error instanceof DOMException && error.name === 'AbortError' ? 'TIMEOUT' : 'OFFLINE',
        success: false,
        message: error instanceof DOMException && error.name === 'AbortError'
          ? 'Chưa xác nhận được kết quả. Hãy kiểm tra danh sách session trước khi quét lại.'
          : error instanceof Error ? error.message : 'Mất kết nối backend. Chưa xác nhận được kết quả.',
      })
    } finally {
      setScanLoading(false)
    }
  }, [locationId, refreshDashboard, scanLoading, showResult])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) return

      const now = performance.now()
      if (now - lastKeyAt.current > 200) scanBuffer.current = ''
      lastKeyAt.current = now

      if (event.key === 'Enter') {
        const payload = scanBuffer.current.trim()
        scanBuffer.current = ''
        if (payload.startsWith('NS1.')) {
          event.preventDefault()
          void submitScan(payload)
        }
        return
      }
      if (event.key.length === 1) scanBuffer.current += event.key
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [submitScan])

  const manualCheckIn = async (checkInPhone: string) => {
    if (!checkInPhone.trim() || !location?.code) return
    setScanLoading(true)
    try {
      const response = await fetch('/api/staff/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_checkin', phone: checkInPhone.trim(), branch: location.code }),
      })
      const data = await response.json()
      showResult({ ...data, code: data.success ? 'CHECK_IN_SUCCESS' : data.errorType || 'MANUAL_ERROR' })
      if (data.success) {
        await refreshDashboard()
      }
    } finally {
      setScanLoading(false)
    }
  }

  const manualCheckOut = async (sessionId: string) => {
    setScanLoading(true)
    try {
      const response = await fetch('/api/staff/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual_checkout', sessionId }),
      })
      const data = await response.json()
      showResult({ ...data, code: data.success ? 'CHECK_OUT_SUCCESS' : data.errorType || 'MANUAL_ERROR' })
      await refreshDashboard()
    } finally {
      setScanLoading(false)
    }
  }

  const verifyCustomer = async (sessionId: string) => {
    setScanLoading(true)
    try {
      const response = await fetch('/api/staff/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', sessionId, verified: true }),
      })
      const data = await response.json()
      showResult({ ...data, code: data.success ? 'VERIFIED' : 'VERIFY_ERROR' })
      await refreshDashboard()
    } finally {
      setScanLoading(false)
    }
  }

  const ResultIcon = resultIcon(scanResult?.code)
  const visibleWarnings = dashboard?.warnings?.slice(0, 5) || []

  return (
    <main className="relative min-h-screen overflow-hidden bg-primary-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-primary-100/80 to-transparent dark:from-primary-950/30" />

      <header className="sticky top-0 z-30 border-b border-primary-200/80 bg-white/90 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm">
              <QrCodeIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-neutral-950 dark:text-white sm:text-lg">Nerd Society Check-in</h1>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">Trạm quét QR dành cho nhân viên</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <label className="relative hidden sm:block">
              <span className="sr-only">Cơ sở</span>
              <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary-700 dark:text-primary-300" />
              <select
                value={locationId}
                onChange={(event) => {
                  const nextLocation = locations.find((item) => item.id === event.target.value)
                  if (!nextLocation) return
                  const nextBranch = nextLocation.code.toUpperCase()
                  setLocationId(nextLocation.id)
                  setRequestedBranch(nextBranch)
                  router.push(`/staff/subscription?branch=${encodeURIComponent(nextBranch)}`, { scroll: false })
                }}
                className="h-10 appearance-none rounded-xl border border-primary-200 bg-primary-50 pl-9 pr-8 text-sm font-semibold text-neutral-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
                ))}
              </select>
            </label>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900">
              <ClockIcon className="size-4 text-neutral-400" />
              <time className="font-mono text-sm font-semibold tabular-nums sm:text-base">
                {clock.toLocaleTimeString('vi-VN')}
              </time>
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-4 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPinIcon className="size-4 text-primary-700" />
            {location?.code || 'Chưa chọn cơ sở'}
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section
              aria-live="polite"
              className={'overflow-hidden rounded-3xl border shadow-sm transition-colors ' + (scanResult ? resultTone(scanResult.code) : 'border-primary-200 bg-white dark:border-neutral-800 dark:bg-neutral-900')}
            >
              {scanResult ? (
                <>
                  <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10 sm:px-7">
                    <div className="flex items-center gap-3">
                      <div className={'flex size-10 items-center justify-center rounded-xl ' + resultIconTone(scanResult.code)}>
                        <ResultIcon className="size-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-neutral-950 dark:text-white">{resultLabel(scanResult.code)}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Kết quả sẽ tự đóng sau 5 giây</p>
                      </div>
                    </div>
                    <span className="hidden rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-neutral-600 dark:border-white/10 dark:bg-neutral-900/50 dark:text-neutral-300 sm:inline-flex">
                      {location?.code}
                    </span>
                  </div>

                  <div className="flex min-h-64 flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-7">
                    {scanResult.subscriberPhoto ? (
                      <img
                        src={scanResult.subscriberPhoto}
                        alt="Ảnh hội viên"
                        className="size-28 shrink-0 rounded-2xl border-4 border-white object-cover shadow-md dark:border-neutral-800 sm:size-32"
                      />
                    ) : (
                      <div className="flex size-28 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 sm:size-32">
                        <UserIcon className="size-8" />
                        <span className="mt-2 text-center text-[11px] font-bold uppercase tracking-wide">Cần xác minh ảnh</span>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-2xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-4xl">
                        {scanResult.subscriberName || 'Không nhận diện được khách'}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-neutral-600 dark:text-neutral-300 sm:text-base">
                        {scanResult.message}
                      </p>

                      <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {scanResult.planType && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Gói sử dụng</dt>
                            <dd className="mt-0.5 text-sm font-bold">{PLAN_LABELS[scanResult.planType] || scanResult.planType}</dd>
                          </div>
                        )}
                        {scanResult.quotaMin !== undefined && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Quota</dt>
                            <dd className="mt-0.5 text-sm font-bold">{formatDuration(scanResult.quotaMin)}</dd>
                          </div>
                        )}
                        {scanResult.remainingMin !== undefined && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Còn lại</dt>
                            <dd className="mt-0.5 text-sm font-bold">{formatDuration(scanResult.remainingMin)}</dd>
                          </div>
                        )}
                        {scanResult.durationMin !== undefined && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Thời gian sử dụng</dt>
                            <dd className="mt-0.5 text-sm font-bold">{formatDuration(scanResult.durationMin)}</dd>
                          </div>
                        )}
                        {scanResult.walletBalance !== undefined && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Số dư Ví Nerd</dt>
                            <dd className="mt-0.5 text-sm font-bold">{scanResult.walletBalance.toLocaleString('vi-VN')}đ</dd>
                          </div>
                        )}
                        {scanResult.amountCharged !== undefined && scanResult.amountCharged > 0 && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Phí phát sinh</dt>
                            <dd className="mt-0.5 text-sm font-bold">{scanResult.amountCharged.toLocaleString('vi-VN')}đ</dd>
                          </div>
                        )}
                        {scanResult.openSessionBranch && (
                          <div className="rounded-xl border border-black/5 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-neutral-900/50">
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Session đang mở</dt>
                            <dd className="mt-0.5 text-sm font-bold">{scanResult.openSessionBranch}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[340px] flex-col items-center justify-center px-6 py-10 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-3xl bg-primary-300/30" />
                    <div className="relative flex size-20 items-center justify-center rounded-3xl bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                      {scanLoading ? <ArrowPathIcon className="size-9 animate-spin" /> : <QrCodeIcon className="size-10" />}
                    </div>
                  </div>
                  <h2 className="mt-6 text-2xl font-bold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">
                    {scanLoading ? 'Đang xử lý mã QR' : 'Sẵn sàng quét QR'}
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                    <span className="block">Đưa mã QR của khách vào máy quét.</span>
                    <span className="block">Hệ thống sẽ tự động check-in hoặc check-out.</span>
                  </p>
                  <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-800 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-300">
                    <SignalIcon className="size-4" />
                    Scanner USB HID · {location?.code || 'Chưa chọn cơ sở'}
                  </div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-col gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <UserGroupIcon className="size-5 text-primary-700 dark:text-primary-300" />
                    <h2 className="font-bold text-neutral-950 dark:text-white">Khách đang sử dụng không gian</h2>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">Cập nhật tự động mỗi 10 giây</p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                  {dashboard?.stats.activeCount || 0} session đang mở
                </span>
              </div>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {dashboard?.activeSessions.map((session) => (
                  <article key={session.id} className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-primary-50/60 dark:hover:bg-neutral-800/60 sm:flex-row sm:items-center sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      {session.subscriberPhoto ? (
                        <img src={session.subscriberPhoto} alt="" className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700" />
                      ) : (
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                          <UserIcon className="size-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-bold text-neutral-950 dark:text-white">{session.subscriberName}</p>
                          {session.needsVerification && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Chờ xác minh</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {PLAN_LABELS[session.planType] || session.planType} · Vào lúc {new Date(session.checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · Đã dùng {formatDuration(session.durationSoFar)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                      {session.needsVerification && (
                        <button
                          disabled={scanLoading}
                          onClick={() => void verifyCustomer(session.id)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                          <ShieldCheckIcon className="size-4" />
                          Xác minh
                        </button>
                      )}
                      <button
                        disabled={scanLoading}
                        onClick={() => void manualCheckOut(session.id)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                      >
                        <ArrowRightStartOnRectangleIcon className="size-4" />
                        Check-out
                      </button>
                    </div>
                  </article>
                ))}
                {dashboard?.activeSessions.length === 0 && (
                  <div className="flex min-h-36 flex-col items-center justify-center px-6 py-10 text-center">
                    <UserGroupIcon className="size-8 text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-3 text-sm font-medium text-neutral-500">Hiện chưa có session nào đang mở</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-primary-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                  <UserGroupIcon className="size-5" />
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">{dashboard?.stats.activeCount || 0}</p>
                <p className="mt-1 text-xs font-medium text-neutral-500">Đang sử dụng</p>
              </div>
              <div className="rounded-2xl border border-primary-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
                  <IdentificationIcon className="size-5" />
                </div>
                <p className="mt-4 text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">{dashboard?.stats.todayCheckIns || 0}</p>
                <p className="mt-1 text-xs font-medium text-neutral-500">Check-in hôm nay</p>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <SignalIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">Trạm quét đang hoạt động</p>
                  <p className="truncate text-xs text-neutral-500">USB HID · {location?.code || 'Chưa cấu hình'}</p>
                </div>
                <span className="ml-auto size-2.5 rounded-full bg-emerald-500" />
              </div>
            </div>

            {visibleWarnings.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">Cần lưu ý</h2>
                </div>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {visibleWarnings.map((warning, index) => {
                    const WarningIcon = warning.severity === 'info' ? InformationCircleIcon : ExclamationTriangleIcon
                    return (
                      <div key={warning.type + index} className="flex gap-3 px-4 py-3">
                        <WarningIcon className={'mt-0.5 size-4 shrink-0 ' + (warning.severity === 'error' ? 'text-red-600' : warning.severity === 'warning' ? 'text-amber-600' : 'text-sky-600')} />
                        <p className="text-xs font-medium leading-5 text-neutral-600 dark:text-neutral-300">{warning.message}</p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-primary-200 bg-primary-100/60 p-5 dark:border-primary-900 dark:bg-primary-950/30">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-800 shadow-sm dark:bg-neutral-900 dark:text-primary-300">
                  <MagnifyingGlassIcon className="size-5" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">Check-in dự phòng</h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                    Tìm khách bằng số điện thoại hoặc tên khi QR không sử dụng được.
                  </p>
                </div>
              </div>

              <div className="relative mt-4">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Nhập tên hoặc số điện thoại..."
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value
                    setSearchQuery(val)
                    if (searchTimeout.current) clearTimeout(searchTimeout.current)
                    if (!val.trim()) {
                      setSearchResults([])
                      setIsSearching(false)
                      return
                    }
                    setIsSearching(true)
                    searchTimeout.current = setTimeout(async () => {
                      try {
                        const res = await fetch('/api/staff/dashboard', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ action: 'search_subscriber', query: val.trim() }),
                        })
                        const data = await res.json()
                        if (data.subscribers) setSearchResults(data.subscribers)
                      } finally {
                        setIsSearching(false)
                      }
                    }, 300)
                  }}
                  className="h-10 w-full rounded-xl border border-primary-200 bg-white pl-9 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                />

                {searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                    {isSearching ? (
                      <div className="p-3 text-center text-xs text-neutral-500">Đang tìm...</div>
                    ) : searchResults.length > 0 ? (
                      <ul className="max-h-60 overflow-y-auto">
                        {searchResults.map(sub => (
                          <li key={sub.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('')
                                setSearchResults([])
                                void manualCheckIn(sub.phone)
                              }}
                              className="flex w-full items-center gap-3 border-b border-neutral-100 p-2 text-left transition hover:bg-primary-50 last:border-0 dark:border-neutral-800 dark:hover:bg-neutral-800"
                            >
                              {sub.photoUrl ? (
                                <img src={sub.photoUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                              ) : (
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
                                  <UserIcon className="size-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{sub.fullName}</p>
                                <p className="truncate text-xs text-neutral-500">{sub.phone}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 text-center text-xs text-neutral-500">Không tìm thấy kết quả.</div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
