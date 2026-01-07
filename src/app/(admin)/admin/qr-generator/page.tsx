'use client'

import { useState, useRef, useCallback } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import {
    QrCodeIcon,
    ArrowDownTrayIcon,
    LinkIcon,
    SwatchIcon,
    ArrowsPointingOutIcon,
    PhotoIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import ImageUploader from '@/components/admin/ImageUploader'

// Default logo URL - empty when none is selected
const DEFAULT_LOGO = ''

const sizeOptions = [
    { value: 128, label: 'Nhỏ (128px)' },
    { value: 256, label: 'Vừa (256px)' },
    { value: 512, label: 'Lớn (512px)' },
    { value: 1024, label: 'Rất lớn (1024px)' },
]

const colorPresets = [
    { bg: '#ffffff', fg: '#000000', label: 'Đen trắng' },
    { bg: '#ffffff', fg: '#16a34a', label: 'Xanh lá' },
    { bg: '#ffffff', fg: '#2563eb', label: 'Xanh dương' },
    { bg: '#ffffff', fg: '#dc2626', label: 'Đỏ' },
    { bg: '#1f2937', fg: '#ffffff', label: 'Tối' },
]

export default function QRGeneratorPage() {
    const [url, setUrl] = useState('https://nerdsociety.com.vn')
    const [size, setSize] = useState(256)
    const [bgColor, setBgColor] = useState('#ffffff')
    const [fgColor, setFgColor] = useState('#000000')
    const [showLogo, setShowLogo] = useState(true)
    const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO)
    const canvasRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<HTMLDivElement>(null)

    // Logo settings for QR code - only show logo if URL is set
    const imageSettings = (showLogo && logoUrl) ? {
        src: logoUrl,
        height: Math.round(size * 0.2),
        width: Math.round(size * 0.2),
        excavate: true,
    } : undefined

    const downloadPNG = useCallback(() => {
        if (!canvasRef.current) return
        const canvas = canvasRef.current.querySelector('canvas')
        if (!canvas) return

        const link = document.createElement('a')
        link.download = `qr-code-${Date.now()}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        toast.success('Đã tải về PNG')
    }, [])

    const downloadSVG = useCallback(() => {
        if (!svgRef.current) return
        const svg = svgRef.current.querySelector('svg')
        if (!svg) return

        const serializer = new XMLSerializer()
        const svgString = serializer.serializeToString(svg)
        const blob = new Blob([svgString], { type: 'image/svg+xml' })
        const link = document.createElement('a')
        link.download = `qr-code-${Date.now()}.svg`
        link.href = URL.createObjectURL(blob)
        link.click()
        toast.success('Đã tải về SVG')
    }, [])

    const applyPreset = (preset: typeof colorPresets[0]) => {
        setBgColor(preset.bg)
        setFgColor(preset.fg)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <QrCodeIcon className="size-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        Tạo QR Code
                    </h1>
                    <p className="text-sm text-neutral-500">
                        Tạo QR Code cho link marketing và quảng cáo
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Settings Panel */}
                <div className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    {/* URL Input */}
                    <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            <LinkIcon className="size-4" />
                            Đường dẫn (URL)
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                    </div>

                    {/* Size Selection */}
                    <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            <ArrowsPointingOutIcon className="size-4" />
                            Kích thước
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {sizeOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSize(opt.value)}
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${size === opt.value
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Color Presets */}
                    <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            <SwatchIcon className="size-4" />
                            Màu sắc
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {colorPresets.map((preset, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => applyPreset(preset)}
                                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${bgColor === preset.bg && fgColor === preset.fg
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                        : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'
                                        }`}
                                >
                                    <div
                                        className="size-5 rounded border"
                                        style={{ backgroundColor: preset.bg }}
                                    >
                                        <div
                                            className="size-3 m-0.5 rounded-sm"
                                            style={{ backgroundColor: preset.fg }}
                                        />
                                    </div>
                                    <span className="text-neutral-700 dark:text-neutral-300">
                                        {preset.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Colors */}
                        <div className="mt-4 flex gap-4">
                            <div className="flex-1">
                                <label className="mb-1 block text-xs text-neutral-500">Màu nền</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="size-10 cursor-pointer rounded-lg border border-neutral-200 p-1 dark:border-neutral-700"
                                    />
                                    <input
                                        type="text"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm uppercase dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="mb-1 block text-xs text-neutral-500">Màu QR</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={fgColor}
                                        onChange={(e) => setFgColor(e.target.value)}
                                        className="size-10 cursor-pointer rounded-lg border border-neutral-200 p-1 dark:border-neutral-700"
                                    />
                                    <input
                                        type="text"
                                        value={fgColor}
                                        onChange={(e) => setFgColor(e.target.value)}
                                        className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 font-mono text-sm uppercase dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Logo Settings */}
                    <div>
                        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            <PhotoIcon className="size-4" />
                            Logo
                        </label>
                        <div className="space-y-3">
                            {/* Toggle */}
                            <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">Hiển thị logo ở giữa QR</span>
                                <button
                                    onClick={() => setShowLogo(!showLogo)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showLogo ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`}
                                >
                                    <span
                                        className={`inline-block size-4 transform rounded-full bg-white transition-transform ${showLogo ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                            {/* Logo Uploader */}
                            {showLogo && (
                                <ImageUploader
                                    images={logoUrl ? [logoUrl] : []}
                                    onChange={(urls) => setLogoUrl(urls[0] || DEFAULT_LOGO)}
                                    multiple={false}
                                    label="Chọn logo"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Xem trước
                    </h3>

                    {/* QR Preview */}
                    <div className="flex flex-1 items-center justify-center rounded-xl bg-neutral-50 p-8 dark:bg-neutral-800">
                        <div ref={svgRef} className="inline-block rounded-lg bg-white p-4 shadow-lg">
                            <QRCodeSVG
                                value={url || 'https://nerdsociety.vn'}
                                size={Math.min(size, 256)}
                                bgColor={bgColor}
                                fgColor={fgColor}
                                level="H"
                                imageSettings={(showLogo && logoUrl) ? {
                                    src: logoUrl,
                                    height: Math.round(Math.min(size, 256) * 0.2),
                                    width: Math.round(Math.min(size, 256) * 0.2),
                                    excavate: true,
                                } : undefined}
                            />
                        </div>
                    </div>

                    {/* Hidden Canvas for PNG download */}
                    <div ref={canvasRef} className="hidden">
                        <QRCodeCanvas
                            value={url || 'https://nerdsociety.vn'}
                            size={size}
                            bgColor={bgColor}
                            fgColor={fgColor}
                            level="H"
                            imageSettings={imageSettings}
                        />
                    </div>

                    {/* Download Buttons */}
                    <div className="mt-6 flex gap-3">
                        <button
                            onClick={downloadPNG}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-700"
                        >
                            <ArrowDownTrayIcon className="size-5" />
                            Tải PNG
                        </button>
                        <button
                            onClick={downloadSVG}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
                        >
                            <ArrowDownTrayIcon className="size-5" />
                            Tải SVG
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
