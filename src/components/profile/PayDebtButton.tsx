'use client'

import { payOwnDebtWithWallet } from '@/actions/wallet-actions'
import { ArrowPathIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

type PayDebtButtonProps = {
  outstandingBalance: number
  walletBalance: number
}

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`
}

export default function PayDebtButton({ outstandingBalance, walletBalance }: PayDebtButtonProps) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const payableAmount = Math.min(outstandingBalance, walletBalance)
  const canPay = outstandingBalance > 0 && payableAmount > 0

  const handlePayDebt = async () => {
    if (!canPay || paying) return

    const isPartialPayment = payableAmount < outstandingBalance
    const confirmed = window.confirm(
      isPartialPayment
        ? `Số dư ví hiện tại chỉ đủ thanh toán ${formatMoney(payableAmount)}. Bạn có muốn thanh toán một phần công nợ không?`
        : `Xác nhận thanh toán toàn bộ công nợ ${formatMoney(outstandingBalance)} bằng Ví Nerd?`
    )
    if (!confirmed) return

    setPaying(true)
    try {
      const result = await payOwnDebtWithWallet()
      if (!result.success) {
        toast.error(result.error || 'Không thể thanh toán công nợ')
        return
      }

      if (result.remainingDebt > 0) {
        toast.success(
          `Đã thanh toán ${formatMoney(result.paidAmount)}. Công nợ còn lại ${formatMoney(result.remainingDebt)}.`
        )
      } else {
        toast.success('Đã thanh toán toàn bộ công nợ Monthly Beaver')
      }
      router.refresh()
    } catch {
      toast.error('Có lỗi xảy ra khi thanh toán công nợ')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handlePayDebt}
        disabled={!canPay || paying}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {paying ? <ArrowPathIcon className="size-4 animate-spin" /> : <BanknotesIcon className="size-4" />}
        {paying
          ? 'Đang thanh toán...'
          : canPay
            ? `Thanh toán ${formatMoney(payableAmount)}`
            : 'Nạp tiền để thanh toán công nợ'}
      </button>
      {walletBalance > 0 && walletBalance < outstandingBalance && (
        <p className="mt-2 text-xs text-red-200">
          Ví hiện có {formatMoney(walletBalance)}; hệ thống sẽ thanh toán một phần công nợ.
        </p>
      )}
    </div>
  )
}
