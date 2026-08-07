'use client'

import { saveNerdNightPaymentConfig } from '@/actions/admin-nerd-night'
import { buildNerdNightQrUrl } from '@/lib/nerd-night/format'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import toast from 'react-hot-toast'

export default function NerdNightPaymentSettings({ initial }: { initial: { bankCode: string; accountNumber: string; accountName: string } }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [config, setConfig] = useState(initial)
  const qrUrl = config.bankCode && config.accountNumber && config.accountName ? buildNerdNightQrUrl({ ...config, amount: 120000, content: 'NN S1E01 DEMO' }) : ''

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveNerdNightPaymentConfig({ bankCode: String(formData.get('bankCode')), accountNumber: String(formData.get('accountNumber')), accountName: String(formData.get('accountName')) })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Đã lưu tài khoản nhận tiền Nerd Night')
      router.refresh()
    })
  }

  return <div className="mx-auto max-w-3xl space-y-6"><div><Link href="/admin/nerd-night" className="text-sm text-neutral-500">← Nerd Night</Link><h1 className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">Cấu hình VietQR Nerd Night</h1><p className="mt-1 text-neutral-500">Cấu hình này độc lập với Booking và Monthly Beaver. Vé mới sẽ lưu snapshot tài khoản tại thời điểm đăng ký.</p></div><div className="grid gap-6 rounded-2xl border border-neutral-200 bg-white p-6 md:grid-cols-[1fr_240px] dark:border-neutral-800 dark:bg-neutral-900"><form action={submit} className="space-y-4"><Field label="Mã ngân hàng"><input name="bankCode" value={config.bankCode} onChange={(e) => setConfig({ ...config, bankCode: e.target.value.toUpperCase() })} placeholder="BIDV" required /></Field><Field label="Số tài khoản"><input name="accountNumber" value={config.accountNumber} onChange={(e) => setConfig({ ...config, accountNumber: e.target.value })} required /></Field><Field label="Tên chủ tài khoản"><input name="accountName" value={config.accountName} onChange={(e) => setConfig({ ...config, accountName: e.target.value.toUpperCase() })} required /></Field><button disabled={pending} className="w-full rounded-xl bg-primary-600 px-5 py-3 font-medium text-white disabled:opacity-50">{pending ? 'Đang lưu...' : 'Lưu cấu hình'}</button></form><div className="text-center"><p className="mb-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">QR xem trước · 120.000đ</p>{qrUrl ? <img src={qrUrl} alt="Xem trước VietQR" className="mx-auto size-56 rounded-xl border border-neutral-200 bg-white object-contain" /> : <div className="flex size-56 items-center justify-center rounded-xl bg-neutral-100 text-sm text-neutral-400">Nhập đủ thông tin</div>}<p className="mt-3 font-mono text-xs text-neutral-500">NN S1E01 DEMO</p></div></div></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}<span className="mt-1 block [&>input]:w-full [&>input]:rounded-lg [&>input]:border-neutral-300 [&>input]:bg-transparent dark:[&>input]:border-neutral-700">{children}</span></label> }
