'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    BriefcaseIcon,
    MapPinIcon,
    ClockIcon,
    ArrowRightIcon,
    UserGroupIcon,
    AcademicCapIcon
} from '@heroicons/react/24/outline'

interface Job {
    id: string
    title: string
    slug: string
    description: string
    location: string
    workShift: string
    requirements: string
    benefits: string
    createdAt: string
}

export default function JobsList() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchJobs()
    }, [])

    const fetchJobs = async () => {
        try {
            const res = await fetch('/api/jobs')
            const data = await res.json()
            setJobs(data)
        } catch (error) {
            console.error('Error fetching jobs:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto -mt-16 pb-24 relative z-20">
            {/* Why Work at Nerd - Floating Cards */}
            <div className="mb-20 grid gap-6 md:grid-cols-3">
                <div className="group rounded-2xl border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-1 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 inline-flex rounded-xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                        <UserGroupIcon className="size-8" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-neutral-900 dark:text-white">Môi trường năng động</h3>
                    <p className="text-neutral-600 dark:text-neutral-400">
                        Được làm việc cùng đội ngũ Gen Z sáng tạo, nhiệt huyết và luôn hỗ trợ lẫn nhau.
                    </p>
                </div>
                <div className="group rounded-2xl border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-1 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 inline-flex rounded-xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                        <ClockIcon className="size-8" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-neutral-900 dark:text-white">Linh hoạt thời gian</h3>
                    <p className="text-neutral-600 dark:text-neutral-400">
                        Ca làm việc linh hoạt, dễ dàng sắp xếp phù hợp với lịch học của sinh viên.
                    </p>
                </div>
                <div className="group rounded-2xl border border-neutral-200 bg-white p-8 transition-all hover:shadow-2xl hover:-translate-y-1 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-4 inline-flex rounded-xl bg-primary-100 p-3 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                        <AcademicCapIcon className="size-8" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-neutral-900 dark:text-white">Phát triển kỹ năng</h3>
                    <p className="text-neutral-600 dark:text-neutral-400">
                        Học hỏi kỹ năng pha chế, giao tiếp, quản lý và vận hành mô hình kinh doanh.
                    </p>
                </div>
            </div>

            {/* Open Positions Section */}
            <div className="space-y-10">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-neutral-900 dark:text-white sm:text-4xl">
                        Vị trí đang tuyển
                    </h2>
                    <p className="mt-4 text-neutral-600 dark:text-neutral-400">
                        Tìm kiếm cơ hội phù hợp với bạn
                    </p>
                </div>

                {loading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-72 animate-pulse rounded-3xl bg-neutral-200 dark:bg-neutral-800" />
                        ))}
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-20 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
                        <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <BriefcaseIcon className="size-10 text-neutral-400" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-white">
                            Chưa có vị trí tuyển dụng
                        </h3>
                        <p className="max-w-md text-neutral-500 dark:text-neutral-400">
                            Hiện tại chúng tôi chưa có vị trí nào đang mở. Hãy quay lại sau hoặc theo dõi fanpage để cập nhật thông tin mới nhất nhé!
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {jobs.map(job => (
                            <Link
                                key={job.id}
                                href={`/tuyen-dung/${job.slug}`}
                                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-neutral-200 bg-white p-8 transition-all hover:border-primary-500/50 hover:shadow-2xl hover:shadow-primary-500/10 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-500/30"
                            >
                                <div>
                                    <div className="mb-6 flex items-start justify-between">
                                        <div className="rounded-2xl bg-primary-100 px-4 py-2 font-semibold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                            {job.title}
                                        </div>
                                        <span className="flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 transition-colors group-hover:border-primary-500 group-hover:bg-primary-500 group-hover:text-white dark:border-neutral-700 dark:bg-neutral-800 dark:group-hover:text-white">
                                            <ArrowRightIcon className="size-5" />
                                        </span>
                                    </div>

                                    <div className="mb-6 space-y-3">
                                        <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
                                            <MapPinIcon className="size-5 text-neutral-400" />
                                            <span className="text-sm font-medium">{job.location}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
                                            <ClockIcon className="size-5 text-neutral-400" />
                                            <span className="text-sm font-medium">{job.workShift}</span>
                                        </div>
                                    </div>

                                    <p className="line-clamp-3 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                                        {job.description}
                                    </p>
                                </div>

                                <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                                    <span className="text-sm font-semibold text-primary-600 group-hover:underline dark:text-primary-400">
                                        Xem chi tiết & Ứng tuyển
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
