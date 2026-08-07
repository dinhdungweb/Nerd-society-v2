import HeaderNerd from '@/components/landing/HeaderNerd'
import { prisma } from '@/lib/prisma'
import { Be_Vietnam_Pro, Fraunces, IBM_Plex_Mono, Pangolin } from 'next/font/google'
import './nerd-night.css'

const serif = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-nn-serif',
})
const body = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nn-body',
})
const hand = Pangolin({
  subsets: ['latin', 'vietnamese'],
  weight: '400',
  variable: '--font-nn-hand',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  variable: '--font-nn-mono',
})

async function getSiteSettings() {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['siteLogo', 'siteLogoLight'] } },
    })
    return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  } catch {
    return {} as Record<string, string>
  }
}

export default async function NerdNightLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()

  return (
    <>
      <HeaderNerd logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} transparent={false} />
      <div className={`${serif.variable} ${body.variable} ${hand.variable} ${mono.variable} nn-page pt-20`}>
        {children}
      </div>
    </>
  )
}
