'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ButtonPrimary from '@/shared/ButtonPrimary'
import {
    getStudyProfile,
    upsertStudyProfile,
    StudyProfileData
} from '@/actions/study-profile'
import {
    StudySeeking,
    StudyDateLevel,
    StudyWorkMode,
    InteractionLevel,
    StudyEnvironment,
    IntroExtro,
    SupportPreference,
    StudyFormat
} from '@prisma/client'
import toast from 'react-hot-toast'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { Checkbox } from '@/shared/Checkbox'

// UI Helper Components matching SettingsForm style
const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {children}
    </label>
)

const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={`w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white ${props.className || ''}`}
    />
)

const CustomSelect = <T extends string>({
    label,
    value,
    options,
    onChange,
    placeholder = "Chọn..."
}: {
    label: string
    value: T | undefined
    options: { value: T; label: string }[]
    onChange: (val: T) => void
    placeholder?: string
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const selected = options.find(o => o.value === value)

    return (
        <div className="relative">
            <Label>{label}</Label>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-300 bg-white px-4 py-3 text-left text-neutral-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white"
            >
                <span className={!selected ? 'text-neutral-500' : ''}>
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronDownIcon className={`size-5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 max-h-60 overflow-auto">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value)
                                setIsOpen(false)
                            }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${option.value === value
                                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                                : 'text-neutral-700 dark:text-neutral-300'
                                } first:rounded-t-xl last:rounded-b-xl`}
                        >
                            <span className="font-medium">{option.label}</span>
                            {option.value === value && (
                                <CheckIcon className="ml-auto size-5 text-primary-500" />
                            )}
                        </button>
                    ))}
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />}
        </div>
    )
}

const StudyProfileForm = () => {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState<StudyProfileData>({
        seeking: [],
        dateLevel: undefined,
        workMode: undefined,
        interactionLevel: undefined,
        environment: undefined,
        introExtro: undefined,
        primaryFocus: '',
        supportPreference: undefined,
        ageRangeMin: 18,
        ageRangeMax: 30,
        shareContact: false,
        preferredFormat: undefined
    })
    const [consentCode, setConsentCode] = useState(false)
    const [consentReport, setConsentReport] = useState(false)

    useEffect(() => {
        loadProfile()
    }, [])

    const loadProfile = async () => {
        setLoading(true)
        const profile = await getStudyProfile()
        if (profile) {
            setFormData({
                seeking: profile.seeking as StudySeeking[] || [],
                dateLevel: profile.dateLevel as StudyDateLevel || undefined,
                workMode: profile.workMode as StudyWorkMode || undefined,
                interactionLevel: profile.interactionLevel as InteractionLevel || undefined,
                environment: profile.environment as StudyEnvironment || undefined,
                introExtro: profile.introExtro as IntroExtro || undefined,
                primaryFocus: profile.primaryFocus || '',
                supportPreference: profile.supportPreference as SupportPreference || undefined,
                ageRangeMin: profile.ageRangeMin || 18,
                ageRangeMax: profile.ageRangeMax || 30,
                shareContact: profile.shareContact || false,
                preferredFormat: profile.preferredFormat as StudyFormat || undefined
            })
            // Consents are not stored in profile but required for flow, defaulting to true if editing (assuming they agreed before)
            setConsentCode(true)
            setConsentReport(true)
        }
        setLoading(false)
    }

    const handleSeekingChange = (value: StudySeeking) => {
        setFormData(prev => {
            const current = prev.seeking || []
            if (current.includes(value)) {
                return { ...prev, seeking: current.filter(item => item !== value) }
            } else {
                return { ...prev, seeking: [...current, value] }
            }
        })
    }


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!consentCode || !consentReport) {
            toast.error('Bạn cần đồng ý với Quy tắc ứng xử và Điều khoản trước khi tiếp tục.')
            return
        }
        setSaving(true)
        const res = await upsertStudyProfile(formData)
        setSaving(false)
        if (res.success) {
            toast.success('Lưu hồ sơ thành công!')
            router.push('/study-date/planner')
        } else {
            toast.error('Có lỗi xảy ra: ' + res.error)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center p-10">
            <div className="size-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
        </div>
    )

    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Hồ sơ Study Date</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                    Thiết lập hồ sơ để tìm kiếm partner phù hợp nhất.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">

                {/* Seeking */}
                <div className="space-y-3">
                    <Label>Mục tiêu tìm kiếm</Label>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {[
                            { id: 'STUDY_BUDDY', label: 'Study Buddy', desc: 'Học cùng nhau' },
                            { id: 'WORK_BUDDY', label: 'Work Buddy', desc: 'Làm việc cùng' },
                            { id: 'OPEN_TO_DATE', label: 'Open to Date', desc: 'Tìm hiểu (Date)' }
                        ].map(item => {
                            const isSelected = formData.seeking.includes(item.id as StudySeeking)
                            return (
                                <div
                                    key={item.id}
                                    className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${isSelected
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
                                        : 'border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800'
                                        }`}
                                    onClick={() => handleSeekingChange(item.id as StudySeeking)}
                                >
                                    <div className="pt-0.5">
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() => { }}
                                            className="pointer-events-none"
                                        />
                                    </div>
                                    <div>
                                        <span className={`block font-semibold ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-neutral-900 dark:text-neutral-100'}`}>
                                            {item.label}
                                        </span>
                                        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.desc}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Date Level */}
                    <CustomSelect
                        label='Mức độ "Date"'
                        value={formData.dateLevel}
                        onChange={(val) => setFormData({ ...formData, dateLevel: val })}
                        options={[
                            { value: 'FOCUS_ONLY', label: 'Focus Only (Chỉ tập trung)' },
                            { value: 'BALANCED', label: 'Balanced (50/50)' },
                            { value: 'DATE_HEAVY', label: 'Date Heavy (Ưu tiên tìm hiểu)' }
                        ]}
                    />

                    {/* Work Mode */}
                    <CustomSelect
                        label='Phong cách làm việc'
                        value={formData.workMode}
                        onChange={(val) => setFormData({ ...formData, workMode: val })}
                        options={[
                            { value: 'SILENT', label: 'Im lặng tuyệt đối' },
                            { value: 'POMODORO', label: 'Pomodoro (25p/5p)' },
                            { value: 'CASUAL_CHAT', label: 'Casual Chat (Thoải mái)' }
                        ]}
                    />
                </div>

                {/* Primary Focus */}
                <div>
                    <Label>Chủ đề chính tuần tới</Label>
                    <InputField
                        placeholder="VD: IELTS, Coding, Design, Thesis..."
                        value={formData.primaryFocus}
                        onChange={(e) => setFormData({ ...formData, primaryFocus: e.target.value })}
                    />
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        Chủ đề bạn muốn tập trung làm việc hoặc học tập.
                    </p>
                </div>

                {/* Interaction Level */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <CustomSelect
                        label='Mức độ tương tác'
                        value={formData.interactionLevel}
                        onChange={(val) => setFormData({ ...formData, interactionLevel: val })}
                        options={[
                            { value: 'LOW', label: 'Thấp' },
                            { value: 'MEDIUM', label: 'Trung bình' },
                            { value: 'HIGH', label: 'Cao' }
                        ]}
                    />

                    <CustomSelect
                        label='Tính cách (Intro/Extro)'
                        value={formData.introExtro}
                        onChange={(val) => setFormData({ ...formData, introExtro: val })}
                        options={[
                            { value: 'INTROVERT', label: 'Hướng nội (Introvert)' },
                            { value: 'AMBIVERT', label: 'Ở giữa (Ambivert)' },
                            { value: 'EXTROVERT', label: 'Hướng ngoại (Extrovert)' }
                        ]}
                    />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <CustomSelect
                        label='Hình thức (Format)'
                        value={formData.preferredFormat}
                        onChange={(val) => setFormData({ ...formData, preferredFormat: val })}
                        options={[
                            { value: 'ONE_ON_ONE', label: '1-1 (Riêng tư)' },
                            { value: 'GROUP', label: 'Nhóm nhỏ (3-4 người)' }
                        ]}
                    />
                    <CustomSelect
                        label='Môi trường (Environment)'
                        value={formData.environment}
                        onChange={(val) => setFormData({ ...formData, environment: val })}
                        options={[
                            { value: 'QUIET', label: 'Yên tĩnh tuyệt đối' },
                            { value: 'LIGHT_MUSIC', label: 'Có nhạc nhẹ' },
                            { value: 'DONT_CARE', label: 'Không quan trọng' }
                        ]}
                    />
                </div>

                <CustomSelect
                    label='Hỗ trợ (Support Preference)'
                    value={formData.supportPreference}
                    onChange={(val) => setFormData({ ...formData, supportPreference: val })}
                    options={[
                        { value: 'JUST_PRESENCE', label: 'Just Presence (Chỉ cần ngồi cùng)' },
                        { value: 'QUICK_REVIEW', label: 'Quick Review (Nhờ xem giúp 5-10p)' },
                        { value: 'SKILL_SWAP', label: 'Skill Swap (Trao đổi kỹ năng)' }
                    ]}
                />

                {/* Safety */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/50">
                    <h3 className="mb-4 font-semibold text-neutral-900 dark:text-neutral-100">Cài đặt kết nối</h3>

                    <div className="mb-6 grid grid-cols-2 gap-4">
                        <div>
                            <Label>Độ tuổi Min</Label>
                            <InputField
                                type="number"
                                value={formData.ageRangeMin}
                                onChange={(e) => setFormData({ ...formData, ageRangeMin: parseInt(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label>Độ tuổi Max</Label>
                            <InputField
                                type="number"
                                value={formData.ageRangeMax}
                                onChange={(e) => setFormData({ ...formData, ageRangeMax: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div
                        className="flex cursor-pointer items-start gap-3"
                        onClick={() => setFormData({ ...formData, shareContact: !formData.shareContact })}
                    >
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${formData.shareContact
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-700'
                            }`}>
                            {formData.shareContact && <CheckIcon className="size-3.5" />}
                        </div>
                        <div className="-mt-1 select-none">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">Chia sẻ liên hệ</span>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Đồng ý chia sẻ SĐT/Social của bạn cho đối phương nếu Match thành công.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Consents - Unified Styling */}
                <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-700 dark:bg-neutral-800/50">
                    <div
                        className="flex cursor-pointer items-start gap-3"
                        onClick={() => setConsentCode(!consentCode)}
                    >
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${consentCode
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-700'
                            }`}>
                            {consentCode && <CheckIcon className="size-3.5" />}
                        </div>
                        <div className="-mt-1 select-none">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
                                Tôi đồng ý với <Link href="/code-of-conduct" target="_blank" className="font-bold text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>Quy tắc ứng xử (Code of Conduct)</Link> tại Nerd.
                            </span>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Giữ thái độ tôn trọng, không quấy rối, giữ vệ sinh chung.
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex cursor-pointer items-start gap-3"
                        onClick={() => setConsentReport(!consentReport)}
                    >
                        <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${consentReport
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-700'
                            }`}>
                            {consentReport && <CheckIcon className="size-3.5" />}
                        </div>
                        <div className="-mt-1 select-none">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
                                Report Consent
                            </span>
                            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                                Tôi hiểu rằng mình có thể bị báo cáo (report) nếu có hành vi không phù hợp.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-lg shadow-primary-500/30 transition-all hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Đang lưu...
                            </>
                        ) : (
                            'Lưu & Cập nhật'
                        )}
                    </button>
                </div>

            </form>
        </div>
    )
}

export default StudyProfileForm
