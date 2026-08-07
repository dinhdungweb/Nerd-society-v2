import FooterNerd from '@/components/landing/FooterNerd'
import { prisma } from '@/lib/prisma'

export default async function NerdNightSiteFooter() {
  let logoUrl: string | undefined

  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['siteLogo', 'siteLogoLight'] } },
      select: { key: true, value: true },
    })
    const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
    logoUrl = values.siteLogoLight || values.siteLogo
  } catch {
    logoUrl = undefined
  }

  return <FooterNerd logoUrl={logoUrl} />
}
