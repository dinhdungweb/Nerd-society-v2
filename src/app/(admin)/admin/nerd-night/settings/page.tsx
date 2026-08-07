import NerdNightPaymentSettings from '@/components/nerd-night/admin/NerdNightPaymentSettings'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function NerdNightSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/admin/nerd-night?error=access_denied')
  const stored = await prisma.nerdNightPaymentConfig.findUnique({ where: { id: 'default' } })
  return <NerdNightPaymentSettings initial={{ bankCode: stored?.bankCode || process.env.VIETQR_BANK_CODE || '', accountNumber: stored?.accountNumber || process.env.VIETQR_ACCOUNT_NUMBER || '', accountName: stored?.accountName || process.env.VIETQR_ACCOUNT_NAME || '' }} />
}
