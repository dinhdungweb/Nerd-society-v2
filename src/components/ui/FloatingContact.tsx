'use client'

import { PhoneIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function FloatingContact() {
    const [isVisible, setIsVisible] = useState(false)
    const pathname = usePathname()

    // Hide on admin pages
    const isAdminPage = pathname?.startsWith('/admin')

    useEffect(() => {
        const handleScroll = () => {
            // Show button after scrolling down a bit
            setIsVisible(window.scrollY > 200)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Don't render on admin pages
    if (isAdminPage) return null

    return (
        <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: isVisible ? 1 : 0,
                opacity: isVisible ? 1 : 0
            }}
            className="fixed bottom-24 right-6 z-40"
        >
            <a
                href="tel:0368483689"
                className="group relative flex size-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-colors hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-300"
                aria-label="Call Now"
            >
                {/* Pulsing effect */}
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-400 opacity-75"></span>

                <PhoneIcon className="relative size-6 transition-transform duration-300 group-hover:rotate-12" />
            </a>
        </motion.div>
    )
}

