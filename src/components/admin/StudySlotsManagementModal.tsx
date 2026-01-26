'use client'

import React, { useEffect, useState } from 'react'
import NcModal from '@/shared/NcModal'
import {
    getAdminLocations,
    getAdminStudySlots,
    createStudySlot,
    deleteStudySlot,
    getSlotRegistrations
} from '@/actions/admin-study'
import { PlusIcon, TrashIcon, CalendarDaysIcon, ClockIcon, UserGroupIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import ButtonPrimary from '@/shared/ButtonPrimary'
import ButtonSecondary from '@/shared/ButtonSecondary'

interface StudySlotsManagementModalProps {
    isOpen: boolean
    onClose: () => void
}

const DAYS_OF_WEEK = [
    { value: 0, label: 'Chủ Nhật' },
    { value: 1, label: 'Thứ Hai' },
    { value: 2, label: 'Thứ Ba' },
    { value: 3, label: 'Thứ Tư' },
    { value: 4, label: 'Thứ Năm' },
    { value: 5, label: 'Thứ Sáu' },
    { value: 6, label: 'Thứ Bảy' },
]

const StudySlotsManagementModal = ({ isOpen, onClose }: StudySlotsManagementModalProps) => {
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<{ id: string, name: string }[]>([])
    const [selectedLocationId, setSelectedLocationId] = useState<string>('')
    const [slots, setSlots] = useState<any[]>([])

    // Registrations View State
    const [viewingSlotId, setViewingSlotId] = useState<string | null>(null)
    const [registrations, setRegistrations] = useState<any[]>([])
    const [loadingReg, setLoadingReg] = useState(false)

    // Create Form
    const [isCreating, setIsCreating] = useState(false)
    const [newSlot, setNewSlot] = useState({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        capacity: 20
    })

    useEffect(() => {
        if (isOpen) {
            fetchLocations()
        }
    }, [isOpen])

    useEffect(() => {
        if (selectedLocationId) {
            fetchSlots(selectedLocationId)
        } else {
            setSlots([])
        }
    }, [selectedLocationId])

    const fetchLocations = async () => {
        setLoading(true)
        const res = await getAdminLocations()
        setLocations(res)
        if (res.length > 0 && !selectedLocationId) {
            setSelectedLocationId(res[0].id)
        }
        setLoading(false)
    }

    const fetchSlots = async (locId: string) => {
        setLoading(true)
        const res = await getAdminStudySlots(locId)
        setSlots(res)
        setLoading(false)
    }

    const handleViewRegistrations = async (slotId: string) => {
        if (viewingSlotId === slotId) {
            setViewingSlotId(null)
            setRegistrations([])
            return
        }

        setViewingSlotId(slotId)
        setLoadingReg(true)
        const res = await getSlotRegistrations(slotId)
        setRegistrations(res)
        setLoadingReg(false)
    }

    const handleCreate = async () => {
        if (!selectedLocationId) return

        setIsCreating(true)
        const res = await createStudySlot({
            locationId: selectedLocationId,
            ...newSlot
        })
        setIsCreating(false)

        if (res.success) {
            toast.success('Thêm slot thành công')
            fetchSlots(selectedLocationId)
        } else {
            toast.error('Lỗi: ' + res.error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc muốn xóa slot này?')) return

        const res = await deleteStudySlot(id)
        if (res.success) {
            toast.success('Đã xóa slot')
            fetchSlots(selectedLocationId)
        } else {
            toast.error('Lỗi: ' + res.error)
        }
    }

    const renderContent = () => {
        return (
            <div className="space-y-6">
                {/* Location Selector */}
                <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                        Chọn Chi nhánh
                    </label>
                    <select
                        className="block w-full rounded-xl border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800"
                        value={selectedLocationId}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                    >
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-700 my-4" />

                {/* Create New Slot */}
                <div className="rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Thêm Slot Mới</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                        <div className="col-span-2 md:col-span-1">
                            <label className="text-xs text-neutral-500 mb-1 block">Thứ</label>
                            <select
                                className="w-full rounded-lg border-neutral-300 text-sm py-2 px-2 dark:bg-neutral-800"
                                value={newSlot.dayOfWeek}
                                onChange={e => setNewSlot({ ...newSlot, dayOfWeek: parseInt(e.target.value) })}
                            >
                                {DAYS_OF_WEEK.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Bắt đầu</label>
                            <input
                                type="time"
                                className="w-full rounded-lg border-neutral-300 text-sm py-2 px-2 dark:bg-neutral-800"
                                value={newSlot.startTime}
                                onChange={e => setNewSlot({ ...newSlot, startTime: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Kết thúc</label>
                            <input
                                type="time"
                                className="w-full rounded-lg border-neutral-300 text-sm py-2 px-2 dark:bg-neutral-800"
                                value={newSlot.endTime}
                                onChange={e => setNewSlot({ ...newSlot, endTime: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-neutral-500 mb-1 block">Sức chứa</label>
                            <input
                                type="number"
                                className="w-full rounded-lg border-neutral-300 text-sm py-2 px-2 dark:bg-neutral-800"
                                value={newSlot.capacity}
                                onChange={e => setNewSlot({ ...newSlot, capacity: parseInt(e.target.value) })}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <ButtonPrimary
                                onClick={handleCreate}
                                loading={isCreating}
                                className="w-full py-2 !text-xs"
                            >
                                <PlusIcon className="w-4 h-4 mr-1" /> Thêm
                            </ButtonPrimary>
                        </div>
                    </div>
                </div>

                {/* Slots List */}
                <div>
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Danh sách Slot hiện tại</h4>
                    {loading && slots.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500">Đang tải...</div>
                    ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {slots.length === 0 ? (
                                <p className="text-center py-4 text-neutral-500 text-sm">Chưa có slot nào.</p>
                            ) : (
                                slots.map((slot) => (
                                    <div key={slot.id} className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                                        <div className="flex items-center justify-between p-3">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center justify-center size-10 rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 font-bold">
                                                    {slot.dayOfWeek === 0 ? 'CN' : `T${slot.dayOfWeek + 1}`}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-white">
                                                        <ClockIcon className="size-4 text-neutral-500" />
                                                        {slot.startTime} - {slot.endTime}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="text-xs text-neutral-500">
                                                            Sức chứa: {slot.capacity}
                                                        </div>
                                                        <span className="text-neutral-300">|</span>
                                                        <button
                                                            onClick={() => handleViewRegistrations(slot.id)}
                                                            className="text-xs font-medium text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1"
                                                        >
                                                            <UserGroupIcon className="size-3" />
                                                            Đăng ký: {slot._count?.availabilities || 0}
                                                            {viewingSlotId === slot.id ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(slot.id)}
                                                className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                                                title="Xóa slot"
                                            >
                                                <TrashIcon className="size-5" />
                                            </button>
                                        </div>

                                        {/* Expandable Registration List */}
                                        {viewingSlotId === slot.id && (
                                            <div className="border-t border-neutral-100 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-800/50">
                                                {loadingReg ? (
                                                    <div className="text-center text-xs text-neutral-500 py-2">Đang tải danh sách...</div>
                                                ) : registrations.length === 0 ? (
                                                    <div className="text-center text-xs text-neutral-500 py-2">Chưa có ai đăng ký slot này.</div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {registrations.map((reg: any) => (
                                                            <div key={reg.id} className="flex items-center justify-between text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="size-6 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                                                                        {reg.user.name?.[0]}
                                                                    </div>
                                                                    <span className="font-medium text-neutral-900 dark:text-neutral-200">
                                                                        {reg.user.name}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-neutral-500">
                                                                    {new Date(reg.createdAt).toLocaleDateString('vi-VN')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <NcModal
            isOpenProp={isOpen}
            onCloseModal={onClose}
            contentExtraClass="max-w-2xl"
            renderContent={renderContent}
            renderTrigger={() => null}
            modalTitle="Quản lý Slot (Lịch học)"
        />
    )
}

export default StudySlotsManagementModal
