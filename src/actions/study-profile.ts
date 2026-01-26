'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
    StudySeeking,
    StudyDateLevel,
    StudyFormat,
    StudyWorkMode,
    InteractionLevel,
    StudyEnvironment,
    IntroExtro,
    SupportPreference
} from '@prisma/client'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

export type StudyProfileData = {
    seeking: StudySeeking[]
    dateLevel?: StudyDateLevel
    preferredFormat?: StudyFormat
    workMode?: StudyWorkMode
    interactionLevel?: InteractionLevel
    environment?: StudyEnvironment
    introExtro?: IntroExtro
    primaryFocus?: string
    supportPreference?: SupportPreference
    ageRangeMin?: number
    ageRangeMax?: number
    shareContact?: boolean
}

export async function getStudyProfile() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return null
    }

    try {
        const profile = await prisma.studyProfile.findUnique({
            where: { userId: session.user.id },
        })
        return profile
    } catch (error) {
        console.error('Error fetching study profile:', error)
        return null
    }
}

export async function upsertStudyProfile(data: StudyProfileData) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        const profile = await prisma.studyProfile.upsert({
            where: { userId: session.user.id },
            update: {
                ...data,
            },
            create: {
                userId: session.user.id,
                ...data,
            },
        })

        revalidatePath('/study-date/profile')
        return { success: true, data: profile }
    } catch (error) {
        console.error('Error updating study profile:', error)
        return { success: false, error: 'Failed to update profile' }
    }
}
