import { HeaderNerd, FooterNerd } from '@/components/landing'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Góp ý | Nerd Society',
    description: 'Chia sẻ góp ý, đề xuất hoặc phản hồi của bạn để Nerd Society ngày càng hoàn thiện hơn.',
}

async function getSettings() {
    try {
        const settings = await prisma.setting.findMany()
        return settings.reduce((acc: Record<string, string>, curr: { key: string; value: string }) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)
    } catch (error) {
        return {}
    }
}

export default async function GopYLayout({ children }: { children: React.ReactNode }) {
    const settings = await getSettings()

    return (
        <>
            <HeaderNerd logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} />
            <main>{children}</main>
            <FooterNerd logoUrl={settings.siteLogoLight || settings.siteLogo} />
        </>
    )
}
