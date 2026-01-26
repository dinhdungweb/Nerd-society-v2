
'use client'

import React, { useState } from 'react'
import { ClockIcon, MapPinIcon, TrashIcon } from '@heroicons/react/24/outline'
import NcModal from '@/shared/NcModal'
import { Button } from '@/shared/Button'
import ButtonSecondary from '@/shared/ButtonSecondary'
import { cancelRegistration } from '@/actions/study-planner'
import toast from 'react-hot-toast'

interface RegisteredSlotItemProps {
    registration: any
}

const RegisteredSlotItem = ({ registration }: RegisteredSlotItemProps) => {
    const [showModal, setShowModal] = useState(false)
    const [loading, setLoading] = useState(false)

    const start = new Date(registration.weekStart)
    const offset = registration.slot.dayOfWeek === 0 ? 6 : registration.slot.dayOfWeek - 1
    start.setDate(start.getDate() + offset)
    const dateStr = start.toLocaleDateString('vi-VN')

    const handleConfirmDelete = async () => {
        try {
            setLoading(true)
            const result = await cancelRegistration(registration.id)
            if (result.success) {
                toast.success('Đã hủy đăng ký thành công')
                setShowModal(false)
            } else {
                toast.error(result.error || 'Có lỗi xảy ra')
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra khi hủy')
        } finally {
            setLoading(false)
        }
    }

    const renderModalContent = () => {
        return (
            <div className="space-y-4">
                <p className="text-neutral-600 dark:text-neutral-300">
                    Bạn có chắc chắn muốn hủy đăng ký slot này không?
                    <br />
                    <span className="font-medium text-neutral-900 dark:text-white mt-2 block">
                        {registration.slot.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${registration.slot.dayOfWeek + 1}`}, {dateStr} • {registration.slot.startTime} - {registration.slot.endTime}
                    </span>
                </p>
                <div className="flex gap-3 justify-end mt-6">
                    <ButtonSecondary type="button" onClick={() => setShowModal(false)} disabled={loading}>
                        Không
                    </ButtonSecondary>
                    <Button
                        type="button"
                        onClick={handleConfirmDelete}
                        loading={loading}
                        color="primary"
                        className="!border-0 !bg-primary-600 hover:!bg-primary-700 !text-white shadow-lg shadow-primary-500/30"
                    >
                        Đồng ý hủy
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="group relative flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 hover:border-primary-500 hover:shadow-md transition-all dark:border-neutral-700 dark:bg-neutral-800">
                <div className="flex flex-col items-center justify-center size-14 shrink-0 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400">
                    <span className="text-sm font-bold">{registration.slot.dayOfWeek === 0 ? 'CN' : `T${registration.slot.dayOfWeek + 1}`}</span>
                    <span className="text-xs">{start.getDate()}/{start.getMonth() + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
                        <ClockIcon className="size-4 text-neutral-500" />
                        {registration.slot.startTime} - {registration.slot.endTime}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-neutral-500 truncate mt-1">
                        <MapPinIcon className="size-4" />
                        {registration.slot.location?.name || 'Unknown Location'}
                    </div>
                </div>

                <button
                    onClick={() => setShowModal(true)}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Hủy đăng ký"
                >
                    <TrashIcon className="size-5" />
                </button>
            </div>

            <NcModal
                isOpenProp={showModal}
                onCloseModal={() => setShowModal(false)}
                modalTitle="Xác nhận hủy lịch"
                renderContent={renderModalContent}
                renderTrigger={() => null}
            />
        </div>
    )
}

export default RegisteredSlotItem
