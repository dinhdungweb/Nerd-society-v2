'use client'

import { ClockIcon, ListBulletIcon, QrCodeIcon, TrashIcon } from '@heroicons/react/24/outline'
import { QRCodeSVG } from 'qrcode.react'
import { useRef, useState } from 'react'
import { printMembershipQr } from '@/lib/print-membership-qr'
import { Badge } from '@/shared/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/table'
import { PLAN_LABELS, STATUS_LABELS, type Subscriber } from './constants'

interface Props {
  subscribers: Subscriber[]
  loading: boolean
  onDelete: (subscriber: Subscriber) => Promise<void>
  onViewHistory: (subscriber: Subscriber) => void
  onReassignCard?: (subscriber: Subscriber, newCardNo: string) => Promise<void>
  actionLoading: boolean
}

export default function SubscriberTable({ subscribers, loading, onDelete, onViewHistory, actionLoading }: Props) {
  const [qrData, setQrData] = useState<{ subscriber: Subscriber; payload: string } | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const openQr = async (subscriber: Subscriber) => {
    setQrLoading(true)
    const response = await fetch(`/api/admin/subscriptions/subscribers/${subscriber.id}/qr`)
    const data = await response.json()
    setQrLoading(false)
    if (!response.ok) return alert(data.error || 'Không thể cấp QR')
    setQrData({ subscriber, payload: data.payload })
  }

  const rotateQr = async () => {
    if (!qrData || !confirm('QR cũ sẽ ngừng hoạt động ngay. Tiếp tục cấp lại?')) return
    setQrLoading(true)
    const response = await fetch(`/api/admin/subscriptions/subscribers/${qrData.subscriber.id}/qr`, { method: 'POST' })
    const data = await response.json()
    setQrLoading(false)
    if (!response.ok) return alert(data.error || 'Không thể cấp lại QR')
    setQrData({ ...qrData, payload: data.payload })
  }

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !qrData) return
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `member-${qrData.subscriber.phone}-qr.svg`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const printQr = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !qrData) return
    printMembershipQr({
      svg,
      memberName: qrData.subscriber.fullName,
      phone: qrData.subscriber.phone,
    })
  }

  const statusBadge = (status: string) => {
    const value = STATUS_LABELS[status] || { label: status, color: 'zinc' }
    return <Badge color={value.color}>{value.label}</Badge>
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Table dense striped>
        <TableHead>
          <TableRow>
            <TableHeader className="pl-8">Thành viên</TableHeader>
            <TableHeader>Cơ sở</TableHeader>
            <TableHeader>Liên hệ</TableHeader>
            <TableHeader>Gói hiện tại</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Quota</TableHeader>
            <TableHeader className="text-right">Công nợ</TableHeader>
            <TableHeader className="pr-8 text-right">Thao tác</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={8} className="py-12 text-center text-neutral-400">Đang tải…</TableCell></TableRow>
          ) : subscribers.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="py-12 text-center text-neutral-400">Không tìm thấy hội viên</TableCell></TableRow>
          ) : subscribers.map((subscriber) => {
            const subscription = subscriber.subscriptions[0]
            const remaining = subscription?.totalHoursMin
              ? Math.max(0, subscription.totalHoursMin + subscription.carriedHoursMin - subscription.usedHoursMin)
              : subscription?.dailyLimitMin
                ? Math.max(0, subscription.dailyLimitMin - (subscriber.todayUsedMin || 0))
                : null
            return (
              <TableRow key={subscriber.id}>
                <TableCell className="pl-8">
                  <div className="flex items-center gap-3">
                    <img src={subscriber.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(subscriber.fullName)}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                    <span className="font-semibold dark:text-white">{subscriber.fullName}</span>
                  </div>
                </TableCell>
                <TableCell><span className="font-mono text-sm">{subscriber.branchPrimary || '—'}</span></TableCell>
                <TableCell><p className="text-sm">{subscriber.phone}</p><p className="text-xs text-neutral-400">{subscriber.email}</p></TableCell>
                <TableCell>{subscription ? PLAN_LABELS[subscription.planType] || subscription.planType : 'Ví Nerd'}</TableCell>
                <TableCell>{subscription ? statusBadge(subscription.status) : statusBadge('NO_SUBSCRIPTION')}</TableCell>
                <TableCell>{remaining === null ? '—' : <span className="flex items-center gap-1 text-sm"><ClockIcon className="h-4 w-4" />{Math.floor(remaining / 60)}h {remaining % 60}m</span>}</TableCell>
                <TableCell className="text-right font-bold text-red-600">{subscriber.outstandingBalance ? `${subscriber.outstandingBalance.toLocaleString('vi-VN')}đ` : '—'}</TableCell>
                <TableCell className="pr-8">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => void openQr(subscriber)} disabled={actionLoading || qrLoading} title="Cấp / in QR" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><QrCodeIcon className="h-5 w-5" /></button>
                    <button onClick={() => onViewHistory(subscriber)} title="Lịch sử" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50"><ListBulletIcon className="h-5 w-5" /></button>
                    <button onClick={() => void onDelete(subscriber)} disabled={actionLoading} title="Xóa" className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><TrashIcon className="h-5 w-5" /></button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQrData(null)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl dark:bg-neutral-900" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-xl font-black dark:text-white">QR của {qrData.subscriber.fullName}</h3>
            <p className="mt-1 text-sm text-neutral-500">{qrData.subscriber.phone}</p>
            <div ref={qrRef} className="mx-auto mt-5 inline-block rounded-2xl border bg-white p-4">
              <QRCodeSVG value={qrData.payload} size={230} level="M" marginSize={1} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={downloadQr} className="rounded-xl border border-neutral-300 px-3 py-2 font-bold">Tải QR</button>
              <button onClick={printQr} className="rounded-xl border border-neutral-300 px-3 py-2 font-bold">In QR</button>
              <button disabled={qrLoading} onClick={() => void rotateQr()} className="col-span-2 rounded-xl bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-50">Cấp lại và vô hiệu QR cũ</button>
              <button onClick={() => setQrData(null)} className="col-span-2 rounded-xl bg-neutral-100 px-3 py-2 font-bold">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
