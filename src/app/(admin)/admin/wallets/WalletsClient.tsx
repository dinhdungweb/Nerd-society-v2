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
            mytimeEmpId: string | null
        } | null
    }
    _count: { transactions: number }
}

type WalletTransaction = {
    id: string
    type: string
    source: string
    amount: number
    balanceAfter: number
    description: string | null
    note: string | null
    createdAt: string
    wallet?: { walletCode: string; user: { name: string | null; email: string } }
}

type BankTransaction = {
    id: string
    externalTransactionId: string
    amount: number
    transType: string | null
    content: string | null
    status: string
    note: string | null
    createdAt: string
    matchedWallet?: { walletCode: string; user: { name: string | null; email: string } } | null
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
                    <div className="space-y-2">
                        {bankTransactions.map((tx) => (
                            <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-sm font-semibold">{tx.externalTransactionId}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tx.status === 'MATCHED'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : tx.status === 'ERROR'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-amber-100 text-amber-700'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-sm text-neutral-500">{tx.content || 'Không có nội dung'}</div>
                                    <div className="mt-1 text-xs text-neutral-400">{new Date(tx.createdAt).toLocaleString('vi-VN')}</div>
                                    {tx.note && <div className="mt-1 text-xs text-amber-600">{tx.note}</div>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="mr-2 font-semibold">{money(tx.amount)}</span>
                                    {canManageWallets && tx.status !== 'MATCHED' && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => reconcile(tx.id, 'MATCH')}
                                                disabled={!matchWalletId}
                                                className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                            >
                                                Gán ví
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => reconcile(tx.id, 'IGNORE')}
                                                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700"
                                            >
                                                Bỏ qua
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
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

function TransactionList({ transactions }: { transactions: WalletTransaction[] }) {
    return (
        <div className="space-y-2">
            {transactions.map((tx) => {
                const isCredit = tx.amount > 0
                return (
                    <div key={tx.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {tx.type}
                                </span>
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{tx.source}</span>
                                <span className="text-sm font-medium">{tx.wallet?.walletCode}</span>
                            </div>
                            <div className="mt-1 text-sm text-neutral-500">{tx.wallet?.user.name || tx.wallet?.user.email}</div>
                            {tx.description && <div className="mt-1 text-xs text-neutral-400">{tx.description}</div>}
                        </div>
                        <div className="text-right">
                            <div className={`text-lg font-bold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isCredit ? '+' : '-'}{money(Math.abs(tx.amount))}
                            </div>
                            <div className="text-xs text-neutral-400">{new Date(tx.createdAt).toLocaleString('vi-VN')}</div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
