import WalletTopupModal from '@/components/profile/WalletTopupModal'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getVietQRConfig } from '@/lib/vietqr'
import { ensureUserWalletAccount } from '@/lib/wallet-account'
import {
    ArrowDownIcon,
    ArrowUpIcon,
    BanknotesIcon,
    ExclamationTriangleIcon,
    WalletIcon,
} from '@heroicons/react/24/outline'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const transactionLabels: Record<string, string> = {
    TOPUP: 'Nạp tiền',
    DEBIT: 'Trừ tiền',
    ADJUSTMENT: 'Điều chỉnh',
    SESSION_CHARGE: 'Phí sử dụng không gian',
    OVERAGE_CHARGE: 'Phí quá giờ',
    BOOKING_PAYMENT: 'Thanh toán đặt lịch',
    SUBSCRIPTION_PURCHASE: 'Mua gói thành viên',
    REFUND: 'Hoàn tiền',
    OVERAGE_PAYMENT: 'Thanh toán nợ',
}

const descriptionLabels: Record<string, string> = {
    'Admin topup wallet': 'Nạp tiền thủ công bởi admin',
}

export default async function WalletPage() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) redirect('/login')

    const walletAccount = await ensureUserWalletAccount(session.user.id)
    if (!walletAccount.success) {
        return (
            <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                    <ExclamationTriangleIcon className="size-10" />
                </div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Chưa thể mở Ví Nerd</h2>
                <p className="mt-2 max-w-md text-neutral-500 dark:text-neutral-400">{walletAccount.message}</p>
                <Link
                    href="/profile/settings"
                    className="mt-6 rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl"
                >
                    Cập nhật tài khoản
                </Link>
            </div>
        )
    }

    const [wallet, bankConfig] = await Promise.all([
        prisma.wallet.findUnique({
            where: { id: walletAccount.wallet.id },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        }),
        getVietQRConfig(),
    ])

    if (!wallet) return null

    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="relative min-w-0 overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-950 p-5 text-white shadow-xl sm:p-6">
                    <div className="absolute right-0 top-0 -mr-10 -mt-10 size-40 rounded-full bg-white/5" />
                    <div className="relative">
                        <div className="flex items-center gap-2 text-neutral-300">
                            <WalletIcon className="size-5" />
                            <span className="text-sm font-medium">Ví Nerd</span>
                        </div>
                        <p className="mt-3 break-words text-3xl font-bold sm:text-4xl">
                            {wallet.balance.toLocaleString()}
                            <span className="ml-1 text-base font-normal text-neutral-400">đ</span>
                        </p>
                        <p className="mt-2 text-sm text-neutral-400">
                            Dùng để nạp tiền, thanh toán đặt lịch và các dịch vụ tại Nerd.
                        </p>

                        {(walletAccount.subscriber?.outstandingBalance || 0) > 0 && (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200">
                                <ExclamationTriangleIcon className="size-4" />
                                Công nợ: {walletAccount.subscriber?.outstandingBalance.toLocaleString()}đ
                            </div>
                        )}

                        <div className="mt-5">
                            <WalletTopupModal
                                walletCode={wallet.walletCode}
                                legacyEmpId={walletAccount.subscriber?.mytimeEmpId || undefined}
                                bankConfig={{
                                    bankCode: bankConfig.bankCode,
                                    accountNumber: bankConfig.accountNumber,
                                    accountName: bankConfig.accountName,
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
                    <div className="flex items-center gap-2 text-neutral-500">
                        <BanknotesIcon className="size-5" />
                        <span className="text-sm font-medium">Thông tin nạp tiền</span>
                    </div>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-4">
                            <span className="text-neutral-500">Mã ví</span>
                            <span className="min-w-0 break-all text-right font-mono font-bold text-primary-600">{wallet.walletCode}</span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                            <span className="text-neutral-500">Nội dung CK</span>
                            <span className="min-w-0 break-all text-right font-mono font-bold text-neutral-900 dark:text-white">VI {wallet.walletCode}</span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                            <span className="text-neutral-500">Ngân hàng</span>
                            <span className="font-medium text-neutral-900 dark:text-white">{bankConfig.bankCode}</span>
                        </div>
                    </div>
                    <p className="mt-4 rounded-xl bg-primary-50 p-3 text-xs text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                        Chuyển khoản đúng nội dung để hệ thống tự cộng tiền vào ví.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Lịch sử ví</h3>
                {wallet.transactions.length > 0 ? (
                    <div className="space-y-2">
                        {wallet.transactions.map((tx) => {
                            const isCredit = tx.amount > 0
                            return (
                                <div
                                    key={tx.id}
                                    className="flex flex-col gap-3 rounded-xl border border-neutral-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="flex min-w-0 items-center gap-3">
                                        <div className={`flex size-9 items-center justify-center rounded-full ${isCredit
                                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                                            : 'bg-red-50 text-red-600 dark:bg-red-900/20'
                                            }`}>
                                            {isCredit ? <ArrowDownIcon className="size-4" /> : <ArrowUpIcon className="size-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                                {transactionLabels[tx.type] || tx.type}
                                            </p>
                                            <p className="text-xs text-neutral-400">
                                                {new Date(tx.createdAt).toLocaleString('vi-VN')}
                                            </p>
                                            {tx.description && (
                                                <p className="mt-0.5 break-words text-xs text-neutral-500">{descriptionLabels[tx.description] || tx.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-left sm:text-right">
                                        <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isCredit ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}đ
                                        </p>
                                        <p className="text-xs text-neutral-400">
                                            Số dư: {tx.balanceAfter.toLocaleString()}đ
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
                        <p className="text-sm text-neutral-400">Chưa có giao dịch ví nào</p>
                    </div>
                )}
            </div>
        </div>
    )
}
