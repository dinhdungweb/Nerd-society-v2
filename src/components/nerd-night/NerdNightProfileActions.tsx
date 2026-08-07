'use client'

import { cancelNerdNightRegistration } from '@/actions/nerd-night'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import toast from 'react-hot-toast'

export default function NerdNightProfileActions({
  registrationId,
  canCancel,
}: {
  registrationId: string
  canCancel: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (!canCancel) return null

  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400"
      onClick={() => {
        if (!confirm('Bạn chắc chắn muốn huỷ chỗ Nerd Night này?')) return
        startTransition(async () => {
          const result = await cancelNerdNightRegistration(registrationId)
          if (!result.success) {
            toast.error(result.error)
            return
          }
          toast.success(result.message || 'Đã huỷ đăng ký')
          router.refresh()
        })
      }}
    >
      {pending ? 'Đang huỷ...' : 'Huỷ đăng ký'}
    </button>
  )
}
