import {
  AboutNerd,
  ComboSection,
  ContactNerd,
  FooterNerd,
  GallerySection,
  HeaderNerd,
  HeroNerd,
  LocationsNerd,
  NewsSection,
} from '@/components/landing'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nerd Society | Không gian học tập dành cho Gen Z',
  description:
    'Nerd Society: Cộng đồng học tập Gen Z năng động tại Hà Nội. Không gian làm việc chung, học nhóm lý tưởng, tổ chức sự kiện, workshop chuyên sâu. Kết nối, phát triển bản thân và chinh phục kiến thức cùng Nerd Society!',
  keywords: ['Nerd Society', 'cafe học tập', 'co-working space', 'Hà Nội', 'Gen Z', 'không gian làm việc'],
}

import { prisma } from '@/lib/prisma'

async function getSettings() {
  try {
    const settings = await prisma.setting.findMany()
    return settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value
      return acc
    }, {} as Record<string, string>)
  } catch (error) {
    return {}
  }
}

export default async function Page() {
  const settings = await getSettings()

  return (
    <>
      <HeaderNerd />
      <main className="pt-20">
        <HeroNerd
          heroTitle={settings.heroTitle}
          heroSubtitle={settings.heroSubtitle}
          heroCta={settings.heroCta}
          heroBackgroundImage={settings.heroBackgroundImage}
        />
        <AboutNerd
          aboutTitle={settings.aboutTitle}
          aboutContent={settings.aboutContent}
        />
        <GallerySection />
        <ComboSection />
        <LocationsNerd />
        <NewsSection />
        <ContactNerd />
      </main>
      <FooterNerd />
    </>
  )
}
