
import WeekPlanner from '@/components/study-date/WeekPlanner'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
    title: 'Lịch Study Date | Nerd Society',
}

export default async function StudyPlannerPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user) return redirect('/study-date?callbackUrl=/study-date/planner')

    return (
        <div className="py-10">
            <div className="mb-6">
                <Link href="/study-date/dashboard" className="inline-flex items-center text-sm text-neutral-500 hover:text-primary-600 mb-4 transition-colors">
                    <ArrowLeftIcon className="w-4 h-4 mr-1" />
                    Quay lại Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Đăng ký Lịch Rảnh</h1>
                <p className="mt-2 text-neutral-500">Chọn các khung giờ bạn có thể đến Nerd trong tuần tới.</p>
            </div>
            <WeekPlanner />
        </div>
    )
}
