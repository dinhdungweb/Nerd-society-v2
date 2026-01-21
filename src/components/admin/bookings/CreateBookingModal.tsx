import React, { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, UserIcon, PhoneIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface CreateBookingModalProps {
    open: boolean
    setOpen: (open: boolean) => void
    onSuccess: () => void
}

interface Room {
    id: string
    name: string
    type: string
    location: { name: string }
}

interface Service {
    id: string
    type: 'MEETING' | 'POD_MONO' | 'POD_MULTI'
    priceSmall: number | null
    priceLarge: number | null
    priceFirstHour: number | null
    pricePerHour: number | null
}

export default function CreateBookingModal({ open, setOpen, onSuccess }: CreateBookingModalProps) {
    const [loading, setLoading] = useState(false)
    const [rooms, setRooms] = useState<Room[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [estimatedPrice, setEstimatedPrice] = useState<number>(0)

    // Form State
    const [formData, setFormData] = useState({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        roomId: '',
        date: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        guests: 1,
        source: 'ONSITE',
        depositStatus: 'PAID_CASH', // Default for Walk-in is usually Paid Cash immediately
        note: ''
    })

    const [bookedSlots, setBookedSlots] = useState<any[]>([])
    const [endDayBookedSlots, setEndDayBookedSlots] = useState<any[]>([])

    useEffect(() => {
        if (open) {
            fetchRooms()
            fetchServices()
        }
    }, [open])

    // Fetch availability when date or room changes
    useEffect(() => {
        if (open && formData.roomId && formData.date) {
            fetchAvailability(formData.date, setBookedSlots)
        }
    }, [open, formData.roomId, formData.date])

    useEffect(() => {
        if (open && formData.roomId && formData.endDate && formData.endDate !== formData.date) {
            fetchAvailability(formData.endDate, setEndDayBookedSlots)
        } else {
            setEndDayBookedSlots([])
        }
    }, [open, formData.roomId, formData.endDate, formData.date])

    const fetchAvailability = async (dateStr: string, setter: (data: any[]) => void) => {
        try {
            const res = await fetch(`/api/booking/availability?roomId=${formData.roomId}&date=${dateStr}`)
            if (res.ok) {
                const data = await res.json()
                setter(data.bookedSlots || [])
            }
        } catch (error) {
            console.error(error)
        }
    }

    const fetchRooms = async () => {
        try {
            const res = await fetch('/api/admin/rooms')
            if (res.ok) {
                const data = await res.json()
                setRooms(data)
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, roomId: data[0].id }))
                }
            }
        } catch (error) {
            console.error(error)
        }
    }

    const fetchServices = async () => {
        try {
            const res = await fetch('/api/admin/services')
            if (res.ok) {
                const data = await res.json()
                setServices(data)
            }
        } catch (error) {
            console.error(error)
        }
    }

    // Calculate price when room or duration changes
    useEffect(() => {
        if (!formData.roomId || !services.length || !rooms.length || !formData.date || !formData.endDate || !formData.startTime || !formData.endTime) return

        const room = rooms.find(r => r.id === formData.roomId)
        if (!room) return

        // Map room type to service type
        const serviceType = room.type.startsWith('MEETING') ? 'MEETING'
            : room.type === 'POD_MONO' ? 'POD_MONO' : 'POD_MULTI'

        const service = services.find(s => s.type === serviceType)
        if (!service) return

        const durationMinutes = calculateDurationMultiDay(
            new Date(formData.date),
            new Date(formData.endDate),
            formData.startTime,
            formData.endTime
        )

        const hours = durationMinutes / 60
        let price = 0

        if (serviceType === 'MEETING') {
            // Meeting room: price by group size
            const pricePerHour = formData.guests < 8
                ? (service.priceSmall || 0)
                : (service.priceLarge || 0)
            price = pricePerHour * hours
        } else {
            // Pod: first hour + extra hours
            const firstHour = service.priceFirstHour || 0
            const extraHours = Math.max(0, hours - 1)
            price = firstHour + extraHours * (service.pricePerHour || 0)
        }

        setEstimatedPrice(Math.round(price))
    }, [formData.roomId, formData.date, formData.endDate, formData.startTime, formData.endTime, formData.guests, rooms, services])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch('/api/admin/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Có lỗi xảy ra')
            }

            toast.success('Tạo booking thành công')
            onSuccess()
            setOpen(false)
            // Reset form
            setFormData({
                customerName: '',
                customerPhone: '',
                customerEmail: '',
                roomId: rooms[0]?.id || '',
                date: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '10:00',
                guests: 1,
                source: 'ONSITE',
                depositStatus: 'PAID_CASH',
                note: ''
            })
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Transition.Root show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={setOpen}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-neutral-900/75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg dark:bg-neutral-900 border dark:border-neutral-800">
                                <div className="absolute right-4 top-4">
                                    <button
                                        type="button"
                                        className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 dark:hover:bg-neutral-800"
                                        onClick={() => setOpen(false)}
                                    >
                                        <XMarkIcon className="size-5" />
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="p-6">
                                    <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-neutral-900 dark:text-white mb-6">
                                        Tạo Booking Mới (Walk-in)
                                    </Dialog.Title>

                                    <div className="space-y-4">
                                        {/* Customer Info */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="sm:col-span-2">
                                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Tên khách</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                    value={formData.customerName}
                                                    onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">SĐT</label>
                                                <input
                                                    type="tel"
                                                    required
                                                    className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                    value={formData.customerPhone}
                                                    onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                    value={formData.customerEmail}
                                                    onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                                                />
                                            </div>

                                        </div>

                                        {/* Room & Time */}
                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Chọn phòng</label>
                                            <select
                                                className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                value={formData.roomId}
                                                onChange={e => setFormData({ ...formData, roomId: e.target.value })}
                                            >
                                                {rooms.map(room => (
                                                    <option key={room.id} value={room.id}>
                                                        {room.location.name} - {room.name} ({room.type})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Bắt đầu</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="date"
                                                        required
                                                        className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                        value={formData.date}
                                                        onChange={e => {
                                                            const newDate = e.target.value
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                date: newDate,
                                                                // If endDate was same as old date, update it too
                                                                endDate: prev.endDate === prev.date ? newDate : prev.endDate
                                                            }))
                                                        }}
                                                    />
                                                    <input
                                                        type="time"
                                                        required
                                                        className="w-24 rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                        value={formData.startTime}
                                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Kết thúc</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="date"
                                                        required
                                                        min={formData.date}
                                                        className="w-full rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                        value={formData.endDate}
                                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                                    />
                                                    <input
                                                        type="time"
                                                        required
                                                        className="w-24 rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                        value={formData.endTime}
                                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Số khách</label>
                                            <input
                                                type="number"
                                                min="1"
                                                required
                                                className="w-24 rounded-lg border-neutral-300 text-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-neutral-800 dark:border-neutral-700"
                                                value={formData.guests}
                                                onChange={e => setFormData({ ...formData, guests: parseInt(e.target.value) })}
                                            />
                                        </div>

                                        {/* Payment */}
                                        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Trạng thái cọc</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="depositStatus"
                                                        value="PAID_CASH"
                                                        checked={formData.depositStatus === 'PAID_CASH'}
                                                        onChange={e => setFormData({ ...formData, depositStatus: e.target.value })}
                                                        className="text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm dark:text-neutral-300">Đã thu tiền mặt</span>
                                                </label>
                                                <label className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="depositStatus"
                                                        value="WAIVED"
                                                        checked={formData.depositStatus === 'WAIVED'}
                                                        onChange={e => setFormData({ ...formData, depositStatus: e.target.value })}
                                                        className="text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="text-sm dark:text-neutral-300">Không cọc (Khách quen)</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Price Preview */}
                                        {estimatedPrice > 0 && (
                                            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Giá dự kiến:</span>
                                                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(estimatedPrice)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-neutral-500 mt-1">
                                                    ({(() => {
                                                        const duration = calculateDurationMultiDay(
                                                            new Date(formData.date),
                                                            new Date(formData.endDate),
                                                            formData.startTime,
                                                            formData.endTime
                                                        )
                                                        const hours = Math.floor(duration / 60)
                                                        const minutes = duration % 60
                                                        return `${hours > 0 ? `${hours} giờ ` : ''}${minutes} phút`
                                                    })()})
                                                </p>

                                                {/* Deposit amount */}
                                                {formData.depositStatus === 'PAID_CASH' && (
                                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-primary-200 dark:border-primary-800">
                                                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tiền cọc (50%):</span>
                                                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Math.round(estimatedPrice * 0.5))}
                                                        </span>
                                                    </div>
                                                )}
                                                {formData.depositStatus === 'WAIVED' && (
                                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-primary-200 dark:border-primary-800">
                                                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tiền cọc:</span>
                                                        <span className="text-sm font-medium text-neutral-500">Miễn cọc</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Overlap Warning */}
                                        {isRangeOverlapping(
                                            new Date(formData.date),
                                            formData.startTime,
                                            new Date(formData.endDate),
                                            formData.endTime,
                                            bookedSlots,
                                            endDayBookedSlots
                                        ) && (
                                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
                                                    ⚠️ Cảnh báo: Khung giờ này bị trùng với lịch đã có.
                                                </div>
                                            )}
                                    </div>

                                    <div className="mt-8 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg dark:text-neutral-300 dark:hover:bg-neutral-800"
                                            onClick={() => setOpen(false)}
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
                                        >
                                            {loading ? 'Đang tạo...' : 'Tạo Booking'}
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}

// --- Helpers copied from BookingFormV2 for consistency ---
function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

function getBookingDateTime(date: Date, time: string): Date {
    const dt = new Date(date)
    const [h, m] = time.split(':').map(Number)
    dt.setUTCHours(h, m, 0, 0)
    return dt
}

function calculateDurationMultiDay(startDate: Date, endDate: Date, startTime: string, endTime: string): number {
    if (!startDate || !endDate || !startTime || !endTime) return 0
    const startMin = timeToMinutes(startTime)
    const endMin = timeToMinutes(endTime)

    const s = new Date(startDate); s.setHours(0, 0, 0, 0)
    const e = new Date(endDate); e.setHours(0, 0, 0, 0)
    const daysDiff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))

    return (daysDiff * 24 * 60) + endMin - startMin
}

function isRangeOverlapping(
    sDate: Date,
    sTime: string,
    eDate: Date,
    eTime: string,
    startDaySlots: any[],
    endDaySlots: any[] = []
): boolean {
    if (!sDate || !sTime || !eDate || !eTime) return false

    const newStart = getBookingDateTime(sDate, sTime).getTime()
    const newEnd = getBookingDateTime(eDate, eTime).getTime()

    const checkSlots = (slots: any[], targetDay: Date) => {
        for (const slot of slots) {
            let slotStartMs: number
            let slotEndMs: number
            const baseDate = new Date(targetDay); baseDate.setUTCHours(0, 0, 0, 0)

            if (slot.isSpillover) {
                slotStartMs = getBookingDateTime(baseDate, '00:00').getTime()
                slotEndMs = getBookingDateTime(baseDate, slot.endTime).getTime()
            } else {
                slotStartMs = getBookingDateTime(baseDate, slot.startTime).getTime()
                const slotEnd = getBookingDateTime(baseDate, slot.endTime)
                if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
                    slotEnd.setUTCDate(slotEnd.getUTCDate() + 1)
                }
                slotEndMs = slotEnd.getTime()
            }
            if (newStart < slotEndMs && newEnd > slotStartMs) return true
        }
        return false
    }

    if (checkSlots(startDaySlots, sDate)) return true
    if (sDate.toISOString().split('T')[0] !== eDate.toISOString().split('T')[0] && endDaySlots.length > 0) {
        if (checkSlots(endDaySlots, eDate)) return true
    }

    return false
}
