'use server'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.id) {
        throw new Error('Unauthorized')
    }

    const name = formData.get('name') as string
    const gender = formData.get('gender') as string
    // Email is usually not editable directly without verification
    // const email = formData.get('email') as string 
    const dateOfBirthStr = formData.get('dateOfBirth') as string
    const address = formData.get('address') as string
    const phone = formData.get('phone') as string
    const bio = formData.get('bio') as string
    const avatar = formData.get('avatar') as string

    const dateOfBirth = dateOfBirthStr ? new Date(dateOfBirthStr) : null

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name,
                gender,
                dateOfBirth,
                address,
                phone,
                bio,
                avatar: avatar || undefined, // Only update if avatar is provided
            },
        })

        revalidatePath('/profile/settings')
        return { success: true }
    } catch (error) {
        console.error('Error updating profile:', error)
        return { success: false, error: 'Failed to update profile' }
    }
}
