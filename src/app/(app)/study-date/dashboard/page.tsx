
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import React from 'react'
import { getUserStudySlots } from '@/actions/admin-study'
import { AcademicCapIcon, AdjustmentsHorizontalIcon, ShieldCheckIcon, CalendarDaysIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import RegisteredSlotItem from '@/components/study-date/RegisteredSlotItem'

// UI Components repeated (should be shared in real app)
const InfoItem = ({ label, value, className = "" }: { label: string, value: React.ReactNode, className?: string }) => (
    <div className={`space-y-1 ${className}`}>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-wider">{label}</p>
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{value || 'N/A'}</div>
    </div>
)

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-neutral-100 dark:border-neutral-700 pb-2">
        <Icon className="size-5 text-primary-600 dark:text-primary-400" />
        <h4 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h4>
    </div>
)

const Page = async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user) return redirect('/study-date?callbackUrl=/study-date/dashboard')

    const profile = await prisma.studyProfile.findUnique({
        where: { userId: session.user.id },
        include: { user: true }
    })

    if (!profile) {
        return (
            <div className="container mx-auto max-w-4xl py-10 px-4">
                <div className="text-center py-20 bg-neutral-50 rounded-2xl dark:bg-neutral-900">
                    <h2 className="text-2xl font-bold mb-4">Bạn chưa tạo hồ sơ Study Date</h2>
                    <p className="text-neutral-500 mb-8">Hãy tạo hồ sơ để bắt đầu tìm kiếm bạn học phù hợp.</p>
                    <Link href="/study-date/onboarding" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors">
                        Tạo hồ sơ ngay
                    </Link>
                </div>
            </div>
        )
    }

    const registeredSlots = await getUserStudySlots(session.user.id)

    return (
        <div className="py-10 space-y-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Study Dashboard</h1>
                <p className="text-neutral-500 mt-2">Quản lý hồ sơ và lịch rảnh của bạn.</p>
            </div>

            {/* Profile Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 md:p-8">
                {/* User Header Card */}
                <div className="flex items-start gap-5 mb-8">
                    <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-2xl font-bold text-white uppercase shadow-lg shadow-primary-500/20">
                        {profile.user.name?.[0] || 'U'}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">{profile.user.name}</h2>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
                            <span className="flex items-center gap-1">
                                <EnvelopeIcon className="size-4" />
                                {profile.user.email}
                            </span>
                            <span className="flex items-center gap-1">
                                <PhoneIcon className="size-4" />
                                {profile.user.phone}
                            </span>
                            <span className="flex items-center gap-1">
                                <CalendarDaysIcon className="size-4" />
                                Tham gia: {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                        </div>
                    </div>
                    <Link href="/study-date/onboarding" className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline">
                        Chỉnh sửa
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Column 1: Core Preferences */}
                    <div>
                        <SectionHeader icon={AcademicCapIcon} title="Mục tiêu & Phong cách" />
                        <div className="space-y-5">
                            <InfoItem
                                label="Mục tiêu tìm kiếm"
                                value={
                                    <div className="flex flex-wrap gap-2">
                                        {profile.seeking.map((s: string) => (
                                            <span key={s} className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-600/20 dark:bg-primary-900/10 dark:text-primary-400 dark:ring-primary-500/20">
                                                {s === 'STUDY_BUDDY' ? 'HARD CORE' : s === 'WORK_BUDDY' ? 'WORK' : 'DATE'}
                                            </span>
                                        ))}
                                    </div>
                                }
                            />
                            <InfoItem label="Chủ đề chính (Focus)" value={profile.primaryFocus} />
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Mức độ Date" value={profile.dateLevel?.replace('_', ' ')} />
                                <InfoItem label="Work Mode" value={profile.workMode?.replace('_', ' ')} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Tương tác" value={profile.interactionLevel} />
                                <InfoItem label="Intro/Extro" value={profile.introExtro} />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Environment & Safety */}
                    <div className="space-y-8">
                        <div>
                            <SectionHeader icon={AdjustmentsHorizontalIcon} title="Môi trường & Hình thức" />
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <InfoItem label="Hình thức" value={profile.preferredFormat?.replace('_', ' ')} />
                                    <InfoItem label="Môi trường" value={profile.environment?.replace('_', ' ')} />
                                </div>
                                <InfoItem label="Hỗ trợ mong muốn" value={profile.supportPreference?.replace('_', ' ')} />
                            </div>
                        </div>

                        <div>
                            <SectionHeader icon={ShieldCheckIcon} title="Cài đặt Kết nối" />
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <InfoItem label="Độ tuổi ưu tiên" value={`${profile.ageRangeMin || 18} - ${profile.ageRangeMax || 30}`} />
                                    <InfoItem
                                        label="Chia sẻ liên hệ"
                                        value={
                                            profile.shareContact ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                    <span className="size-1.5 rounded-full bg-emerald-500" /> Đồng ý
                                                </span>
                                            ) : (
                                                <span className="text-neutral-500">Giữ kín</span>
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Section */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                    <SectionHeader icon={CalendarDaysIcon} title="Lịch rảnh đã đăng ký" />
                    <Link href="/study-date/planner" className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline">
                        + Đăng ký thêm
                    </Link>
                </div>

                {registeredSlots.length === 0 ? (
                    <div className="text-center py-10 text-neutral-500 bg-neutral-50 rounded-xl dark:bg-neutral-800/50">
                        Bạn chưa đăng ký lịch học nào.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {registeredSlots.map((reg: any) => (
                            <RegisteredSlotItem key={reg.id} registration={reg} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Page
