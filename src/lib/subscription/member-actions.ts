'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
// Note: need to check where authOptions is defined. Usually src/lib/auth.ts or root of [...nextauth]
import { authOptions } from '@/lib/auth'; 

export async function getMemberData() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            subscriber: {
                include: {
                    subscriptions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    },
                    sessions: {
                        orderBy: { checkInTime: 'desc' },
                        take: 10
                    },
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 10
                    }
                }
            }
        }
    });

    return user?.subscriber || null;
}

export async function getTopupConfig() {
    const { getVietQRConfig } = await import('@/lib/vietqr');
    return getVietQRConfig();
}
