import NerdNightProfileActions from '@/components/nerd-night/NerdNightProfileActions'
import { authOptions } from '@/lib/auth'
import { formatNerdNightDate, formatVnd } from '@/lib/nerd-night/format'
import { isNerdNightPaymentExpired } from '@/lib/nerd-night/registration-state'
import { prisma } from '@/lib/prisma'
import { CalendarDaysIcon, MapPinIcon, MoonIcon } from '@heroicons/react/24/outline'
import { getServerSession } from 'next-auth'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const paymentLabels: Record<string, { label: string; className: string }> = {
  UNPAID: { label: 'Chưa chuyển khoản', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  PENDING: { label: 'Chờ xác nhận', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

export default async function NerdNightProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const registrations = await prisma.nerdNightRegistration.findMany({
    where: { userId: session.user.id },
    include: {
      event: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const reviews = await prisma.nerdNightReview.findMany({
    where: { userId: session.user.id },
    select: { eventId: true },
  })
  const reviewedEventIds = new Set(reviews.map((review) => review.eventId))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Nerd Night của tôi</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Theo dõi vé, chủ đề chia sẻ và những đêm cần feedback.</p>
        </div>
        <Link href="/nerd-night" className="inline-flex items-center justify-center rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
          Xem lịch Nerd Night
        </Link>
      </div>

      {registrations.length ? (
        <div className="space-y-4">
          {registrations.map((registration) => {
            const payment = paymentLabels[registration.paymentStatus]
            const isExpired = isNerdNightPaymentExpired(registration)
            const needsReview = registration.event.status === 'COMPLETED' && registration.paymentStatus === 'CONFIRMED' && registration.status === 'ACTIVE' && !reviewedEventIds.has(registration.eventId)
            return (
              <article key={registration.id} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${payment.className}`}>{payment.label}</span>
                      {(registration.status !== 'ACTIVE' || isExpired) && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">{registration.status === 'EXPIRED' || isExpired ? 'Hết hạn giữ chỗ' : 'Đã huỷ'}</span>}
                      {registration.refundStatus === 'PENDING' && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Đang chờ hoàn Ví Nerd</span>}
                      {registration.refundStatus === 'COMPLETED' && <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Đã hoàn Ví Nerd</span>}
                      {needsReview && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Cần feedback</span>}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">{registration.event.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-1.5"><CalendarDaysIcon className="size-4" />{formatNerdNightDate(registration.event.startsAt)}</span>
                      <span className="flex items-center gap-1.5"><MapPinIcon className="size-4" />{registration.event.venueName}</span>
                    </div>
                    {registration.topicTitle && <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm dark:bg-neutral-800"><b>Chủ đề:</b> {registration.topicTitle}<span className="ml-2 text-xs text-neutral-500">({registration.speakerStatus === 'APPROVED' ? 'đã duyệt' : registration.speakerStatus === 'REJECTED' ? 'không được duyệt' : 'đang duyệt'})</span></div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{formatVnd(registration.amount)}</span>
                    <span className="font-mono text-xs text-neutral-500">{registration.registrationCode}</span>
                    <div className="mt-2 flex gap-3">
                      <Link href={`/nerd-night/${registration.event.slug}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">{needsReview ? 'Gửi feedback' : 'Xem chi tiết'}</Link>
                      <NerdNightProfileActions registrationId={registration.id} canCancel={registration.status === 'ACTIVE' && !isExpired && registration.paymentStatus !== 'CONFIRMED' && registration.event.status === 'PUBLISHED' && registration.event.startsAt > new Date()} />
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <MoonIcon className="mx-auto size-12 text-neutral-400" />
          <p className="mt-3 text-neutral-500 dark:text-neutral-400">Bạn chưa đăng ký đêm Nerd Night nào.</p>
        </div>
      )}
    </div>
  )
}
