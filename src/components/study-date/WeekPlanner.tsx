'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/shared/Button'
import ButtonSecondary from '@/shared/ButtonSecondary'
import Select from '@/shared/Select'
import {
    getStudySlots,
    getUserAvailability,
    saveUserAvailability,
    getActiveLocations
} from '@/actions/study-planner'
import { startOfWeek, addWeeks, format, addDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import toast from 'react-hot-toast'
import Heading from '@/shared/Heading'

interface Slot {
    id: string
    dayOfWeek: number // 0-6
    startTime: string
    endTime: string
    locationId: string
}

interface Location {
    id: string
    name: string
    address: string
}

const WeekPlanner = () => {
    const [loading, setLoading] = useState(true)
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocation, setSelectedLocation] = useState<string>('')

    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([])

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [saving, setSaving] = useState(false)

    // 1. Fetch Locations
    useEffect(() => {
        getActiveLocations().then(locs => {
            setLocations(locs)
            if (locs.length > 0) setSelectedLocation(locs[0].id)
        })
    }, [])

    // 2. Fetch Slots & Availability when location or week changes
    useEffect(() => {
        if (!selectedLocation) return
        loadData()
    }, [selectedLocation, currentWeekStart])

    const loadData = async () => {
        setLoading(true)
        const [fetchedSlots, avail] = await Promise.all([
            getStudySlots(selectedLocation),
            getUserAvailability(currentWeekStart)
        ])

        setSlots(fetchedSlots as Slot[])
        setSelectedSlotIds(avail.map((a: any) => a.slotId))
        setLoading(false)
    }

    const toggleSlot = (slotId: string) => {
        setSelectedSlotIds(prev => {
            if (prev.includes(slotId)) return prev.filter(id => id !== slotId)
            return [...prev, slotId]
        })
    }

    const handleSave = async () => {
        setSaving(true)
        const res = await saveUserAvailability(selectedSlotIds, currentWeekStart)
        setSaving(false)
        if (res.success) {
            toast.success('Đã lưu lịch rảnh!')
        } else {
            toast.error('Lỗi khi lưu: ' + res.error)
        }
    }

    const days = [
        { val: 1, label: 'Thứ 2' },
        { val: 2, label: 'Thứ 3' },
        { val: 3, label: 'Thứ 4' },
        { val: 4, label: 'Thứ 5' },
        { val: 5, label: 'Thứ 6' },
        { val: 6, label: 'Thứ 7' },
        { val: 0, label: 'Chủ Nhật' },
    ]

    // Group slots by day
    const slotsByDay = days.map((day, index) => {
        const date = addDays(currentWeekStart, index)
        return {
            ...day,
            dateStr: format(date, 'dd/MM'),
            slots: slots.filter(s => s.dayOfWeek === day.val)
        }
    })

    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:p-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Lịch Study Date</h2>

                <div className="w-full md:w-64">
                    <Select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                    >
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </Select>
                </div>
            </div>

            <div className="mb-6 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 dark:bg-neutral-800">
                <ButtonSecondary onClick={() => setCurrentWeekStart(d => addWeeks(d, -1))} className="px-4 py-2">
                    &larr; <span className="hidden sm:inline ml-1">Tuần trước</span>
                </ButtonSecondary>
                <span className="text-base font-medium sm:text-lg text-neutral-900 dark:text-neutral-100">
                    Tuần {format(currentWeekStart, 'dd/MM/yyyy')}
                </span>
                <ButtonSecondary onClick={() => setCurrentWeekStart(d => addWeeks(d, 1))} className="px-4 py-2">
                    <span className="hidden sm:inline mr-1">Tuần sau</span> &rarr;
                </ButtonSecondary>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <div className="size-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
                    {slotsByDay.map(day => (
                        <div key={day.val} className="rounded-xl border border-neutral-200 p-3 min-h-[160px] dark:border-neutral-700 dark:bg-neutral-800/20">
                            <div className="mb-3 text-center">
                                <div className="font-semibold text-neutral-500 dark:text-neutral-400">{day.label}</div>
                                <div className="text-xs font-medium text-neutral-400 dark:text-neutral-500 mt-0.5">{day.dateStr}</div>
                            </div>
                            <div className="space-y-2">
                                {day.slots.length === 0 && <div className="py-4 text-center text-xs text-neutral-400">Không có slot</div>}
                                {day.slots.map(slot => {
                                    const isSelected = selectedSlotIds.includes(slot.id)
                                    return (
                                        <button
                                            key={slot.id}
                                            onClick={() => toggleSlot(slot.id)}
                                            className={`w-full rounded-lg border py-2 text-sm font-medium transition-all
                                ${isSelected
                                                    ? 'border-primary-600 bg-primary-600 text-white shadow-md hover:bg-primary-700'
                                                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'}
                             `}
                                        >
                                            {slot.startTime} - {slot.endTime}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 flex justify-end">
                <Button color="primary" className="!border-0 !bg-primary-600 hover:!bg-primary-700 !text-white shadow-lg shadow-primary-500/30" onClick={handleSave} loading={saving}>Lưu Lịch Rảnh</Button>
            </div>
        </div>
    )
}

export default WeekPlanner
