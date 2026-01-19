import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, ClockIcon, CurrencyDollarIcon, UserIcon, MapPinIcon, CheckCircleIcon, BoltIcon } from '@heroicons/react/24/outline'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface Booking {
    id: string
    bookingCode: string
    status: string
    customerName: string
    customerPhone: string
    customerEmail: string | null
    startTime: string
    endTime: string
    date: string | Date
    guests: number
    estimatedAmount: number
    depositAmount: number
    depositStatus: string
    depositPaidAt: string | null  // User reported payment time
    actualStartTime: string | null
    actualEndTime: string | null
    actualAmount: number | null
    remainingAmount: number | null
    nerdCoinIssued: number
    note: string | null
    room: { name: string; type: string } | null
    location: { name: string } | null
}

interface BookingDetailModalProps {
    open: boolean
    setOpen: (open: boolean) => void
    booking: Booking | null
    onRefresh: () => void
}

export default function BookingDetailModal({ open, setOpen, booking, onRefresh }: BookingDetailModalProps) {
    const [loading, setLoading] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [checkoutPreview, setCheckoutPreview] = useState<any>(null)

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setCheckoutPreview(null)
        }
    }, [open, booking])

    const handleAction = async (action: 'CHECK_IN' | 'CHECK_OUT' | 'CANCEL') => {
        if (!booking) return

        if (action === 'CHECK_OUT' && !checkoutPreview) {
            // Pre-calculate surcharge first
            setCalculating(true)
            try {
                const res = await fetch('/api/admin/calculate-surcharge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: booking.id })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setCheckoutPreview(data)
            } catch (error) {
                toast.error('Lỗi tính toán phụ trội')
                console.error(error)
            } finally {
                setCalculating(false)
            }
            return
        }

        if (!confirm(`Bạn chắc chắn muốn ${action === 'CHECK_IN' ? 'Check-in' : (action === 'CANCEL' ? 'Hủy' : 'Check-out')} booking này?`)) return

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Có lỗi xảy ra')
            }

            const data = await res.json()

            // Show warning if customer hasn't paid deposit
            if (data.warning) {
                toast(data.warning, { icon: '⚠️', duration: 5000 })
            }

            // Show Nerd Coin info for Pod check-in
            if (action === 'CHECK_IN' && data.nerdCoinIssued > 0) {
                toast.success(`Check-in thành công! Phát ${data.nerdCoinIssued} Nerd Coin cho khách.`)
            } else {
                toast.success(
                    action === 'CHECK_IN' ? 'Check-in thành công' :
                        action === 'CHECK_OUT' ? 'Check-out thành công' : 'Đã hủy booking'
                )
            }
            onRefresh()
            setOpen(false)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmPayment = async () => {
        if (!booking) return
        if (!confirm('Xác nhận đã nhận được thanh toán từ khách hàng?')) return

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/confirm-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Có lỗi xảy ra')
            }

            toast.success('Đã xác nhận thanh toán!')
            onRefresh()
            setOpen(false)
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!booking) return null

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl dark:bg-neutral-900 border dark:border-neutral-800">
                                <div className="absolute right-4 top-4">
                                    <button
                                        type="button"
                                        className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 dark:hover:bg-neutral-800"
                                        onClick={() => setOpen(false)}
                                    >
                                        <XMarkIcon className="size-5" />
                                    </button>
                                </div>

                                <div className="p-6">
                                    <div className="mb-6">
                                        <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-neutral-900 dark:text-white flex items-center gap-2">
                                            Booking #{booking.bookingCode}
                                            <span className={`text-xs px-2 py-0.5 rounded-full border ${booking.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                booking.status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    booking.status === 'IN_PROGRESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        'bg-neutral-100 text-neutral-600 border-neutral-200'
                                                }`}>
                                                {booking.status}
                                            </span>
                                        </Dialog.Title>
                                        <p className="text-sm text-neutral-500 mt-1 dark:text-neutral-400">
                                            {format(new Date(booking.date), 'dd/MM/yyyy')} • {booking.startTime} - {booking.endTime}{booking.endTime <= booking.startTime ? ' (+1 ngày)' : ''}
                                        </p>
                                    </div>

                                    {/* Content Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        {/* Customer Info */}
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                                                <UserIcon className="size-4" /> Khách hàng
                                            </h4>
                                            <div className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg">
                                                <p className="font-medium">{booking.customerName}</p>
                                                <p>{booking.customerPhone}</p>
                                                <p className="truncate">{booking.customerEmail || 'Không có email'}</p>
                                                <p>{booking.guests} khách</p>
                                                {booking.note && booking.status !== 'CANCELLED' && (
                                                    <p className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 italic">
                                                        📝 {booking.note}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Room Info */}
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                                                <MapPinIcon className="size-4" /> Phòng & Dịch vụ
                                            </h4>
                                            <div className="text-sm text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg">
                                                <p className="font-medium">{booking.location?.name}</p>
                                                <p>{booking.room?.name}</p>
                                                <p className="text-xs text-neutral-500 mt-1">{booking.room?.type}</p>
                                            </div>
                                        </div>

                                        {/* Payment Info */}
                                        <div className="space-y-3 sm:col-span-2">
                                            <h4 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                                                <CurrencyDollarIcon className="size-4" /> Thanh toán
                                            </h4>
                                            <div className="text-sm bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-lg grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-neutral-500">Tổng dự kiến</p>
                                                    <p className="font-medium text-neutral-900 dark:text-white">{formatCurrency(booking.estimatedAmount)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-neutral-500">
                                                        {booking.depositStatus === 'PAID_CASH' ? 'Đã thu tiền mặt' :
                                                            booking.depositStatus === 'PAID_ONLINE' ? 'Đã chuyển khoản' :
                                                                booking.depositStatus === 'WAIVED' ? 'Miễn cọc (Khách quen)' :
                                                                    booking.depositPaidAt ? 'Chờ xác nhận CK' :
                                                                        'Chưa cọc'}
                                                    </p>
                                                    <p className={`font-medium ${booking.depositStatus === 'WAIVED' ? 'text-neutral-500' :
                                                        booking.depositPaidAt && booking.depositStatus === 'PENDING' ? 'text-orange-600' :
                                                            booking.depositStatus === 'PENDING' ? 'text-amber-600' :
                                                                'text-emerald-600'
                                                        }`}>
                                                        {booking.depositStatus === 'WAIVED' ? 'Không thu' : formatCurrency(booking.depositAmount)}
                                                    </p>
                                                    {booking.depositPaidAt && booking.depositStatus === 'PENDING' && (
                                                        <p className="text-xs text-orange-500 mt-1">
                                                            Khách báo CK lúc {new Date(booking.depositPaidAt).toLocaleTimeString('vi-VN')}
                                                        </p>
                                                    )}
                                                </div>
                                                {booking.actualAmount && (
                                                    <div className="col-span-2 border-t border-neutral-200 dark:border-neutral-700 pt-2 mt-2">
                                                        <p className="text-neutral-500">Tổng thực tế</p>
                                                        <p className="font-bold text-lg text-primary-600">{formatCurrency(booking.actualAmount)}</p>
                                                    </div>
                                                )}

                                                {/* Completed booking details */}
                                                {booking.status === 'COMPLETED' && booking.actualEndTime && (
                                                    <div className="col-span-2 border-t border-neutral-200 dark:border-neutral-700 pt-3 mt-2 space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-neutral-500">Giờ check-out thực tế:</span>
                                                            <span className="font-medium">{format(new Date(booking.actualEndTime), 'HH:mm')}</span>
                                                        </div>
                                                        {booking.actualAmount && booking.estimatedAmount && (
                                                            <>
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-neutral-500">Phụ thu quá giờ:</span>
                                                                    <span className="font-medium text-amber-600">
                                                                        {formatCurrency(booking.actualAmount - booking.estimatedAmount)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                                                    <span className="text-neutral-500">Đã thu cọc:</span>
                                                                    <span className={`font-medium ${booking.depositStatus === 'WAIVED' || booking.depositStatus === 'PENDING'
                                                                        ? 'text-neutral-500'
                                                                        : 'text-emerald-600'
                                                                        }`}>
                                                                        {booking.depositStatus === 'WAIVED' ? 'Không thu (Miễn cọc)' :
                                                                            booking.depositStatus === 'PENDING' ? 'Chưa thu' :
                                                                                formatCurrency(booking.depositAmount)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between text-sm font-bold">
                                                                    <span className="text-neutral-700 dark:text-neutral-300">Còn phải thu:</span>
                                                                    <span className="text-red-600">
                                                                        {formatCurrency(booking.remainingAmount || (booking.actualAmount - booking.depositAmount))}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {booking.nerdCoinIssued > 0 && (
                                                    <div className="col-span-2 text-amber-500 font-medium text-xs mt-1">
                                                        Feature Only: Đã cộng {booking.nerdCoinIssued} Nerd Coin
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Cancellation Info - Show when booking is cancelled */}
                                        {booking.status === 'CANCELLED' && (
                                            <div className="space-y-3 sm:col-span-2">
                                                <h4 className="font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                                                    <XMarkIcon className="size-4" /> Thông tin hủy
                                                </h4>
                                                <div className="text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                                                    <p className="font-medium text-red-700 dark:text-red-300">
                                                        {booking.note?.includes('Khách tự hủy') ? '👤 Khách hàng tự hủy' :
                                                            booking.note?.includes('Tự động hủy') ? '⏰ Hệ thống tự động hủy' :
                                                                booking.note?.includes('Admin') || booking.note?.includes('Staff') ? '👨‍💼 Admin/Staff hủy' :
                                                                    '❌ Đã hủy'}
                                                    </p>
                                                    {booking.note && (
                                                        <p className="text-red-600 dark:text-red-400 mt-1">
                                                            {booking.note}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Checkout Preview */}
                                        {checkoutPreview && (
                                            <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 dark:bg-amber-900/20 dark:border-amber-800">
                                                <h4 className="font-bold text-amber-800 dark:text-amber-400 mb-2">Xem trước thanh toán</h4>
                                                <div className="space-y-1 text-sm text-amber-900 dark:text-amber-300">
                                                    <div className="flex justify-between">
                                                        <span>Giờ check-out:</span>
                                                        <span>{format(new Date(checkoutPreview.actualEnd), 'HH:mm')}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Quá giờ:</span>
                                                        <span>{checkoutPreview.overtimeMinutes} phút</span>
                                                    </div>
                                                    <div className="flex justify-between font-medium">
                                                        <span>Phụ thu:</span>
                                                        <span>{formatCurrency(checkoutPreview.surcharge)}</span>
                                                    </div>
                                                    <div className="border-t border-amber-200 dark:border-amber-800 my-2 pt-2 flex justify-between font-bold text-lg">
                                                        <span>Cần thu thêm:</span>
                                                        <span>{formatCurrency(checkoutPreview.remainingAmount)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-amber-600 mt-2 italic">*Vui lòng thu tiền mặt khoản còn thiếu trước khi xác nhận.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-8 flex gap-3 justify-end">
                                        {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                                            <>
                                                <button
                                                    onClick={() => handleAction('CANCEL')}
                                                    disabled={loading}
                                                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20"
                                                >
                                                    Hủy booking
                                                </button>
                                                {/* Show confirm payment button for PENDING bookings
                                                    - If depositPaidAt exists: Customer reported payment (highlight urgency)
                                                    - Otherwise: Admin can manually verify and confirm */}
                                                {booking.status === 'PENDING' && (
                                                    <button
                                                        onClick={handleConfirmPayment}
                                                        disabled={loading}
                                                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${booking.depositPaidAt
                                                            ? 'bg-orange-500 hover:bg-orange-600'
                                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                                            }`}
                                                    >
                                                        {loading ? 'Đang xử lý...' : 'Xác nhận CK'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleAction('CHECK_IN')}
                                                    disabled={loading}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
                                                >
                                                    {loading ? 'Đang xử lý...' : 'Check-in'}
                                                </button>
                                            </>
                                        )}
                                        {booking.status === 'IN_PROGRESS' && (
                                            <button
                                                onClick={() => handleAction('CHECK_OUT')}
                                                disabled={loading || calculating}
                                                className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                                            >
                                                {calculating ? 'Đang tính tiền...' : checkoutPreview ? 'Xác nhận Check-out' : 'Check-out & Tính tiền'}
                                            </button>
                                        )}
                                        {booking.status === 'COMPLETED' && (
                                            <div className="flex items-center gap-2 text-emerald-600 font-medium px-4 py-2">
                                                <CheckCircleIcon className="size-5" /> Đã hoàn thành
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    )
}
