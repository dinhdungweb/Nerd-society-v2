import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import ProfileHeader from '@/components/profile/ProfileHeader'
import HeaderNerd from '@/components/landing/HeaderNerd'
import FooterNerd from '@/components/landing/FooterNerd'
import { GiftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

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

    const [config, user] = await Promise.all([
        getSiteSettings(),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                name: true,
                email: true,
                avatar: true,
                nerdCoinBalance: true,
                nerdCoinTier: true,
                // V2: Check if profile is completed
                dateOfBirth: true,
                region: true,
                occupation: true,
                visitPurpose: true,
            },
        }),
    ])

    return (
        <>
            <HeaderNerd logoUrl={config.siteLogo} logoLightUrl={config.siteLogoLight} />
            <div className="min-h-screen bg-neutral-50 pb-16 pt-24 dark:bg-neutral-950">
                <div className="container">
                    {/* Profile Header with User Info & Tabs */}
                    <ProfileHeader
                        user={{
                            name: user?.name || null,
                            email: user?.email || null,
                            avatar: user?.avatar || null,
                            nerdCoinBalance: user?.nerdCoinBalance || 0,
                            nerdCoinTier: user?.nerdCoinTier || 'BRONZE',
                        }}
                    />

                    {/* V2: Banner CTA hoàn thiện hồ sơ - check actual fields */}
                    {!(user?.dateOfBirth && user?.region && user?.occupation && user?.visitPurpose && user?.visitPurpose.length > 0) && (
                        <a
                            href="/profile/settings"
                            className="mt-4 flex items-center gap-4 rounded-2xl border border-primary-200 bg-gradient-to-r from-primary-50 to-amber-50 p-4 transition-all hover:shadow-md dark:border-primary-800/50 dark:from-primary-900/20 dark:to-amber-900/20"
                        >
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-lg">
                                <GiftIcon className="size-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-neutral-900 dark:text-white">
                                    Hoàn thiện hồ sơ để nhận ưu đãi sinh nhật
                                </h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    Cập nhật thông tin để theo dõi nâng hạng và nhận nhiều quyền lợi hơn
                                </p>
                            </div>
                            <div className="shrink-0 text-primary-500">
                                <ChevronRightIcon className="size-6" />
                            </div>
                        </a>
                    )}

                    {/* Page Content */}
                    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-800">
                        {children}
                    </div>
                </div>
            </div>
            <FooterNerd logoUrl={config.siteLogoLight || config.siteLogo} />
        </>
    )
}
