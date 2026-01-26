import { prisma } from '@/lib/prisma'
import HeaderNerd from '@/components/landing/HeaderNerd'
import FooterNerd from '@/components/landing/FooterNerd'

async function getSiteSettings() {
    const settings = await prisma.setting.findMany()
    const config = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value
        return acc
    }, {} as Record<string, string>)
    return config
}

export default async function StudyDateLayout({ children }: { children: React.ReactNode }) {
    const config = await getSiteSettings()

    return (
        <>
            <HeaderNerd logoUrl={config.siteLogo} logoLightUrl={config.siteLogoLight} />
            <div className="bg-neutral-50 pb-16 pt-24 dark:bg-neutral-950">
                <div className="container mx-auto">
                    {children}
                </div>
            </div>
            <FooterNerd logoUrl={config.siteLogoLight || config.siteLogo} />
        </>
    )
}
