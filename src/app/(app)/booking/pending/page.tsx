'use client'

import { Button } from '@/shared/Button'
import { ClockIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { Suspense } from 'react'

const PaymentPendingContent = () => {
    const searchParams = useSearchParams()
    // const bookingId = searchParams.get('id') // Variable unused in UI but logic keeps it for future use

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 py-16 dark:bg-neutral-950">
            <div className="mx-auto max-w-md text-center">
                {/* Pending Icon */}
                <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-xl shadow-orange-500/30">
                    <ClockIcon className="size-10 text-white" />
                </div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    Đã ghi nhận thanh toán!
                </h1>

                {/* Description */}
                <p className="mt-4 text-neutral-600 dark:text-neutral-400">
                    Cảm ơn bạn đã thông báo thanh toán.
                    Chúng tôi sẽ xác nhận trong thời gian sớm nhất.
                </p>

                {/* Status */}
                <div className="mt-6 rounded-xl bg-yellow-50 p-4 dark:bg-yellow-900/20">
                    <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
                        <ClockIcon className="size-5" />
                        <span className="font-medium">Chờ xác nhận thanh toán</span>
                    </div>
                    <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-300">
                        Quản trị viên sẽ kiểm tra và xác nhận thanh toán của bạn.
                        Bạn sẽ nhận được email xác nhận sau khi hoàn tất.
                    </p>
                </div>

                {/* Actions */}
                <div className="mt-8 flex flex-col gap-3">
                    <Link href={`/profile`}>
                        <Button className="w-full">
                            Xem lịch sử đặt phòng
                        </Button>
                    </Link>
                    <Link href="/">
                        <Button className="w-full bg-neutral-200 px-6 py-3 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700">
                            Về trang chủ
                        </Button>
                    </Link>
                </div>

                {/* Help */}
                <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
                    Có vấn đề? Liên hệ{' '}
                    <a href="tel:0901234567" className="text-primary-600 hover:underline dark:text-primary-400">
                        0901 234 567
                    </a>
                </p>
            </div>
        </div>
    )
}

export default function PaymentPendingPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
            <div className="animate-pulse text-lg text-neutral-600">Đang tải...</div>
        </div>}>
            <PaymentPendingContent />
        </Suspense>
    )
}
