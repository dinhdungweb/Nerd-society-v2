'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AvailabilityStatus } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

// Helper to get Monday of the current week (or future week)
function getWeekStart(date: Date = new Date()): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
}

export async function getActiveLocations() {
    try {
        const locations = await prisma.location.findMany({
            where: { isActive: true },
            select: { id: true, name: true, address: true }
        })
        return locations
    } catch (error) {
        console.error('Error fetching locations:', error)
        return []
    }
}

export async function getStudySlots(locationId: string) {
    try {
        const slots = await prisma.studySlot.findMany({
            where: {
                locationId,
                isActive: true,
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' },
            ],
        })
        return slots
    } catch (error) {
        console.error('Error fetching study slots:', error)
        return []
    }
}

export async function getUserAvailability(weekStart: Date) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return []

    try {
        const availability = await prisma.userStudyAvailability.findMany({
            where: {
                userId: session.user.id,
                weekStart: weekStart,
                status: { in: ['OPEN', 'MATCHED'] }
            },
            include: {
                slot: true
            }
        })
        return availability
    } catch (error) {
        console.error('Error fetching user availability:', error)
        return []
    }
}

export async function saveUserAvailability(slotIds: string[], weekStart: Date) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        // 1. Find existing availabilities for this week
        const existing = await prisma.userStudyAvailability.findMany({
            where: {
                userId: session.user.id,
                weekStart: weekStart,
            },
            select: { id: true, slotId: true },
        })

        const existingSlotIds = existing.map(e => e.slotId)

        // 2. Identify slots to add and remove
        const toAdd = slotIds.filter(id => !existingSlotIds.includes(id))
        const toRemove = existingSlotIds.filter(id => !slotIds.includes(id))

        // 3. Delete removed slots (only if OPEN, ideally shouldn't delete MATCHED ones without warning, but for MVP we might restrict in UI)
        // For safety, only delete 'OPEN' status
        if (toRemove.length > 0) {
            await prisma.userStudyAvailability.deleteMany({
                where: {
                    userId: session.user.id,
                    weekStart: weekStart,
                    slotId: { in: toRemove },
                    status: 'OPEN',
                },
            })
        }

        // 4. Create new slots
        if (toAdd.length > 0) {
            await prisma.userStudyAvailability.createMany({
                data: toAdd.map(slotId => ({
                    userId: session.user.id!,
                    slotId,
                    weekStart,
                    status: AvailabilityStatus.OPEN,
                })),
                skipDuplicates: true,
            })
        }

        revalidatePath('/study-date/planner')
        return { success: true }
    } catch (error) {
        console.error('Error saving availability:', error)
        return { success: false, error: 'Failed to save availability' }
    }
}

export async function cancelRegistration(availabilityId: string) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        await prisma.userStudyAvailability.delete({
            where: {
                id: availabilityId,
                userId: session.user.id // Ensure ownership
            }
        })
        revalidatePath('/study-date/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Error cancelling registration:', error)
        return { success: false, error: 'Failed to cancel registration' }
    }
}
