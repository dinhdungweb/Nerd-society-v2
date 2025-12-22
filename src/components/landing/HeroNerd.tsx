'use client'

import { Button } from '@/shared/Button'
import {
  AcademicCapIcon,
  BookOpenIcon,
  ClockIcon,
  RocketLaunchIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Image from 'next/image'

// Coffee cup icon
const CoffeeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h15a3 3 0 013 3v1a3 3 0 01-3 3h-1.5M3 8v8a4 4 0 004 4h5a4 4 0 004-4v-3M3 8l1-4h13l1 4M7.5 8v1.5m4-1.5v1.5" />
  </svg>
)

// Icon mapping for dynamic features
const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  WifiIcon,
  CoffeeIcon,
  ClockIcon,
  BoltIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  SparklesIcon: (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  ),
}

// Default features pills
const defaultFeatures = [
  { icon: 'WifiIcon', text: 'Wifi siêu tốc' },
  { icon: 'CoffeeIcon', text: 'Cafe miễn phí' },
  { icon: 'ClockIcon', text: '24/7' },
]

// Default stats
const defaultStats = [
  { value: '2', label: 'Cơ sở' },
  { value: '24/7', label: 'Hoạt động' },
  { value: '∞', label: 'Cafe miễn phí' },
]

// Feature pill interface
export interface HeroFeaturePill {
  icon: string
  text: string
}

// Stat interface
export interface HeroStat {
  value: string
  label: string
}

interface HeroNerdProps {
  heroTitle?: string
  heroSubtitle?: string
  heroCta?: string
  heroCtaSecondary?: string
  heroBadge?: string
  heroBackgroundImage?: string
  heroFeatures?: HeroFeaturePill[]
  heroStats?: HeroStat[]
}

const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?q=80&w=2070'

export default function HeroNerd({
  heroTitle = 'Nerd Society',
  heroSubtitle = 'Cộng đồng học tập năng động tại Hà Nội. Không gian làm việc chung, học nhóm lý tưởng với đầy đủ tiện nghi và đồ uống miễn phí!',
  heroCta = 'Đặt lịch ngay',
  heroCtaSecondary = 'Xem các combo',
  heroBadge = 'Không gian học tập dành cho Gen Z',
  heroBackgroundImage,
  heroFeatures,
  heroStats,
}: HeroNerdProps) {
  const backgroundSrc = heroBackgroundImage || DEFAULT_HERO_IMAGE
  const features = heroFeatures && heroFeatures.length > 0 ? heroFeatures : defaultFeatures
  const stats = heroStats && heroStats.length > 0 ? heroStats : defaultStats

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={backgroundSrc}
          alt="Nerd Society Space"
          fill
          className="object-cover"
          priority
        />
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/70 to-neutral-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-transparent to-transparent" />
      </div>

      <div className="container relative z-10 flex min-h-screen items-center pb-24 pt-20 md:pb-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-8">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col justify-center"
          >
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-500/20 px-4 py-2 text-sm font-medium text-primary-300 backdrop-blur-sm"
            >
              <AcademicCapIcon className="size-4" />
              {heroBadge}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl"
            >
              <span dangerouslySetInnerHTML={{ __html: heroTitle.replace('Society', '<span class="text-primary-400">Society</span>') }} />
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 max-w-lg text-lg text-neutral-300 sm:text-xl"
            >
              {heroSubtitle}
            </motion.p>

            {/* Features */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              {features.map((feature, i) => {
                const IconComponent = iconMap[feature.icon] || WifiIcon
                return (
                  <div
                    key={feature.text + i}
                    className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm"
                  >
                    <IconComponent className="size-4 text-primary-400" />
                    {feature.text}
                  </div>
                )
              })}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row"
            >
              <Button
                color="primary"
                href="/booking"
                className="px-8 py-3.5 text-base shadow-lg shadow-primary-500/30"
              >
                <RocketLaunchIcon className="size-5" />
                {heroCta}
              </Button>
              <Button
                outline
                href="#combos"
                className="border-white/30 px-8 py-3.5 text-base text-white hover:bg-white/10"
              >
                {heroCtaSecondary}
              </Button>
            </motion.div>


            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-12 flex gap-8 border-t border-white/10 pt-8"
            >
              {stats.map((stat, i) => (
                <div key={stat.label + i}>
                  <div className="text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-sm text-neutral-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right side - floating cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:flex lg:items-center lg:justify-center"
          >
            {/* Floating card 1 - Updated position */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute left-10 top-[20%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white">
                  <CoffeeIcon className="size-6" />
                </div>
                <div>
                  <p className="font-semibold text-white">Cafe miễn phí</p>
                  <p className="text-sm text-neutral-300">Không giới hạn</p>
                </div>
              </div>
            </motion.div>

            {/* Floating card 2 - Updated position */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="absolute right-0 top-[45%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white">
                  <WifiIcon className="size-6" />
                </div>
                <div>
                  <p className="font-semibold text-white">Wifi siêu tốc</p>
                  <p className="text-sm text-neutral-300">100Mbps+</p>
                </div>
              </div>
            </motion.div>

            {/* Floating card 3 - Updated position */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="absolute bottom-[15%] left-[20%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white">
                  <BookOpenIcon className="size-6" />
                </div>
                <div>
                  <p className="font-semibold text-white">Học tập hiệu quả</p>
                  <p className="text-sm text-neutral-300">Không gian yên tĩnh</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator - hidden on mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 md:block"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-neutral-400">Cuộn xuống</span>
          <div className="flex h-10 w-6 justify-center rounded-full border-2 border-white/30 p-1">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="h-2 w-1 rounded-full bg-white/70"
            />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
