'use client'

import { usePermissions } from '@/contexts/PermissionsContext'
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    BanknotesIcon,
    MagnifyingGlassIcon,
    WalletIcon,
} from '@heroicons/react/24/outline'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

type WalletRow = {
    id: string
    walletCode: string
    balance: number
    status: string
    user: {
        id: string
        name: string | null
        email: string
        phone: string | null
        subscriber: {
            id: string
            fullName: string
            outstandingBalance: number
        } | null
    }
    _count: { transactions: number }
}

type WalletTransaction = {
    id: string
    type: string
    source: string
    status: string
    amount: number
    balanceBefore: number
    balanceAfter: number
    externalTransactionId: string | null
    referenceType: string | null
    referenceId: string | null
    description: string | null
    note: string | null
    createdAt: string
    wallet?: { walletCode: string; user: { name: string | null; email: string; phone: string | null } }
    createdBy?: { name: string | null; email: string } | null
}

type BankTransaction = {
    id: string
    externalTransactionId: string
    bankAccount: string | null
    amount: number
    transType: string | null
    content: string | null
    status: string
    note: string | null
    rawPayload: unknown
    transactionTime: string | null
    createdAt: string
    matchedWallet?: { walletCode: string; user: { name: string | null; email: string; phone: string | null } } | null
    matchedTransaction?: { id: string; balanceAfter: number } | null
}

type WalletsResponse = {
    wallets: WalletRow[]
    stats: {
        walletCount: number
        totalBalance: number
        totalTopup: number
        totalDebit: number
        pendingBankCount: number
    }
    recentTransactions: WalletTransaction[]
}

const money = (value: number) => `${value.toLocaleString()}đ`

const transactionTypeLabels: Record<string, string> = {
    TOPUP: 'Nạp tiền',
    DEBIT: 'Trừ tiền',
    ADJUSTMENT: 'Điều chỉnh số dư',
    REFUND: 'Hoàn tiền',
    BOOKING_PAYMENT: 'Thanh toán đặt lịch',
    SUBSCRIPTION_PURCHASE: 'Mua gói thành viên',
    SESSION_CHARGE: 'Phí sử dụng không gian',
    OVERAGE_CHARGE: 'Phí quá giờ',
    OVERAGE_PAYMENT: 'Thanh toán công nợ',
}

const transactionSourceLabels: Record<string, string> = {
    SYSTEM: 'Hệ thống',
    VIETQR: 'VietQR',
    MANUAL_ADMIN: 'Quản trị viên',
    BOOKING: 'Đặt lịch',
    SUBSCRIPTION: 'Gói thành viên',
    MONTHLY_BEAVER: 'Monthly Beaver',
}

const transactionStatusLabels: Record<string, string> = {
    PENDING: 'Đang xử lý',
    COMPLETED: 'Hoàn tất',
    FAILED: 'Thất bại',
    REVERSED: 'Đã hoàn tác',
}

const bankStatusLabels: Record<string, string> = {
    PENDING: 'Chờ đối soát',
    MATCHED: 'Đã đối soát',
    DUPLICATE: 'Trùng giao dịch',
    IGNORED: 'Đã bỏ qua',
    ERROR: 'Lỗi đối soát',
}

function formatDateTime(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })
}

function getBankReferenceNumber(rawPayload: unknown) {
    if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return ''
    const payload = rawPayload as Record<string, unknown>
    const value = payload.referencenumber ?? payload.referenceNumber ?? payload.reference_number ?? payload.refNo ?? payload.refno
    return value === null || value === undefined ? '' : String(value)
}

export default function AdminWalletsPage() {
    const { hasPermission } = usePermissions()
    const canManageWallets = hasPermission('canManageWallets')
    const [activeTab, setActiveTab] = useState<'wallets' | 'transactions' | 'reconciliation'>('wallets')
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState('ALL')
    const [walletData, setWalletData] = useState<WalletsResponse | null>(null)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedWallet, setSelectedWallet] = useState<WalletRow | null>(null)
    const [adjustAction, setAdjustAction] = useState<'TOPUP' | 'DEBIT' | 'REFUND' | 'ADJUSTMENT' | 'PAY_DEBT'>('TOPUP')
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [matchWalletId, setMatchWalletId] = useState('')

    const wallets = walletData?.wallets || []
    const walletOptions = useMemo(() => wallets.map((wallet) => ({
        id: wallet.id,
        label: `${wallet.walletCode} - ${wallet.user.name || wallet.user.email}`,
    })), [wallets])

    const fetchWallets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (query) params.set('q', query)
            if (status !== 'ALL') params.set('status', status)
            const res = await fetch(`/api/admin/wallets?${params.toString()}`)
            if (!res.ok) throw new Error('Không tải được danh sách ví')
            setWalletData(await res.json())
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    const fetchTransactions = async () => {
        const res = await fetch('/api/admin/wallet-transactions?limit=100')
        if (res.ok) {
            const data = await res.json()
            setTransactions(data.transactions)
        }
    }

    const fetchBankTransactions = async () => {
        const res = await fetch('/api/admin/wallet-reconciliation?limit=100')
        if (res.ok) {
            const data = await res.json()
            setBankTransactions(data.bankTransactions)
        }
    }

    const refreshAll = async () => {
        await Promise.all([fetchWallets(), fetchTransactions(), fetchBankTransactions()])
    }

    useEffect(() => {
        refreshAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const submitAdjustment = async () => {
        if (!selectedWallet) return
        try {
            const res = await fetch(`/api/admin/wallets/${selectedWallet.id}/adjust`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: adjustAction,
                    amount: Number(amount),
                    note,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại')
            toast.success('Đã cập nhật ví')
            setSelectedWallet(null)
            setAmount('')
            setNote('')
            await refreshAll()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const reconcile = async (bankTransactionId: string, action: 'MATCH' | 'IGNORE') => {
        try {
            const res = await fetch('/api/admin/wallet-reconciliation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    bankTransactionId,
                    walletId: matchWalletId,
                    note,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Đối soát thất bại')
            toast.success(action === 'MATCH' ? 'Đã gán giao dịch vào ví' : 'Đã bỏ qua giao dịch')
            setMatchWalletId('')
            setNote('')
            await refreshAll()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý Ví user</h1>
                    <p className="mt-1 text-sm text-neutral-500">Số dư, sổ giao dịch và đối soát VietQR cho Ví Nerd.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={refreshAll}
                        className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    >
                        <ArrowPathIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                        Làm mới
                    </button>
                    <a
                        href="/api/admin/wallet-transactions?format=csv&limit=500"
                        className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                    >
                        <ArrowDownTrayIcon className="size-4" />
                        Export CSV
                    </a>
                </div>
            </div>

            {walletData && (
                <div className="grid gap-3 md:grid-cols-4">
                    <Stat label="Tổng số ví" value={walletData.stats.walletCount.toLocaleString()} />
                    <Stat label="Tổng số dư" value={money(walletData.stats.totalBalance)} />
                    <Stat label="Tổng nạp" value={money(walletData.stats.totalTopup)} />
                    <Stat label="Cần đối soát" value={walletData.stats.pendingBankCount.toLocaleString()} tone="amber" />
                </div>
            )}

            <div className="flex flex-col gap-3 pb-3 lg:flex-row lg:items-center lg:justify-between lg:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        ['wallets', 'Danh sách ví'],
                        ['transactions', 'Sổ giao dịch'],
                        ['reconciliation', 'Đối soát VietQR'],
                    ].map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setActiveTab(key as any)}
                            className={`border-b-2 px-4 py-3 text-sm font-medium ${activeTab === key
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {activeTab === 'wallets' && (
                    <div className="grid w-full grid-cols-1 gap-3 lg:w-[min(760px,58vw)] lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                        <div className="relative min-w-0">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => event.key === 'Enter' && fetchWallets()}
                                placeholder="Tìm tên, email, phone, mã ví"
                                className="w-full rounded-lg border border-neutral-200 py-2 pl-10 pr-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            />
                        </div>
                        <select
                            value={status}
                            onChange={(event) => setStatus(event.target.value)}
                            className="w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="LOCKED">LOCKED</option>
                        </select>
                        <button
                            type="button"
                            onClick={fetchWallets}
                            className="whitespace-nowrap rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                        >
                            Lọc
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'wallets' && (
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                        <table className="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                            <thead className="bg-neutral-50 dark:bg-neutral-900">
                                <tr>
                                    <Th>User</Th>
                                    <Th>Mã ví</Th>
                                    <Th>Số dư</Th>
                                    <Th>Công nợ MB</Th>
                                    <Th>Giao dịch</Th>
                                    <Th>Thao tác</Th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                                {wallets.map((wallet) => (
                                    <tr key={wallet.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900">
                                        <Td>
                                            <div className="font-medium text-neutral-900 dark:text-white">{wallet.user.name || wallet.user.email}</div>
                                            <div className="text-xs text-neutral-500">{wallet.user.email}</div>
                                            {wallet.user.phone && <div className="text-xs text-neutral-400">{wallet.user.phone}</div>}
                                        </Td>
                                        <Td><span className="font-mono font-semibold text-primary-600">{wallet.walletCode}</span></Td>
                                        <Td><span className="font-semibold">{money(wallet.balance)}</span></Td>
                                        <Td>{money(wallet.user.subscriber?.outstandingBalance || 0)}</Td>
                                        <Td>{wallet._count.transactions}</Td>
                                        <Td>
                                            {canManageWallets && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedWallet(wallet)}
                                                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                                >
                                                    Điều chỉnh
                                                </button>
                                            )}
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'transactions' && (
                <TransactionList transactions={transactions} />
            )}

            {activeTab === 'reconciliation' && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800 md:flex-row">
                        <select
                            value={matchWalletId}
                            onChange={(event) => setMatchWalletId(event.target.value)}
                            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        >
                            <option value="">Chọn ví để gán thủ công</option>
                            {walletOptions.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                        <input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Ghi chú đối soát"
                            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                        />
                        <a
                            href="/api/admin/wallet-reconciliation?format=csv&limit=500"
                            className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                        >
                            Export đối soát
                        </a>
                    </div>
                    <div className="max-h-[680px] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
                        <table className="min-w-[1280px] divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                            <thead className="sticky top-0 z-10 bg-neutral-50 shadow-sm dark:bg-neutral-900">
                                <tr>
                                    <Th>Thời gian</Th>
                                    <Th>Mã / Số giao dịch</Th>
                                    <Th>Tài khoản / Nội dung</Th>
                                    <Th>Ví được ghép</Th>
                                    <Th>Trạng thái</Th>
                                    <Th><div className="text-right">Số tiền</div></Th>
                                    <Th>Thao tác</Th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                                {bankTransactions.map((tx) => {
                                    const referenceNumber = getBankReferenceNumber(tx.rawPayload)
                                    return (
                                        <tr key={tx.id} className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-900/70">
                                            <Td>
                                                <div className="whitespace-nowrap font-medium text-neutral-900 dark:text-white">
                                                    {formatDateTime(tx.transactionTime || tx.createdAt)}
                                                </div>
                                                {tx.transactionTime && <div className="mt-1 whitespace-nowrap text-xs text-neutral-400">Nhận: {formatDateTime(tx.createdAt)}</div>}
                                            </Td>
                                            <Td>
                                                <div className="max-w-52 break-all font-mono text-xs font-semibold text-neutral-900 dark:text-white">{tx.externalTransactionId}</div>
                                                <div className="mt-1 text-xs text-neutral-500">Số GD: <span className="font-mono">{referenceNumber || '—'}</span></div>
                                            </Td>
                                            <Td>
                                                <div className="font-mono text-xs text-neutral-500">{tx.bankAccount || 'Không có số tài khoản'}</div>
                                                <div className="mt-1 max-w-72 break-words text-neutral-800 dark:text-neutral-200">{tx.content || 'Không có nội dung'}</div>
                                                {tx.note && <div className="mt-1 max-w-72 text-xs text-amber-600">Ghi chú: {tx.note}</div>}
                                            </Td>
                                            <Td>
                                                {tx.matchedWallet ? (
                                                    <>
                                                        <div className="font-mono font-semibold text-primary-600">{tx.matchedWallet.walletCode}</div>
                                                        <div className="mt-1 max-w-48 truncate text-xs text-neutral-500">{tx.matchedWallet.user.name || tx.matchedWallet.user.email}</div>
                                                        {tx.matchedTransaction && <div className="mt-1 text-xs text-neutral-400">Số dư sau: {money(tx.matchedTransaction.balanceAfter)}</div>}
                                                    </>
                                                ) : (
                                                    <span className="text-neutral-400">Chưa ghép ví</span>
                                                )}
                                            </Td>
                                            <Td><BankStatusBadge status={tx.status} /></Td>
                                            <Td>
                                                <div className="whitespace-nowrap text-right font-bold tabular-nums text-emerald-600">{money(tx.amount)}</div>
                                                <div className="mt-1 text-right text-xs text-neutral-400">{tx.transType === 'D' ? 'Tiền ra' : 'Tiền vào'}</div>
                                            </Td>
                                            <Td>
                                                {canManageWallets && tx.status !== 'MATCHED' ? (
                                                    <div className="flex min-w-32 flex-col gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => reconcile(tx.id, 'MATCH')}
                                                            disabled={!matchWalletId}
                                                            className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                                        >
                                                            Gán ví
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => reconcile(tx.id, 'IGNORE')}
                                                            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                                                        >
                                                            Bỏ qua
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-neutral-400">Không có thao tác</span>
                                                )}
                                            </Td>
                                        </tr>
                                    )
                                })}
                                {bankTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-neutral-400">Chưa có giao dịch ngân hàng để đối soát</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {selectedWallet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-neutral-900">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                                <WalletIcon className="size-5" />
                            </div>
                            <div>
                                <h2 className="font-bold text-neutral-900 dark:text-white">{selectedWallet.user.name || selectedWallet.user.email}</h2>
                                <p className="text-sm text-neutral-500">{selectedWallet.walletCode} - {money(selectedWallet.balance)}</p>
                            </div>
                        </div>
                        <div className="mt-4 space-y-3">
                            <select
                                value={adjustAction}
                                onChange={(event) => setAdjustAction(event.target.value as any)}
                                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            >
                                <option value="TOPUP">Nạp thủ công</option>
                                <option value="DEBIT">Trừ thủ công</option>
                                <option value="REFUND">Hoàn tiền</option>
                                <option value="ADJUSTMENT">Điều chỉnh tăng</option>
                                <option value="PAY_DEBT">Thanh toán nợ Monthly Beaver</option>
                            </select>
                            <input
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                type="number"
                                min="0"
                                placeholder={adjustAction === 'PAY_DEBT' ? 'Số tiền, bỏ trống để trả tối đa' : 'Số tiền'}
                                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            />
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder="Lý do bắt buộc"
                                rows={3}
                                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                            />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedWallet(null)}
                                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={submitAdjustment}
                                className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-600"
                            >
                                Lưu giao dịch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'amber' }) {
    return (
        <div className={`rounded-xl border p-4 ${tone === 'amber'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white'
            }`}>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
                <BanknotesIcon className="size-4" />
                {label}
            </div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
        </div>
    )
}

function Th({ children }: { children: React.ReactNode }) {
    return <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
    return <td className="px-4 py-3 align-middle text-neutral-700 dark:text-neutral-300">{children}</td>
}

function TransactionStatusBadge({ status }: { status: string }) {
    const classes = status === 'COMPLETED'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : status === 'PENDING'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'

    return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>
            {transactionStatusLabels[status] || status}
        </span>
    )
}

function BankStatusBadge({ status }: { status: string }) {
    const classes = status === 'MATCHED'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : status === 'ERROR'
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
            : status === 'IGNORED'
                ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'

    return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes}`}>
            {bankStatusLabels[status] || status}
        </span>
    )
}

function TransactionList({ transactions }: { transactions: WalletTransaction[] }) {
    return (
        <div className="max-h-[680px] overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-[1320px] divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
                <thead className="sticky top-0 z-10 bg-neutral-50 shadow-sm dark:bg-neutral-900">
                    <tr>
                        <Th>Thời gian</Th>
                        <Th>Ví / User</Th>
                        <Th>Loại / Nguồn</Th>
                        <Th>Trạng thái</Th>
                        <Th>Mã tham chiếu</Th>
                        <Th><div className="text-right">Biến động</div></Th>
                        <Th><div className="text-right">Số dư trước</div></Th>
                        <Th><div className="text-right">Số dư sau</div></Th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                    {transactions.map((tx) => {
                        const isCredit = tx.amount > 0
                        return (
                            <tr key={tx.id} className="align-top hover:bg-neutral-50 dark:hover:bg-neutral-900/70">
                                <Td>
                                    <div className="whitespace-nowrap font-medium text-neutral-900 dark:text-white">{formatDateTime(tx.createdAt)}</div>
                                    <div className="mt-1 max-w-40 truncate font-mono text-xs text-neutral-400" title={tx.id}>{tx.id}</div>
                                </Td>
                                <Td>
                                    <div className="font-mono font-semibold text-primary-600">{tx.wallet?.walletCode || '—'}</div>
                                    <div className="mt-1 max-w-52 truncate text-xs text-neutral-500">{tx.wallet?.user.name || tx.wallet?.user.email || 'Không xác định'}</div>
                                    {tx.wallet?.user.phone && <div className="mt-0.5 text-xs text-neutral-400">{tx.wallet.user.phone}</div>}
                                </Td>
                                <Td>
                                    <div className="font-semibold text-neutral-900 dark:text-white">{transactionTypeLabels[tx.type] || tx.type}</div>
                                    <div className="mt-1 text-xs text-neutral-500">{transactionSourceLabels[tx.source] || tx.source}</div>
                                    {tx.description && <div className="mt-1 max-w-64 break-words text-xs text-neutral-400">{tx.description}</div>}
                                    {tx.note && <div className="mt-1 max-w-64 break-words text-xs text-amber-600">Ghi chú: {tx.note}</div>}
                                </Td>
                                <Td><TransactionStatusBadge status={tx.status} /></Td>
                                <Td>
                                    <div className="max-w-52 break-all font-mono text-xs text-neutral-700 dark:text-neutral-300">{tx.externalTransactionId || '—'}</div>
                                    {(tx.referenceType || tx.referenceId) && (
                                        <div className="mt-1 max-w-52 break-all text-xs text-neutral-400">
                                            {tx.referenceType || 'Tham chiếu'}: <span className="font-mono">{tx.referenceId || '—'}</span>
                                        </div>
                                    )}
                                    {tx.createdBy && <div className="mt-1 text-xs text-neutral-400">Tạo bởi: {tx.createdBy.name || tx.createdBy.email}</div>}
                                </Td>
                                <Td>
                                    <div className={`whitespace-nowrap text-right font-bold tabular-nums ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {isCredit ? '+' : '-'}{money(Math.abs(tx.amount))}
                                    </div>
                                </Td>
                                <Td><div className="whitespace-nowrap text-right tabular-nums">{money(tx.balanceBefore)}</div></Td>
                                <Td><div className="whitespace-nowrap text-right font-semibold tabular-nums text-neutral-900 dark:text-white">{money(tx.balanceAfter)}</div></Td>
                            </tr>
                        )
                    })}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-400">Chưa có giao dịch ví</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
