import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import ProfileForm from './ProfileForm'

export const metadata: Metadata = {
    title: 'Account Settings',
}

export default async function SettingsPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
    })

    if (!user) redirect('/login')

    return <ProfileForm user={user} />
}
