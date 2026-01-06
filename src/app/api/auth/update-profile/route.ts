import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { name, phone, gender, dateOfBirth, address, bio, avatar, region, occupation, school, visitPurpose } = body

        // Check if profile is completed (V2 fields filled + dateOfBirth for birthday benefits)
        const isProfileComplete = dateOfBirth && region && occupation && visitPurpose && visitPurpose.length > 0

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name || null,
                phone: phone || null,
                gender: gender || null,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                address: address || null,
                bio: bio || null,
                avatar: avatar || null,
                // V2 Member Profile fields
                region: region || null,
                occupation: occupation || null,
                school: school || null,
                visitPurpose: visitPurpose || [],
                profileCompletedAt: isProfileComplete ? new Date() : null,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error updating profile:', error)
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }
}
