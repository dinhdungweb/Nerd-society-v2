import React, { useEffect, useState } from 'react'
import NcModal from '@/shared/NcModal'
import { StudyProfile } from '@prisma/client'
import { UserCircleIcon, AcademicCapIcon, AdjustmentsHorizontalIcon, ShieldCheckIcon, CalendarDaysIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { getUserStudySlots } from '@/actions/admin-study'

interface StudyProfileDetailModalProps {
    profile: any
    isOpen: boolean
    onClose: () => void
}

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

const StudyProfileDetailModal = ({ profile, isOpen, onClose }: StudyProfileDetailModalProps) => {
    const [registeredSlots, setRegisteredSlots] = useState<any[]>([])
    const [loadingSlots, setLoadingSlots] = useState(false)

    useEffect(() => {
        if (isOpen && profile?.user?.id) {
            const fetchSlots = async () => {
                setLoadingSlots(true)
                const res = await getUserStudySlots(profile.user.id)
                setRegisteredSlots(res)
                setLoadingSlots(false)
            }
            fetchSlots()
        }
    }, [isOpen, profile])

    if (!profile) return null

    const renderContent = () => {
        return (
            <div className="space-y-8">
                {/* User Header Card */}
                <div className="flex items-start gap-5 rounded-xl border border-neutral-100 bg-neutral-50/50 p-5 dark:border-neutral-700 dark:bg-neutral-800/50">
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-xl font-bold text-white uppercase shadow-lg shadow-primary-500/20">
                        {profile.user.name?.[0] || 'U'}
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                        <InfoItem label="Họ tên" value={profile.user.name} />
                        <InfoItem label="Email" value={profile.user.email} />
                        <InfoItem label="Số điện thoại" value={profile.user.phone} />
                        <InfoItem label="Ngày đăng ký" value={new Date(profile.createdAt).toLocaleString('vi-VN')} />
                    </div>
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
                {/* Registered Slots Section (New) */}
                <div>
                    <SectionHeader icon={CalendarDaysIcon} title="Lịch slot đã đăng ký" />
                    {loadingSlots ? (
                        <div className="text-sm text-neutral-500">Đang tải lịch sử đăng ký...</div>
                    ) : registeredSlots.length === 0 ? (
                        <div className="text-sm text-neutral-500 italic">User này chưa đăng ký slot nào.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {registeredSlots.map((reg) => {
                                const start = new Date(reg.weekStart)
                                const offset = reg.slot.dayOfWeek === 0 ? 6 : reg.slot.dayOfWeek - 1
                                start.setDate(start.getDate() + offset)
                                const dateStr = start.toLocaleDateString('vi-VN')

                                return (
                                    <div key={reg.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
                                        <div className="flex flex-col items-center justify-center size-12 shrink-0 rounded-lg bg-white shadow-sm dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
                                            <span className="text-xs font-bold">{reg.slot.dayOfWeek === 0 ? 'CN' : `T${reg.slot.dayOfWeek + 1}`}</span>
                                            <span className="text-[10px] text-neutral-500">{start.getDate()}/{start.getMonth() + 1}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
                                                <ClockIcon className="size-3.5 text-neutral-500" />
                                                {reg.slot.startTime} - {reg.slot.endTime}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-neutral-500 truncate mt-0.5">
                                                <MapPinIcon className="size-3" />
                                                {reg.slot.location?.name || 'Unknown Location'}
                                            </div>
                                            <div className="text-[10px] text-neutral-400 mt-1">
                                                Ngày: {dateStr}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <NcModal
            isOpenProp={isOpen}
            onCloseModal={onClose}
            contentExtraClass="max-w-4xl" // Wider modal
            contentPaddingClass="p-6 md:p-8"
            renderContent={renderContent}
            renderTrigger={() => null}
            modalTitle="Hồ sơ thành viên"
        />
    )
}

export default StudyProfileDetailModal
