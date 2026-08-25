'use client'

import { TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { AdminConfirmDialog } from '@/components/admin/ui'

interface DeletePostButtonProps {
    postId: string
    postTitle: string
    onSuccess?: () => void
}

export default function DeletePostButton({ postId, postTitle, onSuccess }: DeletePostButtonProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const handleDelete = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/posts/${postId}`, {
                method: 'DELETE',
            })

            if (res.ok) {
                setConfirmOpen(false)
                toast.success('Đã xóa bài viết')
                if (onSuccess) {
                    onSuccess()
                } else {
                    router.refresh()
                }
            } else {
                const data = await res.json()
                // Handle 404 gracefully - remove from list if not found
                if (res.status === 404) {
                    if (onSuccess) onSuccess()
                    return
                }
                toast.error(data.error || 'Có lỗi xảy ra khi xóa bài viết')
            }
        } catch (error) {
            console.error(error)
            toast.error('Có lỗi xảy ra khi xóa bài viết')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                aria-label={`Xóa bài viết ${postTitle}`}
                disabled={loading}
                className="flex size-8 items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 disabled:opacity-50"
            >
                <TrashIcon className="size-4" />
            </button>
            <AdminConfirmDialog
                open={confirmOpen}
                title="Xóa bài viết?"
                description={<>Bài viết <strong>{postTitle}</strong> sẽ bị xóa khỏi hệ thống. Hành động này không thể hoàn tác.</>}
                confirmLabel="Xóa bài viết"
                pending={loading}
                onConfirm={handleDelete}
                onCancel={() => setConfirmOpen(false)}
            />
        </>
    )
}
