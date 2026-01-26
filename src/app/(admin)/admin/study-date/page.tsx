'use client'

import React, { useEffect, useState } from 'react'
import { getStudyDateStats, getRegisteredProfiles } from '@/actions/admin-study-analytics'
import Link from 'next/link'
import {
    UsersIcon,
    CalendarDaysIcon,
    ClockIcon,
    ArrowTrendingUpIcon,
    PlusIcon,
    CheckBadgeIcon,
    SparklesIcon
} from '@heroicons/react/24/outline'

import StudyProfileDetailModal from '@/components/admin/StudyProfileDetailModal'
import { EyeIcon } from '@heroicons/react/24/outline'
import StudySlotsManagementModal from '@/components/admin/StudySlotsManagementModal'

const AdminStudyDatePage = () => {
    const [stats, setStats] = useState<any>(null)
    const [profiles, setProfiles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Modal State
    const [selectedProfile, setSelectedProfile] = useState<any>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            const [statsRes, profilesRes] = await Promise.all([
                getStudyDateStats(),
                getRegisteredProfiles()
            ])
            if (statsRes.success) setStats(statsRes.data)
            setProfiles(profilesRes)
            setLoading(false)
        }
        fetchData()
    }, [])

    const handleViewDetail = (profile: any) => {
        setSelectedProfile(profile)
        setIsModalOpen(true)
    }

    const statCards = [
        {
            name: 'Tổng Hồ Sơ',
            value: loading ? '...' : (stats?.totalProfiles || 0).toString(),
            icon: UsersIcon,
            gradient: 'from-blue-500 to-indigo-600',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            iconColor: 'text-blue-600 dark:text-blue-400',
        },
        {
            name: 'Slot Hiện Có',
            value: loading ? '...' : (stats?.totalSlots || 0).toString(),
            icon: CalendarDaysIcon,
            gradient: 'from-emerald-500 to-teal-600',
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
        },
        {
            name: 'Lượt Đăng Ký Rảnh',
            value: loading ? '...' : (stats?.totalAvailability || 0).toString(),
            icon: ClockIcon,
            gradient: 'from-amber-500 to-orange-600',
            bgColor: 'bg-amber-50 dark:bg-amber-900/20',
            iconColor: 'text-amber-600 dark:text-amber-400',
        },
        {
            name: 'Matches Thành Công',
            value: '0', // Placeholder for now
            icon: CheckBadgeIcon,
            gradient: 'from-purple-500 to-pink-600',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
            iconColor: 'text-purple-600 dark:text-purple-400',
        }
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        Study Date Dashboard
                    </h1>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        Quản lý hồ sơ và ghép đôi.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsSlotModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                        <CalendarDaysIcon className="size-5" />
                        Quản lý Slots
                    </button>
                    <button
                        onClick={() => alert('Tính năng đang phát triển')}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 hover:shadow-xl"
                    >
                        <SparklesIcon className="size-4" />
                        Chạy Matching (Beta)
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.name}
                        className="group relative overflow-hidden rounded-2xl border border-neutral-200/50 bg-white p-6 shadow-sm transition-all hover:border-neutral-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    >
                        <div className="flex items-start justify-between">
                            <div className={`rounded-xl p-3 ${stat.bgColor}`}>
                                <stat.icon className={`size-6 ${stat.iconColor}`} />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">{stat.value}</h3>
                            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{stat.name}</p>
                        </div>
                        <div className={`absolute -right-8 -top-8 size-24 rounded-full bg-gradient-to-br ${stat.gradient} opacity-10 blur-2xl transition-opacity group-hover:opacity-20`} />
                    </div>
                ))}
            </div>

            {/* Recent Profiles Table */}
            <div className="rounded-2xl border border-neutral-200/50 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Hồ sơ mới đăng ký</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                                <th className="px-6 py-4">Tên User</th>
                                <th className="px-6 py-4">Email / SĐT</th>
                                <th className="px-6 py-4">Mục tiêu</th>
                                <th className="px-6 py-4">Mode</th>
                                <th className="px-6 py-4">Ngày tạo</th>
                                <th className="px-6 py-4 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-neutral-500">Đang tải dữ liệu...</td></tr>
                            ) : profiles.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-neutral-500">Chưa có hồ sơ nào.</td></tr>
                            ) : (
                                profiles.map((profile: any) => (
                                    <tr
                                        key={profile.id}
                                        className="text-sm transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                                        onClick={() => handleViewDetail(profile)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-white uppercase">
                                                    {profile.user.name?.[0] || 'U'}
                                                </div>
                                                <div className="font-medium text-neutral-900 dark:text-white">{profile.user.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-neutral-500 dark:text-neutral-400">
                                                <div>{profile.user.email}</div>
                                                <div className="text-xs">{profile.user.phone}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {profile.seeking.map((s: string) => (
                                                    <span key={s} className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                                                        {s === 'STUDY_BUDDY' ? 'Study' : s === 'WORK_BUDDY' ? 'Work' : 'Date'}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400">
                                            {profile.workMode}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400">
                                            {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-primary-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleViewDetail(profile)
                                                }}
                                            >
                                                <EyeIcon className="size-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <StudyProfileDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                profile={selectedProfile}
            />

            <StudySlotsManagementModal
                isOpen={isSlotModalOpen}
                onClose={() => setIsSlotModalOpen(false)}
            />
        </div>
    )
}

export default AdminStudyDatePage
