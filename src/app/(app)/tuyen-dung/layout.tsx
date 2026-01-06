import { HeaderNerd, FooterNerd } from '@/components/landing'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Tuyển dụng | Nerd Society',
    description: 'Gia nhập đội ngũ Nerd Society - Cơ hội nghề nghiệp hấp dẫn cho bạn trẻ năng động.',
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

export default async function TuyenDungLayout({ children }: { children: React.ReactNode }) {
    const settings = await getSettings()

    return (
        <>
            <HeaderNerd logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} />
            <main>{children}</main>
            <FooterNerd logoUrl={settings.siteLogoLight || settings.siteLogo} />
        </>
    )
}
