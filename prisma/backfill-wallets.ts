import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizeCodeSeed(seed: string) {
    const normalized = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return normalized.slice(-8).padStart(8, '0')
}

function buildWalletCode(seed: string, attempt: number) {
    const suffix = attempt === 0 ? '' : attempt.toString().padStart(2, '0')
    return `W${normalizeCodeSeed(seed)}${suffix}`
}

async function getAvailableWalletCode(seed: string, preferred?: string | null) {
    if (preferred) {
        const existing = await prisma.wallet.findUnique({ where: { walletCode: preferred } })
        if (!existing) return preferred
    }

    for (let attempt = 0; attempt < 100; attempt += 1) {
        const walletCode = buildWalletCode(seed, attempt)
        const existing = await prisma.wallet.findUnique({ where: { walletCode } })
        if (!existing) return walletCode
    }

    throw new Error(`Cannot create a unique wallet code for ${seed}`)
}

async function main() {
    const users = await prisma.user.findMany({
        include: {
            wallet: true,
            subscriber: true,
        },
        orderBy: { createdAt: 'asc' },
    })

    let created = 0
    let skipped = 0

    for (const user of users) {
        if (user.wallet) {
            skipped += 1
            continue
        }

        const seed = user.subscriber?.walletCode || user.phone || user.email || user.id
        const walletCode = await getAvailableWalletCode(seed, user.subscriber?.walletCode)
        const balance = user.subscriber?.walletBalance || 0

        await prisma.wallet.create({
            data: {
                userId: user.id,
                walletCode,
                balance,
            },
        })

        if (user.subscriber && user.subscriber.walletCode !== walletCode) {
            await prisma.subscriber.update({
                where: { id: user.subscriber.id },
                data: { walletCode },
            })
        }

        created += 1
    }

    console.log(`[backfill-wallets] created=${created} skipped=${skipped}`)
}

main()
    .catch((error) => {
        console.error('[backfill-wallets] failed:', error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
