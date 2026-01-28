'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

export default function StudyDateRootPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const callbackUrl = searchParams.get('callbackUrl') || '/study-date/dashboard'

    useEffect(() => {
        if (status === 'loading') return

        if (status === 'unauthenticated') {
            toast.error('Vui lòng đăng nhập để tham gia Study Date')
            router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
        } else if (status === 'authenticated') {
            router.push(callbackUrl)
        }
    }, [status, router, callbackUrl])

    return (
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
            <div className="size-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
            <p className="text-neutral-500 animate-pulse">Đang tải dữ liệu...</p>
        </div>
    )
}
