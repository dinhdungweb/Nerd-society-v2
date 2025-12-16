'use client'

import { CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import React, { useMemo } from 'react'

interface Booking {
    id: string
    bookingCode: string
    date: string
    startTime: string
    endTime: string
    status: string
    customerName: string
    customerPhone: string
    room: { name: string; type: string } | null
    location: { name: string }
    estimatedAmount: number
}

interface Room {
    id: string
    name: string
    type: string
}

interface Location {
    id: string
    name: string
}

interface BookingCalendarViewProps {
    bookings: any[]
    rooms: Room[]
    selectedDate: Date
    onDateChange: (date: Date) => void
    onBookingClick: (booking: any) => void
    locations: Location[]
    selectedLocation: string
    onLocationChange: (locationId: string) => void
}

const statusColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', accent: 'bg-amber-500' },
    CONFIRMED: { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-400', accent: 'bg-blue-500' },
    IN_PROGRESS: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400', accent: 'bg-emerald-500' },
    COMPLETED: { bg: 'bg-neutral-100 dark:bg-neutral-800', border: 'border-neutral-200 dark:border-neutral-700', text: 'text-neutral-600 dark:text-neutral-400', accent: 'bg-neutral-500' },
    CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-700', text: 'text-red-700 dark:text-red-400', accent: 'bg-red-500' },
    NO_SHOW: { bg: 'bg-neutral-100 dark:bg-neutral-800', border: 'border-neutral-200 dark:border-neutral-700', text: 'text-neutral-500 dark:text-neutral-500', accent: 'bg-neutral-500' },
}

const statusLabels: Record<string, string> = {
    PENDING: 'Chờ cọc',
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang sử dụng',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    NO_SHOW: 'Không đến',
}

// Generate time slots from 08:00 to 22:00
function generateTimeSlots(): string[] {
    const slots: string[] = []
    for (let hour = 8; hour <= 22; hour++) {
        slots.push(`${hour.toString().padStart(2, '0')}:00`)
    }
    return slots
}

// Parse time string to minutes from midnight
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

export default function BookingCalendarView({
    bookings,
    rooms,
    selectedDate,
    onDateChange,
    onBookingClick,
    locations,
    selectedLocation,
    onLocationChange,
}: BookingCalendarViewProps) {
    const timeSlots = useMemo(() => generateTimeSlots(), [])

    // Filter bookings for selected date (exclude CANCELLED)
    const dayBookings = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        return bookings.filter(b => {
            // Exclude cancelled bookings - they shouldn't block the slot
            if (b.status === 'CANCELLED') return false
            const bookingDate = new Date(b.date)
            return format(bookingDate, 'yyyy-MM-dd') === dateStr
        })
    }, [bookings, selectedDate])



    // Get booking duration in slots
    const getBookingDuration = (booking: Booking): number => {
        const startMinutes = timeToMinutes(booking.startTime)
        const endMinutes = timeToMinutes(booking.endTime)
        return (endMinutes - startMinutes) / 60
    }

    // Navigate dates
    const prevDay = () => {
        const newDate = new Date(selectedDate)
        newDate.setDate(newDate.getDate() - 1)
        onDateChange(newDate)
    }

    const nextDay = () => {
        const newDate = new Date(selectedDate)
        newDate.setDate(newDate.getDate() + 1)
        onDateChange(newDate)
    }

    const goToToday = () => {
        onDateChange(new Date())
    }

    const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

    return (
        <div className="space-y-4">
            {/* Date Navigation */}
            <div className="flex items-center justify-between rounded-xl bg-white p-4 border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                    <button
                        onClick={prevDay}
                        className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    >
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="text-center">
                        <p className="text-lg font-bold text-neutral-900 dark:text-white">
                            {format(selectedDate, 'EEEE', { locale: vi })}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {format(selectedDate, 'dd/MM/yyyy', { locale: vi })}
                        </p>
                    </div>
                    <button
                        onClick={nextDay}
                        className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    >
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {!isToday && (
                        <button
                            onClick={goToToday}
                            className="px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg dark:text-primary-400 dark:hover:bg-primary-900/20"
                        >
                            Hôm nay
                        </button>
                    )}
                    <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                        <CalendarDaysIcon className="size-5" />
                        <span>{dayBookings.length} booking</span>
                    </div>

                    {/* Location Filter */}
                    {locations.length > 0 && (
                        <select
                            value={selectedLocation}
                            onChange={(e) => onLocationChange(e.target.value)}
                            className="pl-3 pr-8 py-1.5 text-sm border border-neutral-300 rounded-lg bg-white dark:bg-neutral-800 dark:border-neutral-600 dark:text-white"
                        >
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
                {Object.entries(statusLabels).filter(([key]) => ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(key)).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                        <div className={`size-3 rounded ${statusColors[key]?.bg} border ${statusColors[key]?.border}`} />
                        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="rounded-xl bg-white border border-neutral-200 dark:bg-neutral-900 dark:border-neutral-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                        {/* Header Row */}
                        <div className="grid border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50"
                            style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}>
                            <div className="p-3 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400 flex items-center">
                                <ClockIcon className="size-4 mr-1" />
                                Giờ
                            </div>
                            {rooms.map(room => (
                                <div key={room.id} className="p-3 text-center border-l border-neutral-200 dark:border-neutral-700">
                                    <p className="font-medium text-neutral-900 dark:text-white text-sm">{room.name}</p>
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        {room.type === 'POD_MONO' ? 'Pod' : room.type === 'POD_MULTI' ? 'Pod Multi' : 'Meeting'}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Time Slots */}
                        {timeSlots.map((timeSlot, rowIndex) => (
                            <div
                                key={timeSlot}
                                className="grid border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                                style={{ gridTemplateColumns: `80px repeat(${rooms.length}, 1fr)` }}
                            >
                                {/* Time Label */}
                                <div className="p-2 text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-start justify-center">
                                    {timeSlot}
                                </div>

                                {/* Room Cells */}
                                {rooms.map(room => {
                                    // Find booking starting in this specific hour slot
                                    const slotStartMinutes = timeToMinutes(timeSlot)
                                    const slotEndMinutes = slotStartMinutes + 60

                                    const booking = dayBookings.find(b => {
                                        if (b.room?.name !== room.name) return false
                                        const start = timeToMinutes(b.startTime)
                                        return start >= slotStartMinutes && start < slotEndMinutes
                                    })

                                    const duration = booking ? getBookingDuration(booking) : 0
                                    const colors = booking ? statusColors[booking.status] || statusColors.PENDING : null

                                    // Calculate top offset for bookings not starting exactly at the hour
                                    const startMinutes = booking ? timeToMinutes(booking.startTime) : 0
                                    const HOUR_HEIGHT = 100
                                    const topOffset = ((startMinutes - slotStartMinutes) / 60) * HOUR_HEIGHT

                                    return (
                                        <div
                                            key={room.id}
                                            className="relative border-l border-neutral-100 dark:border-neutral-800"
                                            style={{ minHeight: `${HOUR_HEIGHT}px` }}
                                        >
                                            {booking && (
                                                <button
                                                    onClick={() => onBookingClick(booking)}
                                                    className={`absolute inset-x-1 rounded shadow-sm text-left transition-all hover:shadow-md hover:scale-[1.02] z-10 overflow-hidden group flex flex-col ${colors?.bg} border border-transparent`}
                                                    style={{
                                                        height: `calc(${duration * HOUR_HEIGHT}px - 2px)`, // Reduced gap to 2px
                                                        top: `${topOffset + 1}px` // Reduced top padding to 1px
                                                    }}
                                                >
                                                    {/* Accent Bar */}
                                                    <div className={`absolute left-0 inset-y-0 w-1 ${colors?.accent}`} />

                                                    <div className="pl-3 pr-2 py-1.5 flex flex-col h-full justify-between">
                                                        <div>
                                                            <p className={`text-xs font-semibold truncate leading-tight ${colors?.text}`}>
                                                                {booking.customerName}
                                                            </p>
                                                            {/* Only show time if height > 20px */}
                                                            {(duration * HOUR_HEIGHT) > 20 && (
                                                                <p className={`text-[10px] ${colors?.text} opacity-75 leading-tight mt-0.5`}>
                                                                    {booking.startTime} - {booking.endTime}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Only show status if height > 40px */}
                                                        {(duration * HOUR_HEIGHT) > 40 && (
                                                            <p className={`text-[10px] font-medium ${colors?.text} opacity-90 truncate mt-1`}>
                                                                {statusLabels[booking.status]}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {dayBookings.length === 0 && (
                <div className="text-center py-8">
                    <CalendarDaysIcon className="mx-auto size-12 text-neutral-300 dark:text-neutral-600" />
                    <p className="mt-4 text-lg font-medium text-neutral-900 dark:text-white">
                        Không có booking
                    </p>
                    <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        Ngày {format(selectedDate, 'dd/MM/yyyy')} chưa có đặt lịch nào
                    </p>
                </div>
            )}
        </div>
    )
}
