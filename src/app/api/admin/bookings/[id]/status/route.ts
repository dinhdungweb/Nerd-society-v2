import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { calculateSurchargeFromDB, getNerdCoinRewardFromDB } from '@/lib/pricing-db'
import { differenceInMinutes, parseISO } from 'date-fns'
import { getBookingDateTime } from '@/lib/booking-utils'

// POST /api/admin/bookings/[id]/status
export async function POST(
    req: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.email || (session.user.role !== 'ADMIN' && session.user.role !== 'STAFF')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = params
        const body = await req.json()
        const { action } = body // 'CHECK_IN' | 'CHECK_OUT' | 'CANCEL'

        if (!id) {
            return NextResponse.json({ error: 'Missing booking ID' }, { status: 400 })
        }

        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                room: true
            }
        })

        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
        }

        const now = new Date()

        if (action === 'CHECK_IN') {
            if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
                return NextResponse.json({ error: 'Invalid status for check-in' }, { status: 400 })
            }

            // Warning if no deposit paid (PENDING status usually means no deposit)
            const hasDeposit = booking.depositStatus === 'PAID_ONLINE' || booking.depositStatus === 'PAID_CASH'

            // Logic Check-in
            // Determine Service Type for Nerd Coin
            let serviceType: any = 'MEETING'
            if (booking.room.type === 'POD_MONO') serviceType = 'POD_MONO'
            if (booking.room.type === 'POD_MULTI') serviceType = 'POD_MULTI'

            const nerdCoins = await getNerdCoinRewardFromDB(serviceType)

            const updatedBooking = await prisma.booking.update({
                where: { id },
                data: {
                    status: 'IN_PROGRESS',
                    actualStartTime: now,
                    // Issue Nerd Coin
                    nerdCoinIssued: nerdCoins,
                    nerdCoinIssuedAt: nerdCoins > 0 ? now : null
                }
            })

            // TODO: Update Customer's wallet if account exists (Not implemented yet based on instructions)

            return NextResponse.json({
                ...updatedBooking,
                nerdCoinIssued: nerdCoins,
                warning: !hasDeposit ? 'Khách chưa thanh toán cọc. Vui lòng thu tiền tại quầy.' : null
            })
        }

        if (action === 'CHECK_OUT') {
            if (booking.status !== 'IN_PROGRESS') {
                return NextResponse.json({ error: 'Invalid status for check-out' }, { status: 400 })
            }

            // Logic Check-out
            // 1. Calculate Surcharge
            const scheduledStart = getBookingDateTime(booking.date, booking.startTime)
            const scheduledEnd = getBookingDateTime(booking.date, booking.endTime)
            const scheduledDuration = differenceInMinutes(scheduledEnd, scheduledStart)

            // Use actualStartTime or scheduledStart
            const actualStart = booking.actualStartTime || scheduledStart
            const actualDuration = differenceInMinutes(now, scheduledStart) // Always verify against scheduled start for surcharge

            let serviceType: any = 'MEETING'
            if (booking.room.type === 'POD_MONO') serviceType = 'POD_MONO'
            if (booking.room.type === 'POD_MULTI') serviceType = 'POD_MULTI'
            if (booking.room.type === 'MEETING_LONG' || booking.room.type === 'MEETING_ROUND') serviceType = 'MEETING'

            const surcharge = await calculateSurchargeFromDB(
                serviceType,
                actualDuration,
                scheduledDuration,
                booking.guests
            )

            const actualAmount = booking.estimatedAmount + surcharge

            // Only deduct deposit if actually paid (PAID_ONLINE or PAID_CASH, not WAIVED or PENDING)
            const isPaid = booking.depositStatus === 'PAID_ONLINE' || booking.depositStatus === 'PAID_CASH'
            const paidDeposit = isPaid ? booking.depositAmount : 0
            const remainingAmount = actualAmount - paidDeposit

            const updatedBooking = await prisma.booking.update({
                where: { id },
                data: {
                    status: 'COMPLETED',
                    actualEndTime: now,
                    actualAmount: actualAmount,
                    remainingAmount: remainingAmount,
                    // Assuming payment of remaining amount happens immediately via Cash/Sapo
                    // Ideally we should record a separate Payment transaction, but for simplicity we assume settled if 0 or Staff handled it.
                }
            })

            return NextResponse.json({ ...updatedBooking, surcharge })
        }

        if (action === 'CANCEL') {
            const updatedBooking = await prisma.booking.update({
                where: { id },
                data: {
                    status: 'CANCELLED'
                }
            })
            return NextResponse.json(updatedBooking)
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    } catch (error) {
        console.error('Error updating booking status:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
