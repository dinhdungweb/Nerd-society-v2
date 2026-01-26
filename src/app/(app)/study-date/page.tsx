import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function StudyDateRootPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    redirect('/study-date/dashboard')
}
