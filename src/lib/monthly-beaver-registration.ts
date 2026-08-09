import { prisma } from '@/lib/prisma'

export const MONTHLY_BEAVER_REGISTRATION_SETTING = 'monthlyBeaverRegistrationOpen'

/**
 * New Monthly Beaver registrations are closed by default while the program is paused.
 * Admins can reopen them from General Settings without another deployment.
 */
export async function isMonthlyBeaverRegistrationOpen() {
  const setting = await prisma.setting.findUnique({
    where: { key: MONTHLY_BEAVER_REGISTRATION_SETTING },
    select: { value: true },
  })

  return setting?.value === 'true'
}
