'use client'

import { Button } from '@/shared/Button'
import { CalendarDaysIcon, UsersIcon } from '@heroicons/react/24/outline'
import { ServiceType } from '@prisma/client'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useSession } from 'next-auth/react'
import { useEffect, useState, useMemo } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import TimeSelect from './TimeSelect'
import DatePickerCustomHeaderSingleMonth from '@/components/DatePickerCustomHeaderSingleMonth'
import DatePickerCustomDay from '@/components/DatePickerCustomDay'
import useSWR from 'swr'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const fetcher = (url: string) => fetch(url).then(res => res.json())
const postFetcher = (url: string, { arg }: { arg: any }) =>
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg)
    }).then(res => res.json())

// Register Vietnamese locale
registerLocale('vi', vi)

interface BookedSlot {
    startTime: string
    endTime: string
}

interface PriceBreakdown {
    estimatedAmount: number
    depositAmount: number
    nerdCoinReward: number
    breakdown: Record<string, unknown>
}

interface BookingFormV2Props {
    roomId: string
    serviceType: ServiceType
    onSubmit: (data: {
        date: Date
        endDate: Date
        startTime: string
        endTime: string
        guests: number
        customerName: string
        customerPhone: string
        customerEmail?: string
        note?: string
    }) => void
    loading?: boolean
}

// Generate time slots from 00:00 to 23:45 (24/7)
function generateTimeSlots(step: number = 30): string[] {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += step) {
            slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`)
        }
    }
    slots.push('24:00')
    return slots
}

// Parse time to minutes
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

// Check if a time slot overlaps with booked slots (handles cross-day)
function isTimeSlotBooked(time: string, bookedSlots: BookedSlot[]): boolean {
    const timeMin = timeToMinutes(time)

    for (const slot of bookedSlots) {
        const startMin = timeToMinutes(slot.startTime)
        const endMin = timeToMinutes(slot.endTime)

        // Cross-day slot: endTime <= startTime
        if (endMin <= startMin) {
            // Slot spans midnight: booked from startTime to 24:00 AND 00:00 to endTime
            if (timeMin >= startMin || timeMin < endMin) {
                return true
            }
        } else {
            // Normal same-day slot
            if (timeMin >= startMin && timeMin < endMin) {
                return true
            }
        }
    }
    return false
}

// Check if the entire booking range overlaps with any booked slot (handles cross-day)
function isRangeOverlapping(startTime: string, endTime: string, bookedSlots: BookedSlot[]): boolean {
    if (!startTime || !endTime) return false

    const newStartMin = timeToMinutes(startTime)
    const newEndMin = timeToMinutes(endTime)
    const newIsCrossDay = newEndMin <= newStartMin

    for (const slot of bookedSlots) {
        const slotStartMin = timeToMinutes(slot.startTime)
        const slotEndMin = timeToMinutes(slot.endTime)
        const slotIsCrossDay = slotEndMin <= slotStartMin

        // Helper: check if two ranges [a1, a2) and [b1, b2) overlap
        const rangesOverlap = (a1: number, a2: number, b1: number, b2: number) => {
            return a1 < b2 && a2 > b1
        }

        if (!newIsCrossDay && !slotIsCrossDay) {
            // Both same-day: simple overlap check
            if (rangesOverlap(newStartMin, newEndMin, slotStartMin, slotEndMin)) {
                return true
            }
        } else if (!newIsCrossDay && slotIsCrossDay) {
            // New is same-day, slot is cross-day
            // Slot occupies [slotStart, 1440) today and [0, slotEnd) tomorrow
            // New occupies [newStart, newEnd) today
            // Check if new overlaps with slot's today portion [slotStart, 1440)
            if (rangesOverlap(newStartMin, newEndMin, slotStartMin, 1440)) {
                return true
            }
        } else if (newIsCrossDay && !slotIsCrossDay) {
            // New is cross-day, slot is same-day
            // New occupies [newStart, 1440) today and [0, newEnd) tomorrow
            // Slot occupies [slotStart, slotEnd) today
            // Check if new's today portion [newStart, 1440) overlaps with slot
            if (rangesOverlap(newStartMin, 1440, slotStartMin, slotEndMin)) {
                return true
            }
        } else {
            // Both cross-day
            // Both occupy late night to early morning
            // They definitely overlap since both span midnight
            // Check: new [newStart, 1440) overlaps slot [slotStart, 1440)?
            // And: new [0, newEnd) overlaps slot [0, slotEnd)?
            if (rangesOverlap(newStartMin, 1440, slotStartMin, 1440) ||
                rangesOverlap(0, newEndMin, 0, slotEndMin)) {
                return true
            }
        }
    }
    return false
}

// Calculate duration in minutes (hỗ trợ multi-day)
function calculateDuration(startDate: Date, endDate: Date, startTime: string, endTime: string): number {
    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)

    // Calculate number of days between dates (using UTC to be consistent with how dates are stored)
    const startDateOnly = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()))
    const endDateOnly = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()))
    const daysDiff = Math.round((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24))

    // Total minutes = (days * 24 * 60) + endMinutes - startMinutes
    return (daysDiff * 24 * 60) + endMinutes - startMinutes
}

export default function BookingFormV2({
    roomId,
    serviceType,
    onSubmit,
    loading = false,
}: BookingFormV2Props) {
    const { data: session } = useSession()

    const [date, setDate] = useState<Date | null>(null)
    const [endDate, setEndDate] = useState<Date | null>(null)
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [guests, setGuests] = useState(1)
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [note, setNote] = useState('')

    const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([])
    const [priceInfo, setPriceInfo] = useState<PriceBreakdown | null>(null)
    const [availabilityError, setAvailabilityError] = useState<string | null>(null)
    const [showNerdCoinInfo, setShowNerdCoinInfo] = useState(false)

    // Form validation - touched states
    const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})

    // Validation helpers
    const phoneRegex = /^0\d{9}$/
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isPhoneValid = phoneRegex.test(customerPhone)
    const isNameValid = customerName.trim().length >= 2
    const isEmailValid = emailRegex.test(customerEmail)

    const timeStep = serviceType === 'MEETING' ? 30 : 15
    const allTimeSlots = generateTimeSlots(timeStep)
    const isMeeting = serviceType === 'MEETING'

    // Auto-fill customer info from session
    useEffect(() => {
        if (session?.user) {
            if (!customerName && session.user.name) setCustomerName(session.user.name)
            if (!customerEmail && session.user.email) setCustomerEmail(session.user.email)
            if (!customerPhone && (session.user as any).phone) setCustomerPhone((session.user as any).phone)
        }
    }, [session])

    const today = new Date()
    const isToday = date ? (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    ) : false

    const now = new Date()
    now.setMinutes(now.getMinutes() + 15)
    // const currentHour = now.getHours()
    const currentTimeWithBuffer = format(now, 'HH:mm')
    // const isPastClosingTime = currentHour >= 22 || currentHour < 8 // Removed for 24/7

    const timeSlots = isToday
        ? allTimeSlots.filter(t => t >= currentTimeWithBuffer)
        : allTimeSlots

    // 1. Fetch booked slots
    const dateStr = date ? format(date, 'yyyy-MM-dd') : null
    const { data: availabilityData, isLoading: loadingSlots, error: availabilityErrorSWR, isValidating: isRefreshingSlots } = useSWR(
        dateStr && roomId ? `/api/booking/availability?roomId=${roomId}&date=${dateStr}` : null,
        fetcher,
        {
            refreshInterval: 30000, // Tự động làm mới mỗi 30s
            revalidateOnFocus: true,
            dedupingInterval: 2000
        }
    )

    useEffect(() => {
        if (availabilityData) setBookedSlots(availabilityData.bookedSlots || [])
        else setBookedSlots([])
    }, [availabilityData])

    // 2. Calculate price
    const duration = (date && endDate && startTime && endTime) ? calculateDuration(date, endDate, startTime, endTime) : 0
    const shouldFetchPrice = duration > 0 && guests > 0
    const { data: priceData, isLoading: loadingPrice } = useSWR(
        shouldFetchPrice ? [`/api/booking/calculate`, serviceType, duration, guests] : null,
        ([url]) => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceType, durationMinutes: duration, guests })
        }).then(res => res.json())
    )

    useEffect(() => {
        setPriceInfo(priceData || null)
    }, [priceData])

    // 3. Real-time Availability Check
    const shouldCheckRealtime = dateStr && startTime && endTime && roomId && !isRangeOverlapping(startTime, endTime, bookedSlots)
    const { data: checkData, isLoading: isCheckingAvailability, error: checkErrorSWR } = useSWR(
        shouldCheckRealtime ? [`/api/booking/check-slot`, dateStr, startTime, endTime, roomId] : null,
        ([url]) => fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, date: dateStr, startTime, endTime })
        }).then(res => res.json()),
        {
            dedupingInterval: 500,
            revalidateOnFocus: true
        }
    )

    useEffect(() => {
        if (checkData && !checkData.available) setAvailabilityError(checkData.error || 'Khung giờ này đã có người đặt')
        else setAvailabilityError(null)
    }, [checkData])

    useEffect(() => {
        setStartTime('')
        setEndTime('')
        setPriceInfo(null)
        // Set endDate = date by default
        setEndDate(date)
    }, [date])

    // Khi endDate thay đổi, reset endTime
    useEffect(() => {
        setEndTime('')
        setPriceInfo(null)
    }, [endDate])

    // Determine if same day booking
    const isSameDay = date && endDate && date.toDateString() === endDate.toDateString()

    // End time options: nếu cùng ngày thì phải > startTime, khác ngày thì tất cả các giờ
    const endTimeOptions = useMemo(() => {
        const filtered = allTimeSlots.filter(t => t !== '24:00')
        if (isSameDay && startTime) {
            // Cùng ngày: end time phải sau start time
            return filtered.filter(t => t > startTime).map(t => ({ value: t, label: t }))
        }
        // Khác ngày: có thể chọn bất kỳ giờ nào
        return filtered.map(t => ({ value: t, label: t }))
    }, [allTimeSlots, isSameDay, startTime])

    const handleSubmit = () => {
        if (!date || !endDate || !startTime || !endTime || !customerName || !customerPhone || !customerEmail) return

        onSubmit({
            date,
            endDate,
            startTime,
            endTime,
            guests,
            customerName,
            customerPhone,
            customerEmail: customerEmail || undefined,
            note: note || undefined,
        })
    }

    // Check if selected range overlaps with booked slots
    const hasOverlap = isRangeOverlapping(startTime, endTime, bookedSlots)

    const isValid = date && endDate && startTime && endTime && customerName && customerPhone && customerEmail && isEmailValid && priceInfo && !hasOverlap && !availabilityError && !isCheckingAvailability

    return (
        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm dark:bg-neutral-900 relative">
            {/* Refreshing Indicator (Subtle) */}
            {(isRefreshingSlots || isCheckingAvailability) && !loadingSlots && (
                <div className="absolute top-4 right-6 flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 animate-pulse">
                    <ArrowPathIcon className="size-3 animate-spin" />
                    Đang đồng bộ dữ liệu...
                </div>
            )}

            {/* Network Error Message */}
            {(availabilityErrorSWR || checkErrorSWR) && (
                <div className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 flex items-center gap-2 text-xs">
                    <ExclamationTriangleIcon className="size-4 shrink-0" />
                    Kết nối chập chờn. Dữ liệu có thể chưa được cập nhật mới nhất.
                </div>
            )}

            {/* Date Selection - Start & End Date */}
            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Ngày bắt đầu
                    </label>
                    <div className="relative">
                        <DatePicker
                            selected={date}
                            onChange={(d) => setDate(d)}
                            dateFormat="dd/MM/yyyy"
                            minDate={new Date()}
                            formatWeekDay={(day) => {
                                const dayMap: Record<string, string> = {
                                    'Monday': 'T2',
                                    'Tuesday': 'T3',
                                    'Wednesday': 'T4',
                                    'Thursday': 'T5',
                                    'Friday': 'T6',
                                    'Saturday': 'T7',
                                    'Sunday': 'CN'
                                }
                                return dayMap[day] || day
                            }}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 pl-11 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                            placeholderText="Chọn ngày"
                            wrapperClassName="w-full"
                            calendarClassName="!border !border-neutral-200 !rounded-xl !shadow-xl !p-4 !bg-white dark:!bg-neutral-900 dark:!border-neutral-700 font-sans"
                            renderCustomHeader={(props) => <DatePickerCustomHeaderSingleMonth {...props} />}
                            renderDayContents={(day, date) => <DatePickerCustomDay dayOfMonth={day} date={date} />}
                        />
                        <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    </div>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Ngày kết thúc
                    </label>
                    <div className="relative">
                        <DatePicker
                            selected={endDate}
                            onChange={(d) => setEndDate(d)}
                            dateFormat="dd/MM/yyyy"
                            minDate={date || new Date()}
                            disabled={!date}
                            formatWeekDay={(day) => {
                                const dayMap: Record<string, string> = {
                                    'Monday': 'T2',
                                    'Tuesday': 'T3',
                                    'Wednesday': 'T4',
                                    'Thursday': 'T5',
                                    'Friday': 'T6',
                                    'Saturday': 'T7',
                                    'Sunday': 'CN'
                                }
                                return dayMap[day] || day
                            }}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 pl-11 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                            placeholderText="Chọn ngày"
                            wrapperClassName="w-full"
                            calendarClassName="!border !border-neutral-200 !rounded-xl !shadow-xl !p-4 !bg-white dark:!bg-neutral-900 dark:!border-neutral-700 font-sans"
                            renderCustomHeader={(props) => <DatePickerCustomHeaderSingleMonth {...props} />}
                            renderDayContents={(day, date) => <DatePickerCustomDay dayOfMonth={day} date={date} />}
                        />
                        <CalendarDaysIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    </div>
                </div>
            </div>

            {/* Time Selection */}
            {loadingSlots ? (
                /* Skeleton Loading for Time Slots */
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <div className="mb-2 h-5 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                        <div className="h-12 w-full animate-pulse rounded-xl bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700" />
                    </div>
                    <div>
                        <div className="mb-2 h-5 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
                        <div className="h-12 w-full animate-pulse rounded-xl bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-700 dark:via-neutral-600 dark:to-neutral-700" />
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Giờ bắt đầu
                        </label>
                        <TimeSelect
                            value={startTime}
                            onChange={(value) => {
                                setStartTime(value)
                                setEndTime('')
                            }}
                            options={timeSlots.filter(t => t !== '24:00').map(time => ({
                                value: time,
                                label: time,
                                disabled: isTimeSlotBooked(time, bookedSlots)
                            }))}
                            placeholder="Chọn giờ bắt đầu"
                            disabled={!date || loadingSlots}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Giờ kết thúc
                        </label>
                        <TimeSelect
                            value={endTime}
                            onChange={setEndTime}
                            options={endTimeOptions.map(opt => ({
                                value: opt.value,
                                label: opt.label,
                                // Check if the ENTIRE range from startTime to this endTime overlaps with any booked slot
                                disabled: startTime ? isRangeOverlapping(startTime, opt.value, bookedSlots) : false
                            }))}
                            placeholder="Chọn giờ kết thúc"
                            disabled={!startTime}
                        />
                    </div>
                </div>
            )}

            {/* Guests (for Meeting) */}
            {isMeeting && (
                <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        Số người tham gia
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={guests}
                            onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 pl-11 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        />
                        <UsersIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                        {guests < 8 ? '< 8 người: 80,000đ/giờ' : '≥ 8 người: 100,000đ/giờ'}
                    </p>
                </div>
            )}

            {/* Customer Info */}
            <div className="mt-8">
                <h3 className="mb-4 font-semibold text-neutral-900 dark:text-white">
                    Thông tin người đặt
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Họ và tên *
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            onBlur={() => setTouchedFields(prev => ({ ...prev, name: true }))}
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 transition-colors focus:ring-2 dark:bg-neutral-800 dark:text-white ${touchedFields.name && !isNameValid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-900'
                                : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-200 dark:border-neutral-700 dark:focus:ring-primary-900'
                                }`}
                            placeholder="Nhập họ tên"
                        />
                        {touchedFields.name && !isNameValid && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                                <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Vui lòng nhập họ tên (ít nhất 2 ký tự)
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Số điện thoại *
                        </label>
                        <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            onBlur={() => setTouchedFields(prev => ({ ...prev, phone: true }))}
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 transition-colors focus:ring-2 dark:bg-neutral-800 dark:text-white ${touchedFields.phone && !isPhoneValid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-900'
                                : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-200 dark:border-neutral-700 dark:focus:ring-primary-900'
                                }`}
                            placeholder="0901234567"
                        />
                        {touchedFields.phone && !isPhoneValid && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                                <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Số điện thoại phải có 10 số, bắt đầu bằng 0
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Email *
                        </label>
                        <input
                            type="email"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            onBlur={() => setTouchedFields(prev => ({ ...prev, email: true }))}
                            className={`w-full rounded-xl border bg-white px-4 py-3 text-neutral-900 transition-colors focus:ring-2 dark:bg-neutral-800 dark:text-white ${touchedFields.email && !isEmailValid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-900'
                                : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-200 dark:border-neutral-700 dark:focus:ring-primary-900'
                                }`}
                            placeholder="email@example.com"
                        />
                        {touchedFields.email && !isEmailValid && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                                <svg className="size-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Vui lòng nhập email hợp lệ
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            Ghi chú
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 focus:border-primary-500 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                            placeholder="Ghi chú (nếu có)"
                        />
                    </div>
                </div>
            </div>

            {/* Price Summary */}
            {priceInfo && (
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
                    {/* Header */}
                    <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
                        <h4 className="font-semibold text-neutral-900 dark:text-white">Chi tiết đặt phòng</h4>
                    </div>

                    <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                        {/* Duration Row */}
                        {startTime && endTime && (
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">Thời lượng</span>
                                <div className="text-right">
                                    <span className="font-medium text-neutral-900 dark:text-white">
                                        {(() => {
                                            const duration = date && endDate ? calculateDuration(date, endDate, startTime, endTime) : 0
                                            const hours = Math.floor(duration / 60)
                                            const minutes = duration % 60
                                            if (hours === 0) return `${minutes} phút`
                                            if (minutes === 0) return `${hours} giờ`
                                            return `${hours} giờ ${minutes} phút`
                                        })()}
                                    </span>
                                    <span className="ml-2 text-xs text-neutral-400">({startTime} → {endTime})</span>
                                </div>
                            </div>
                        )}

                        {/* Subtotal Row */}
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">Tạm tính</span>
                            <span className="font-medium text-neutral-900 dark:text-white">
                                {new Intl.NumberFormat('vi-VN').format(priceInfo.estimatedAmount)}đ
                            </span>
                        </div>

                        {/* Deposit Row with Nerd Coin */}
                        <div className="px-4 py-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Đặt cọc (50%)</span>
                                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                    {new Intl.NumberFormat('vi-VN').format(priceInfo.depositAmount)}đ
                                </span>
                            </div>
                            {priceInfo.nerdCoinReward > 0 && (
                                <div className="relative mt-1">
                                    <div className="flex items-center justify-end gap-1.5 text-xs text-primary-600 dark:text-primary-400">
                                        <span className="flex size-4 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-600 dark:bg-primary-900 dark:text-primary-400">N</span>
                                        <span>Nhận +{priceInfo.nerdCoinReward} Nerd Coin khi check-in</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowNerdCoinInfo(!showNerdCoinInfo)}
                                            className="flex size-4 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-bold text-neutral-600 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600"
                                        >
                                            ?
                                        </button>
                                    </div>
                                    {showNerdCoinInfo && (
                                        <div className="absolute bottom-6 right-0 z-50 w-64 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                                            <p className="font-medium text-neutral-900 dark:text-white">Nerd Coin là gì?</p>
                                            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                                                Nerd Coin là credit dịch vụ của Nerd Society. Bạn có thể dùng coin để đổi nước pha hoặc tích lại để đổi merch.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setShowNerdCoinInfo(false)}
                                                className="mt-2 text-primary-600 hover:underline dark:text-primary-400"
                                            >
                                                Đóng
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Overlap Warning */}
            {hasOverlap && (
                <div className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    ⚠️ Khung giờ bạn chọn trùng với lịch đã đặt. Vui lòng chọn khung giờ khác.
                </div>
            )}

            {/* Real-time Availability Error */}
            {availabilityError && !hasOverlap && (
                <div className="rounded-xl bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    ⚠️ {availabilityError}
                </div>
            )}

            {/* Checking Indicator */}
            {isCheckingAvailability && (
                <div className="rounded-xl bg-blue-50 p-4 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-2">
                    <svg className="animate-spin size-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Đang kiểm tra tình trạng phòng...
                </div>
            )}

            {/* Submit Button */}
            <div className="mt-8">
                <Button
                    onClick={handleSubmit}
                    disabled={!isValid || loading || loadingPrice}
                    className="w-full"
                >
                    {loading ? 'Đang xử lý...' : 'Thanh toán cọc & Giữ phòng'}
                </Button>
                <ul className="mt-3 space-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                    <li>• Phòng sẽ được giữ sau khi bạn thanh toán cọc 50%</li>
                    <li>• Huỷ/đổi lịch trước giờ bắt đầu 2 tiếng: bạn vui lòng liên hệ page để được lưu cọc cho lần sử dụng sau</li>
                    <li>• Huỷ trong vòng 2 tiếng hoặc không đến: không hoàn tiền cọc.</li>
                </ul>
            </div>
        </div>
    )
}
