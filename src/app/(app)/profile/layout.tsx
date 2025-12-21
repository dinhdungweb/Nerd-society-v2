import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import ProfileSidebar from '@/components/profile/ProfileSidebar'
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

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    const config = await getSiteSettings()

    return (
        <>
            <HeaderNerd logoUrl={config.siteLogo} logoLightUrl={config.siteLogoLight} />
            <div className="bg-neutral-50 min-h-screen pt-28 pb-10 dark:bg-neutral-950">
                <div className="container max-w-[100rem]">
                    <h1 className="mb-8 text-3xl font-bold text-neutral-900 dark:text-white">
                        Tài khoản của tôi
                    </h1>
                    <div className="grid gap-8 lg:grid-cols-4">
                        {/* Sidebar */}
                        <div className="space-y-1 lg:col-span-1">
                            <ProfileSidebar />
                        </div>

                        {/* Content */}
                        <div className="lg:col-span-3">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <FooterNerd logoUrl={config.siteLogo} />
        </>
    )
}

