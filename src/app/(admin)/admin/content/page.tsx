'use client'

import { Button } from '@/shared/Button'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import {
    PhotoIcon,
    TrashIcon,
    CloudArrowUpIcon,
    DocumentTextIcon,
    NewspaperIcon,
    Cog6ToothIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline'

interface Settings {
    heroTitle: string
    heroSubtitle: string
    heroCta: string
    heroBackgroundImage: string
    aboutTitle: string
    aboutContent: string
    // Carousel News Settings
    newsTitle: string
    newsSubtitle: string
    newsLimit: string
    newsAutoplay: string
    newsAutoplayDelay: string
    newsShowNavigation: string
}

export default function AdminContentPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [settings, setSettings] = useState<Settings>({
        heroTitle: 'Không gian học tập & làm việc dành riêng cho Gen Z',
        heroSubtitle: 'Trải nghiệm không gian Nerd Society với đầy đủ tiện nghi, wifi tốc độ cao và cafe miễn phí.',
        heroCta: 'Đặt chỗ ngay',
        heroBackgroundImage: '',
        aboutTitle: 'Câu chuyện của Nerd',
        aboutContent: 'Chúng mình tin rằng một không gian tốt sẽ khơi nguồn cảm hứng vô tận. Tại Nerd Society, mỗi góc nhỏ đều được chăm chút để bạn có thể tập trung tối đa.',
        // Carousel defaults
        newsTitle: 'Tin tức & Sự kiện',
        newsSubtitle: 'Cập nhật những hoạt động mới nhất từ Nerd Society',
        newsLimit: '6',
        newsAutoplay: 'true',
        newsAutoplayDelay: '5000',
        newsShowNavigation: 'true',
    })

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings')
            const data = await res.json()
            if (res.ok && Object.keys(data).length > 0) {
                setSettings(prev => ({ ...prev, ...data }))
            }
        } catch (error) {
            console.error('Failed to load settings', error)
            toast.error('Không thể tải cấu hình')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (key: keyof Settings, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }))
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('files', files[0])

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (res.ok && data.url) {
                handleChange('heroBackgroundImage', data.url)
                toast.success('Đã upload ảnh!')
            } else {
                toast.error(data.error || 'Lỗi khi upload ảnh')
            }
        } catch (error) {
            toast.error('Lỗi khi upload ảnh!')
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleRemoveImage = () => {
        handleChange('heroBackgroundImage', '')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            })

            if (!res.ok) throw new Error('Failed to save')

            toast.success('Đã lưu thay đổi!')
        } catch (error) {
            toast.error('Lỗi khi lưu!')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="animate-pulse text-lg text-neutral-500 dark:text-neutral-400">Đang tải cấu hình...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý nội dung</h1>
                <p className="text-neutral-500 dark:text-neutral-400">Chỉnh sửa nội dung hiển thị trên trang chủ</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* HERO SECTION CARD */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                            <SparklesIcon className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Hero Section</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Phần đầu trang chủ</p>
                        </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        {/* Title */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Tiêu đề chính
                            </label>
                            <input
                                type="text"
                                value={settings.heroTitle}
                                onChange={e => handleChange('heroTitle', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Nhập tiêu đề..."
                            />
                        </div>

                        {/* Subtitle */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Mô tả phụ
                            </label>
                            <textarea
                                rows={3}
                                value={settings.heroSubtitle}
                                onChange={e => handleChange('heroSubtitle', e.target.value)}
                                className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Nhập mô tả..."
                            />
                        </div>

                        {/* CTA Button */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Nút hành động (CTA)
                            </label>
                            <input
                                type="text"
                                value={settings.heroCta}
                                onChange={e => handleChange('heroCta', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Đặt chỗ ngay"
                            />
                        </div>

                        {/* Background Image Upload */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Ảnh nền Hero
                            </label>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                                {/* Preview */}
                                <div className="relative h-52 w-full overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 sm:w-64">
                                    {settings.heroBackgroundImage ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={settings.heroBackgroundImage}
                                                alt="Hero background preview"
                                                className="absolute inset-0 size-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white shadow-lg transition hover:bg-red-600"
                                            >
                                                <TrashIcon className="size-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex size-full flex-col items-center justify-center text-neutral-400">
                                            <PhotoIcon className="size-10" />
                                            <span className="mt-2 text-xs">Chưa có ảnh nền</span>
                                            <span className="text-xs text-neutral-400">(Dùng ảnh mặc định)</span>
                                        </div>
                                    )}
                                </div>

                                {/* Upload Button */}
                                <div className="flex flex-col gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                                    >
                                        <CloudArrowUpIcon className="size-5" />
                                        {uploadingImage ? 'Đang upload...' : 'Upload ảnh mới'}
                                    </button>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        Khuyến nghị: 1920x1080px<br />
                                        Định dạng: JPG, PNG, WebP
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ABOUT SECTION CARD */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                            <DocumentTextIcon className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">About Section</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Phần giới thiệu</p>
                        </div>
                    </div>

                    <div className="grid gap-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Tiêu đề
                            </label>
                            <input
                                type="text"
                                value={settings.aboutTitle}
                                onChange={e => handleChange('aboutTitle', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Câu chuyện của Nerd"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Nội dung
                            </label>
                            <textarea
                                rows={5}
                                value={settings.aboutContent}
                                onChange={e => handleChange('aboutContent', e.target.value)}
                                className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Nhập nội dung giới thiệu..."
                            />
                        </div>
                    </div>
                </div>

                {/* NEWS CAROUSEL SECTION CARD */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                            <NewspaperIcon className="size-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Tin tức & Sự kiện</h2>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">Cấu hình carousel tin tức</p>
                        </div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                        {/* Title */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Tiêu đề section
                            </label>
                            <input
                                type="text"
                                value={settings.newsTitle}
                                onChange={e => handleChange('newsTitle', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Tin tức & Sự kiện"
                            />
                        </div>

                        {/* Subtitle */}
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Mô tả
                            </label>
                            <input
                                type="text"
                                value={settings.newsSubtitle}
                                onChange={e => handleChange('newsSubtitle', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                placeholder="Cập nhật những hoạt động mới nhất..."
                            />
                        </div>

                        {/* News Limit */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Số bài viết hiển thị
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={settings.newsLimit}
                                onChange={e => handleChange('newsLimit', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                            />
                        </div>

                        {/* Autoplay Delay */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Thời gian chuyển slide (ms)
                            </label>
                            <input
                                type="number"
                                min="1000"
                                max="10000"
                                step="500"
                                value={settings.newsAutoplayDelay}
                                onChange={e => handleChange('newsAutoplayDelay', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                            />
                        </div>

                        {/* Autoplay Toggle */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Tự động chuyển slide
                            </label>
                            <select
                                value={settings.newsAutoplay}
                                onChange={e => handleChange('newsAutoplay', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                            >
                                <option value="true">Bật</option>
                                <option value="false">Tắt</option>
                            </select>
                        </div>

                        {/* Show Navigation */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                Hiển thị nút điều hướng
                            </label>
                            <select
                                value={settings.newsShowNavigation}
                                onChange={e => handleChange('newsShowNavigation', e.target.value)}
                                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                            >
                                <option value="true">Bật</option>
                                <option value="false">Tắt</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        loading={saving}
                        disabled={saving}
                        className="px-6"
                    >
                        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
