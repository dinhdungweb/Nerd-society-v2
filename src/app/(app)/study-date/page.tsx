'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

export default function StudyDateRootPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()

    // Default callback to dashboard, but if user came from somewhere else (e.g. planner), preserve it.
    const callbackUrl = searchParams.get('callbackUrl') || '/study-date/dashboard'

    useEffect(() => {
        if (status === 'authenticated') {
            router.push(callbackUrl)
        }
    }, [status, router, callbackUrl])

    if (status === 'loading') {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
                <div className="size-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
                <p className="text-neutral-500 animate-pulse">Đang tải...</p>
            </div>
        )
    }

    if (status === 'authenticated') {
        return null // Will redirect
    }

    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="max-w-xl space-y-8">
                {/* Hero Icon/Image placeholder if needed */}
                <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-10">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.24 50.59 50.59 0 00-2.658.813m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                        Chào mừng đến với <span className="text-primary-600">Study Date</span>
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-neutral-300">
                        Tìm kiếm partner học tập, làm việc hoặc kết nối tại Nerd Society. Vui lòng đăng nhập để bắt đầu hành trình của bạn.
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                    <Link
                        href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-700 hover:scale-105"
                    >
                        Đăng nhập
                        <ArrowRightIcon className="size-5" />
                    </Link>
                    <Link
                        href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
                        className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 font-semibold text-neutral-900 shadow-sm ring-1 ring-inset ring-neutral-200 transition-all hover:bg-neutral-50 hover:scale-105 dark:bg-neutral-800 dark:text-white dark:ring-neutral-700 dark:hover:bg-neutral-700"
                    >
                        Đăng ký tài khoản
                    </Link>
                </div>
            </div>
        </div>
    )
}
