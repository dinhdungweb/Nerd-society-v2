'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

export async function getStudyDateStats() {
    const session = await getServerSession(authOptions)
    if (!session?.user /* || session.user.role !== 'ADMIN' */) {
        // return { success: false, error: 'Unauthorized' }
    }

    try {
        const [totalProfiles, totalSlots, totalAvailability] = await Promise.all([
            prisma.studyProfile.count(),
            prisma.studySlot.count({ where: { isActive: true } }),
            prisma.userStudyAvailability.count({ where: { status: 'OPEN' } })
        ])

        return {
            success: true,
            data: {
                totalProfiles,
                totalSlots,
                totalAvailability
            }
        }
    } catch (error) {
        console.error('Error fetching study date stats:', error)
        return { success: false, error: 'Failed to fetch stats' }
    }
}

export async function getRegisteredProfiles() {
    try {
        const profiles = await prisma.studyProfile.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        })
        return profiles
    } catch (error) {
        return []
    }
}
