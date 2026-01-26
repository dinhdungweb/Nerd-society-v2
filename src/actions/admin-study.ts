'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

export async function createStudySlot(data: {
    locationId: string
    dayOfWeek: number
    startTime: string
    endTime: string
    capacity: number
}) {
    const session = await getServerSession(authOptions)
    // Check if admin (implement your role check logic here)
    if (!session?.user?.id /* || session.user.role !== 'ADMIN' */) {
        // For MVP testing, might be lax, but usually check role
        // return { success: false, error: 'Unauthorized' }
    }

    try {
        // Check for duplicate
        const existing = await prisma.studySlot.findFirst({
            where: {
                locationId: data.locationId,
                dayOfWeek: data.dayOfWeek,
                startTime: data.startTime,
                endTime: data.endTime,
                isActive: true
            }
        })

        if (existing) {
            return { success: false, error: 'Slot này đã tồn tại' }
        }

        const slot = await prisma.studySlot.create({
            data: {
                ...data,
            }
        })
        revalidatePath('/admin/study-date')
        return { success: true, data: slot }
    } catch (error) {
        console.error('Error creating study slot:', error)
        return { success: false, error: 'Failed to create slot' }
    }
}

export async function deleteStudySlot(id: string) {
    try {
        await prisma.studySlot.delete({ where: { id } })
        revalidatePath('/admin/study-date')
        return { success: true }
    } catch (error) {
        return { success: false, error: 'Failed to delete slot' }
    }
}

export async function getAdminLocations() {
    try {
        return await prisma.location.findMany({
            select: { id: true, name: true }
        })
    } catch (error) {
        return []
    }
}

export async function getAdminStudySlots(locationId: string) {
    if (!locationId) return []
    try {
        return await prisma.studySlot.findMany({
            where: { locationId },
            orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' }
            ],
            include: {
                _count: {
                    select: { availabilities: true }
                }
            }
        })
    } catch (error) {
        return []
    }
}

export async function getSlotRegistrations(slotId: string) {
    if (!slotId) return []
    try {
        const registrations = await prisma.userStudyAvailability.findMany({
            where: { slotId },
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
            orderBy: { createdAt: 'desc' }
        })
        return registrations
    } catch (error) {
        return []
    }
}

export async function getUserStudySlots(userId: string) {
    if (!userId) return []
    try {
        const availabilities = await prisma.userStudyAvailability.findMany({
            where: { userId },
            include: {
                slot: {
                    include: {
                        location: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        return availabilities
    } catch (error) {
        return []
    }
}
