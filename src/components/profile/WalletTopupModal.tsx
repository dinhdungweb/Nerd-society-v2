'use client'

import { ArrowPathIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

interface WalletTopupModalProps {
    walletCode?: string | null
    legacyEmpId?: string | null
    bankConfig: {
        bankCode: string
        accountNumber: string
        accountName: string
    }
    buttonLabel?: string
}

interface QRData {
    qrUrl: string
    bankCode: string
    accountNumber: string
    accountName: string
    description: string
}

export default function WalletTopupModal({
    walletCode,
    legacyEmpId,
    bankConfig: initialBankConfig,
    buttonLabel = 'Nạp tiền vào Ví',
}: WalletTopupModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [loadingQR, setLoadingQR] = useState(false)
    const [qrData, setQrData] = useState<QRData | null>(null)
    const router = useRouter()

    const query = useMemo(() => {
        if (walletCode) return `walletCode=${encodeURIComponent(walletCode)}`
        if (legacyEmpId) return `empId=${encodeURIComponent(legacyEmpId)}`
        return ''
    }, [legacyEmpId, walletCode])

    const transferContent = qrData?.description || (walletCode ? `VI ${walletCode}` : `TU ${legacyEmpId}`)

    useEffect(() => {
        if (isOpen && !qrData && query) {
            fetchQRInfo()
        }
    }, [isOpen, qrData, query])

    const fetchQRInfo = async () => {
        if (!query) {
            toast.error('Chưa có mã ví để nạp tiền')
            return
        }

        setLoadingQR(true)
        try {
            const res = await fetch(`/api/payment/vietqr/topup-info?${query}`)
            if (res.ok) {
                const data = await res.json()
                setQrData(data)
            } else {
                toast.error('Không thể tải mã QR nạp ví')
            }
        } catch (error) {
            console.error('[WalletTopupModal] Fetch QR error:', error)
            toast.error('Không thể tải mã QR nạp ví')
        } finally {
            setLoadingQR(false)
        }
    }

    useEffect(() => {
        let interval: NodeJS.Timeout

        if (isOpen && !isSuccess) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/profile/wallet/check-topup')
                    if (res.ok) {
                        const data = await res.json()
                        if (data.hasNewTopup) {
                            setIsSuccess(true)
                            toast.success(`Nạp tiền thành công! Số dư mới: ${data.currentBalance.toLocaleString()}đ`)

                            setTimeout(() => {
                                setIsOpen(false)
                                router.refresh()
                                setTimeout(() => setIsSuccess(false), 500)
                            }, 3000)
                        }
                    }
                } catch (error) {
                    console.error('[WalletTopupModal] Polling error:', error)
                }
            }, 5000)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [isOpen, isSuccess, router])

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl active:scale-[0.98]"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z" clipRule="evenodd" />
                </svg>
                {buttonLabel}
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-3xl border border-neutral-100 bg-white p-6 shadow-2xl duration-200 dark:border-neutral-800 dark:bg-neutral-900">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Nạp tiền vào Ví Nerd</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                            >
                                <XMarkIcon className="size-5" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center">
                            {isSuccess ? (
                                <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300">
                                    <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <CheckCircleIcon className="size-12" />
                                    </div>
                                    <h4 className="mt-4 text-xl font-bold text-emerald-600 dark:text-emerald-400">Nạp tiền thành công!</h4>
                                    <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                        Số dư ví sẽ được cập nhật tự động.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="relative mb-4 flex min-h-[264px] w-full items-center justify-center overflow-hidden rounded-2xl border-4 border-primary-50 p-1 dark:border-primary-900/30">
                                        {loadingQR ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <ArrowPathIcon className="size-8 animate-spin text-primary-500" />
                                                <p className="text-xs text-neutral-400">Đang tạo mã QR...</p>
                                            </div>
                                        ) : qrData ? (
                                            <img
                                                src={qrData.qrUrl}
                                                alt="VietQR nạp ví"
                                                className="h-64 w-64 rounded-xl bg-white shadow-inner"
                                            />
                                        ) : (
                                            <div className="p-4 text-center">
                                                <p className="text-sm text-red-500">Lỗi tải mã QR</p>
                                                <button onClick={fetchQRInfo} className="mt-2 text-xs text-primary-500 underline">Thử lại</button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mb-5 flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                                            <ArrowPathIcon className="size-4 animate-spin" />
                                            <span className="text-xs font-semibold uppercase tracking-wider">Đang chờ hệ thống xác nhận</span>
                                        </div>
                                        <p className="px-4 text-center text-[11px] text-neutral-400">
                                            Hệ thống tự đồng bộ mỗi 5 giây. Vui lòng giữ đúng nội dung chuyển khoản.
                                        </p>
                                    </div>

                                    <div className="mb-5 w-full space-y-1.5 text-center">
                                        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Nội dung chuyển khoản</p>
                                        <div className="flex items-center justify-center gap-2 rounded-xl bg-primary-50/50 py-3 dark:bg-primary-900/10">
                                            <p className="text-2xl font-bold tracking-widest text-primary-600 dark:text-primary-400">{transferContent}</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(transferContent)
                                                    toast.success('Đã sao chép!')
                                                }}
                                                className="rounded-md bg-white p-1.5 text-neutral-500 shadow-sm transition-colors hover:bg-neutral-50 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                                                title="Sao chép"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                                                    <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                                                    <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="w-full space-y-2.5 rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-500">Ngân hàng</span>
                                            <span className="font-medium text-neutral-900 dark:text-white">{qrData?.bankCode || initialBankConfig.bankCode}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-500">Số tài khoản</span>
                                            <span className="font-mono font-medium text-neutral-900 dark:text-white">{qrData?.accountNumber || initialBankConfig.accountNumber}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-neutral-500">Chủ tài khoản</span>
                                            <span className="font-medium uppercase text-neutral-900 dark:text-white">{qrData?.accountName || initialBankConfig.accountName}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {!isSuccess && (
                            <button
                                onClick={() => setIsOpen(false)}
                                className="mt-5 w-full rounded-xl bg-neutral-900 py-3 text-sm font-bold text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                            >
                                Đóng
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
