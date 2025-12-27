
import { Suspense } from 'react'
import ResetPasswordForm from './ResetPasswordForm'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

export default async function ResetPasswordPage() {
    const settings = await getSettings()

    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="size-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div></div>}>
            <ResetPasswordForm logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} />
        </Suspense>
    )
}
