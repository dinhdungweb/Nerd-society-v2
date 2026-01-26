
import StudyProfileForm from '@/components/study-date/StudyProfileForm'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export const metadata: Metadata = {
    title: 'Study Date Profile | Nerd Society',
}

export default function StudyOnboardingPage() {
    return (
        <div className="mx-auto py-10">
            <div className="mb-8">
                <Link href="/study-date/dashboard" className="inline-flex items-center text-sm text-neutral-500 hover:text-primary-600 mb-4 transition-colors">
                    <ArrowLeftIcon className="w-4 h-4 mr-1" />
                    Quay lại Dashboard
                </Link>
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Study Date @ Nerd</h1>
                    <p className="mt-2 text-neutral-500">Tìm bạn học, bạn làm việc hoặc "người ấy" tại không gian Nerd.</p>
                </div>
            </div>
            <StudyProfileForm />
        </div>
    )
}
