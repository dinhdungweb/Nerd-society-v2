import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NerdCoinPage() {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                <CurrencyDollarIcon className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Thông tin Hạng thành viên
            </h3>
            <p className="mt-2 max-w-sm text-neutral-500 dark:text-neutral-400">
                Tính năng đang được phát triển. Thông tin chi tiết về quyền lợi thành viên sẽ sớm được cập nhật.
            </p>
        </div>
    )
}
