import { prisma } from '@/lib/prisma'

type WalletAccountErrorReason = 'USER_NOT_FOUND' | 'WALLET_LOCKED'

export type WalletAccountResult =
    | {
        success: true
        user: {
            id: string
            name: string | null
            email: string
            phone: string | null
        }
        wallet: {
            id: string
            walletCode: string
            balance: number
            status: string
        }
        subscriber: {
            id: string
            fullName: string
            phone: string
            email: string | null
            mytimeEmpId: string | null
            outstandingBalance: number
        } | null
    }
    | {
        success: false
        reason: WalletAccountErrorReason
        message: string
    }

function normalizeCodeSeed(seed: string) {
    const normalized = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return normalized.slice(-8).padStart(8, '0')
}

function buildWalletCode(seed: string, attempt: number) {
    const suffix = attempt === 0 ? '' : attempt.toString().padStart(2, '0')
    return `W${normalizeCodeSeed(seed)}${suffix}`
}

async function getAvailableWalletCode(seed: string, currentWalletId?: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const walletCode = buildWalletCode(seed, attempt)
        const existing = await prisma.wallet.findUnique({
            where: { walletCode },
            select: { id: true },
        })

        if (!existing || existing.id === currentWalletId) return walletCode
    }

    throw new Error('Không thể tạo mã ví duy nhất')
}

function walletSeed(user: {
    id: string
    email: string
    phone: string | null
    subscriber: { walletCode: string | null; phone: string } | null
}) {
    return user.subscriber?.walletCode || user.phone || user.subscriber?.phone || user.email || user.id
}

async function linkExistingSubscriberByPhone(user: {
    id: string
    email: string
    phone: string | null
    name: string | null
}) {
    if (!user.phone) return null

    const subscriber = await prisma.subscriber.findUnique({
        where: { phone: user.phone },
        select: {
            id: true,
            userId: true,
            fullName: true,
            phone: true,
            email: true,
            walletCode: true,
            walletBalance: true,
            mytimeEmpId: true,
            outstandingBalance: true,
        },
    })

    if (!subscriber || (subscriber.userId && subscriber.userId !== user.id)) return null
    if (subscriber.userId === user.id) return subscriber

    return prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
            userId: user.id,
            email: subscriber.email || user.email,
            fullName: subscriber.fullName || user.name || user.email,
        },
        select: {
            id: true,
            userId: true,
            fullName: true,
            phone: true,
            email: true,
            walletCode: true,
            walletBalance: true,
            mytimeEmpId: true,
            outstandingBalance: true,
        },
    })
}

export async function ensureUserWalletAccount(userId: string): Promise<WalletAccountResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            wallet: {
                select: {
                    id: true,
                    walletCode: true,
                    balance: true,
                    status: true,
                },
            },
            subscriber: {
                select: {
                    id: true,
                    fullName: true,
                    phone: true,
                    email: true,
                    walletCode: true,
                    walletBalance: true,
                    mytimeEmpId: true,
                    outstandingBalance: true,
                },
            },
        },
    })

    if (!user) {
        return {
            success: false,
            reason: 'USER_NOT_FOUND',
            message: 'Không tìm thấy tài khoản',
        }
    }

    let subscriber = user.subscriber
    if (!subscriber) {
        subscriber = await linkExistingSubscriberByPhone(user)
    }

    let wallet = user.wallet
    if (!wallet) {
        const preferredCode = subscriber?.walletCode || null
        const preferredWallet = preferredCode
            ? await prisma.wallet.findUnique({ where: { walletCode: preferredCode }, select: { id: true } })
            : null
        const walletCode = preferredCode && !preferredWallet
            ? preferredCode
            : await getAvailableWalletCode(walletSeed({ ...user, subscriber }))

        wallet = await prisma.wallet.create({
            data: {
                userId: user.id,
                walletCode,
                balance: subscriber?.walletBalance || 0,
            },
            select: {
                id: true,
                walletCode: true,
                balance: true,
                status: true,
            },
        })

        if (subscriber && subscriber.walletCode !== wallet.walletCode) {
            await prisma.subscriber.update({
                where: { id: subscriber.id },
                data: { walletCode: wallet.walletCode },
            })
        }
    }

    if (wallet.status !== 'ACTIVE') {
        return {
            success: false,
            reason: 'WALLET_LOCKED',
            message: 'Ví Nerd đang bị khóa',
        }
    }

    return {
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
        },
        wallet,
        subscriber: subscriber ? {
            id: subscriber.id,
            fullName: subscriber.fullName,
            phone: subscriber.phone,
            email: subscriber.email,
            mytimeEmpId: subscriber.mytimeEmpId,
            outstandingBalance: subscriber.outstandingBalance,
        } : null,
    }
}

export async function ensureWalletForSubscriber(subscriberId: string) {
    const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { userId: true },
    })

    if (!subscriber?.userId) return null
    const result = await ensureUserWalletAccount(subscriber.userId)
    return result.success ? result.wallet : null
}
