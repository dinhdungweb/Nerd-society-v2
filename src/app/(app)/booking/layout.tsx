import HeaderNerd from '@/components/landing/HeaderNerd'
import FooterNerd from '@/components/landing/FooterNerd'
import { prisma } from '@/lib/prisma'
import React from 'react'

async function getSiteSettings() {
    const settings = await prisma.setting.findMany()
    const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)
    return config
}

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
    const config = await getSiteSettings()

    return (
        <>
            <HeaderNerd logoUrl={config.siteLogo} logoLightUrl={config.siteLogoLight} />
            {children}
            <FooterNerd logoUrl={config.siteLogo} />
        </>
    )
}
