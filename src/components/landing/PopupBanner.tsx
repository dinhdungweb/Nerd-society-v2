'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface PopupSettings {
    popupActive?: string
    popupImage?: string
    popupLink?: string
    popupTitle?: string
    popupDelay?: string
    popupPosition?: string
}

// Helper to get position classes
const getPositionClass = (position?: string) => {
    switch (position) {
        case 'top-left':
            return 'top-4 left-4 sm:top-6 sm:left-6'
        case 'top-right':
            return 'top-4 right-4 sm:top-6 sm:right-6'
        case 'bottom-left':
            return 'bottom-4 left-4 sm:bottom-6 sm:left-6'
        case 'bottom-right':
            return 'bottom-4 right-4 sm:bottom-6 sm:right-6'
        case 'center':
        default:
            return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
    }
}

export default function PopupBanner() {
    const [isVisible, setIsVisible] = useState(false)
    const [settings, setSettings] = useState<PopupSettings | null>(null)

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/admin/settings')
                if (res.ok) {
                    const data = await res.json()
                    setSettings(data)

                    // Check if popup should show
                    console.log('Popup settings loaded:', data)
                    if (data.popupActive === 'true' && data.popupImage) {
                        const hasSeenPopup = sessionStorage.getItem('hasSeenPopup')
                        if (!hasSeenPopup) {
                            const delay = parseInt(data.popupDelay || '2000', 10)
                            setTimeout(() => setIsVisible(true), delay)
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching popup settings:', error)
            }
        }
        fetchSettings()
    }, [])

    const handleClose = () => {
        setIsVisible(false)
        sessionStorage.setItem('hasSeenPopup', 'true')
    }

    if (!settings) return null // Wait for settings
    if (!settings.popupImage) return null

    const positionClass = getPositionClass(settings.popupPosition)

    // Only render if active (or debug)
    if (settings.popupActive !== 'true') return null
    if (!isVisible) return null

    // For center position, use a flex overlay layout
    if (settings.popupPosition === 'center') {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={handleClose}
                />

                {/* Content */}
                <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900 animate-in fade-in zoom-in-95 duration-300">
                    <button
                        onClick={handleClose}
                        className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1 text-neutral-500 backdrop-blur hover:bg-white hover:text-neutral-900 dark:bg-black/50 dark:text-neutral-400 dark:hover:bg-black/70 dark:hover:text-white"
                    >
                        <XMarkIcon className="size-5" />
                    </button>

                    {settings.popupLink ? (
                        <Link href={settings.popupLink} onClick={handleClose} className="block relative aspect-[4/5] w-full sm:aspect-[4/3]">
                            <Image
                                src={settings.popupImage}
                                alt={settings.popupTitle || 'Popup Banner'}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 600px"
                                priority
                            />
                        </Link>
                    ) : (
                        <div className="relative aspect-[4/5] w-full sm:aspect-[4/3]">
                            <Image
                                src={settings.popupImage}
                                alt={settings.popupTitle || 'Popup Banner'}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 600px"
                                priority
                            />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // For corners, use fixed positioning without backdrop
    return (
        <div className={`fixed z-[100] p-4 sm:p-6 w-full max-w-lg transition-all duration-300 ${positionClass}`}>
            <div className="relative w-full overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900 animate-in fade-in zoom-in-95 duration-300">
                <button
                    onClick={handleClose}
                    className="absolute right-3 top-3 z-10 rounded-full bg-white/80 p-1 text-neutral-500 backdrop-blur hover:bg-white hover:text-neutral-900 dark:bg-black/50 dark:text-neutral-400 dark:hover:bg-black/70 dark:hover:text-white"
                >
                    <XMarkIcon className="size-5" />
                </button>

                {settings.popupLink ? (
                    <Link href={settings.popupLink} onClick={handleClose} className="block relative aspect-[4/5] w-full sm:aspect-[4/3]">
                        <Image
                            src={settings.popupImage}
                            alt={settings.popupTitle || 'Popup Banner'}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 600px"
                            priority
                        />
                    </Link>
                ) : (
                    <div className="relative aspect-[4/5] w-full sm:aspect-[4/3]">
                        <Image
                            src={settings.popupImage}
                            alt={settings.popupTitle || 'Popup Banner'}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, 600px"
                            priority
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
