'use client'

import { Button } from '@/shared/Button'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { PhotoIcon, TrashIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'

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

    if (loading) return <div className="p-8">Đang tải...</div>

    return (
        <div className="space-y-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-neutral-900">Quản lý nội dung Landing Page</h1>
                <p className="text-neutral-500">Chỉnh sửa các đoạn văn bản trên trang chủ</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 divide-y divide-neutral-200">

                {/* HERO SECTION */}
                <div className="pt-6">
                    <h2 className="mb-4 text-lg font-medium text-neutral-900">Hero Section (Phần đầu trang)</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Tiêu đề chính</label>
                            <input
                                type="text"
                                value={settings.heroTitle}
                                onChange={e => handleChange('heroTitle', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Mô tả phụ</label>
                            <textarea
                                rows={3}
                                value={settings.heroSubtitle}
                                onChange={e => handleChange('heroSubtitle', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Nút hành động (CTA)</label>
                            <input
                                type="text"
                                value={settings.heroCta}
                                onChange={e => handleChange('heroCta', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>

                        {/* Hero Background Image Upload */}
                        <div className="col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Ảnh nền Hero Section</label>
                            <div className="flex items-start gap-4">
                                {/* Preview */}
                                <div className="relative h-36 w-64 overflow-hidden rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-100">
                                    {settings.heroBackgroundImage ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={settings.heroBackgroundImage}
                                                alt="Hero background preview"
                                                className="absolute inset-0 h-full w-full object-cover"
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
                                            <PhotoIcon className="size-12" />
                                            <span className="mt-2 text-xs">Chưa có ảnh nền</span>
                                            <span className="text-xs">(Dùng ảnh mặc định)</span>
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
                                    <Button
                                        type="button"
                                        outline
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage}
                                    >
                                        <CloudArrowUpIcon className="size-5" />
                                        {uploadingImage ? 'Đang upload...' : 'Upload ảnh mới'}
                                    </Button>
                                    <p className="text-xs text-neutral-500">
                                        Kích thước khuyến nghị: 1920x1080px<br />
                                        Định dạng: JPG, PNG, WebP
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ABOUT SECTION */}
                <div className="pt-6">
                    <h2 className="mb-4 text-lg font-medium text-neutral-900">About Section (Giới thiệu)</h2>
                    <div className="grid gap-6">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Tiêu đề</label>
                            <input
                                type="text"
                                value={settings.aboutTitle}
                                onChange={e => handleChange('aboutTitle', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Nội dung</label>
                            <textarea
                                rows={5}
                                value={settings.aboutContent}
                                onChange={e => handleChange('aboutContent', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                    </div>
                </div>

                {/* NEWS CAROUSEL SECTION */}
                <div className="pt-6">
                    <h2 className="mb-4 text-lg font-medium text-neutral-900">Tin tức & Sự kiện (Carousel)</h2>
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Tiêu đề section</label>
                            <input
                                type="text"
                                value={settings.newsTitle}
                                onChange={e => handleChange('newsTitle', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Mô tả</label>
                            <input
                                type="text"
                                value={settings.newsSubtitle}
                                onChange={e => handleChange('newsSubtitle', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Số bài viết hiển thị</label>
                            <input
                                type="number"
                                min="1"
                                max="12"
                                value={settings.newsLimit}
                                onChange={e => handleChange('newsLimit', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Thời gian chuyển slide (ms)</label>
                            <input
                                type="number"
                                min="1000"
                                max="10000"
                                step="500"
                                value={settings.newsAutoplayDelay}
                                onChange={e => handleChange('newsAutoplayDelay', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Tự động chuyển slide</label>
                            <select
                                value={settings.newsAutoplay}
                                onChange={e => handleChange('newsAutoplay', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            >
                                <option value="true">Bật</option>
                                <option value="false">Tắt</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-700">Hiển thị nút điều hướng</label>
                            <select
                                value={settings.newsShowNavigation}
                                onChange={e => handleChange('newsShowNavigation', e.target.value)}
                                className="w-full rounded-lg border border-neutral-300 p-2.5 focus:border-primary-500 focus:ring-primary-500"
                            >
                                <option value="true">Bật</option>
                                <option value="false">Tắt</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="pt-6">
                    <Button type="submit" loading={saving} disabled={saving} color="primary">
                        Lưu thay đổi
                    </Button>
                </div>
            </form>
        </div>
    )
}

