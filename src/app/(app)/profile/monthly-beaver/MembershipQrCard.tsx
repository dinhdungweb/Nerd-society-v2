'use client'

import { ArrowDownTrayIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { QRCodeSVG } from 'qrcode.react'
import { useRef } from 'react'
import { printMembershipQr } from '@/lib/print-membership-qr'

export default function MembershipQrCard({ payload, memberName }: { payload: string; memberName: string }) {
  const container = useRef<HTMLDivElement>(null)

  const download = () => {
    const svg = container.current?.querySelector('svg')
    if (!svg) return
    const source = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `nerd-society-${memberName.replace(/\s+/g, '-').toLowerCase()}-qr.svg`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const printQr = () => {
    const svg = container.current?.querySelector('svg')
    if (!svg) return
    printMembershipQr({ svg, memberName })
  }

  return (
    <div>
      <div ref={container} className="mx-auto w-fit max-w-full bg-white p-2">
        <QRCodeSVG value={payload} size={168} level="M" marginSize={1} className="h-auto max-w-full" />
      </div>

      <p className="mx-auto mt-2 max-w-[230px] text-center text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        Quét tại quầy để ghi nhận khách vào hoặc khách ra. Không chia sẻ mã.
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
        >
          <ArrowDownTrayIcon className="size-4" />
          Tải QR
        </button>
        <button
          type="button"
          onClick={printQr}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-950/40"
        >
          <PrinterIcon className="size-4" />
          In QR
        </button>
      </div>
    </div>
  )
}
