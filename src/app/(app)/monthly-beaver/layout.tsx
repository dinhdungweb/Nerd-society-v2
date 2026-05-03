import { HeaderNerd, FooterNerd } from '@/components/landing'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Monthly Beaver — Gói Thành Viên | Nerd Society',
    description: 'Đăng ký gói thành viên Monthly Beaver để check-in nhanh bằng thẻ, hưởng ưu đãi đặc biệt tại Nerd Society.',
}

async function getSettings() {
    try {
        const settings = await prisma.setting.findMany()
        return settings.reduce((acc: Record<string, string>, curr: { key: string; value: string }) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)
    } catch {
        return {}
    }
}

export default async function NerdPassLayout({ children }: { children: React.ReactNode }) {
    const settings = await getSettings()

    return (
        <>
            <HeaderNerd logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} />
            <main>{children}</main>
            <FooterNerd logoUrl={settings.siteLogoLight || settings.siteLogo} />
        </>
    )
}
