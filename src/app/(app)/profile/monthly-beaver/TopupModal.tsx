'use client'

import React, { useState, useEffect } from 'react'
import { XMarkIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface TopupModalProps {
    empId: string
    // bankConfig cũ có thể bỏ qua nếu fetch từ API mới, 
    // nhưng giữ lại type để không break props truyền vào
    bankConfig: {
        bankCode: string
        accountNumber: string
        accountName: string
    }
}

interface QRData {
    qrUrl: string
    bankCode: string
    accountNumber: string
    accountName: string
    description: string
}

export default function TopupModal({ empId, bankConfig: initialBankConfig }: TopupModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [loadingQR, setLoadingQR] = useState(false)
    const [qrData, setQrData] = useState<QRData | null>(null)
    const router = useRouter()
    
    const transferContent = `TU ${empId}`

    // 1. Fetch QR Info từ API chính gốc khi mở Modal
    useEffect(() => {
        if (isOpen && !qrData) {
            fetchQRInfo()
        }
    }, [isOpen])

    const fetchQRInfo = async () => {
        setLoadingQR(true)
        try {
            const res = await fetch(`/api/payment/vietqr/topup-info?empId=${empId}`)
            if (res.ok) {
                const data = await res.json()
                setQrData(data)
            } else {
                toast.error('Không thể tải mã QR từ hệ thống chính gốc')
            }
        } catch (error) {
            console.error('[TopupModal] Fetch QR error:', error)
        } finally {
            setLoadingQR(false)
        }
    }

    // 2. Polling logic: Kiểm tra giao dịch mỗi 5 giây
    useEffect(() => {
        let interval: NodeJS.Timeout

        if (isOpen && !isSuccess) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch('/api/profile/monthly-beaver/check-topup')
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
                    console.error('[TopupModal] Polling error:', error)
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
                Nạp tiền vào Ví
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-3xl bg-white p-6 shadow-2xl dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
                        {/* Header */}
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Nạp tiền vào Ví</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                            >
                                <XMarkIcon className="size-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex flex-col items-center">
                            {isSuccess ? (
                                <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300">
                                    <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        <CheckCircleIcon className="size-12" />
                                    </div>
                                    <h4 className="mt-4 text-xl font-bold text-emerald-600 dark:text-emerald-400">Nạp tiền thành công!</h4>
                                    <p className="mt-2 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                        Số dư sẽ được cập nhật ngay lập tức. <br />
                                        Đang quay lại trang Profile...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 overflow-hidden rounded-2xl border-4 border-primary-50 p-1 dark:border-primary-900/30 relative min-h-[264px] flex items-center justify-center w-full">
                                        {loadingQR ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <ArrowPathIcon className="size-8 animate-spin text-primary-500" />
                                                <p className="text-xs text-neutral-400">Đang khởi tạo mã QR từ API...</p>
                                            </div>
                                        ) : qrData ? (
                                            <img
                                                src={qrData.qrUrl}
                                                alt="VietQR Nạp tiền"
                                                className="h-64 w-64 rounded-xl shadow-inner bg-white"
                                            />
                                        ) : (
                                            <div className="text-center p-4">
                                                <p className="text-sm text-red-500">Lỗi tải mã QR</p>
                                                <button onClick={fetchQRInfo} className="text-xs text-primary-500 underline mt-2">Thử lại</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Indicator */}
                                    <div className="mb-5 flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                                            <div className="relative">
                                                <div className="absolute inset-0 animate-ping rounded-full bg-primary-400/20" />
                                                <ArrowPathIcon className="size-4 animate-spin" />
                                            </div>
                                            <span className="text-xs font-semibold uppercase tracking-wider">Đang chờ hệ thống xác nhận</span>
                                        </div>
                                        <p className="text-[11px] text-neutral-400 text-center px-4">
                                            Hệ thống tự động đồng bộ mỗi 5s. Vui lòng giữ đúng nội dung chuyển khoản.
                                        </p>
                                    </div>

                                    {/* Transfer content */}
                                    <div className="mb-5 text-center space-y-1.5 w-full">
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

                                    {/* Bank info */}
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
                                            <span className="font-medium text-neutral-900 uppercase dark:text-white">{qrData?.accountName || initialBankConfig.accountName}</span>
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
