'use client'

import React, { FC } from 'react'
import {
  LockClosedIcon,
  BoltIcon,
  TicketIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Image from 'next/image'

const features = [
  {
    icon: BoltIcon,
    image: '/images/beaver-checkin.png',
    title: 'Priority Check-in',
    desc: 'Không xếp hàng, không thanh toán lẻ. Tap thẻ ZKTeco vào thẳng chỗ ngồi trong 1 giây.',
  },
  {
    icon: BriefcaseIcon,
    image: '/images/beaver-space.png',
    title: 'Inspiration Space',
    desc: 'Làm việc tại 2 cơ sở (HTM & Tây Sơn). Không gian yên tĩnh, chuyên nghiệp cho sự tập trung.',
  },
  {
    icon: TicketIcon,
    image: '/images/beaver-coffee.png',
    title: 'Nerd Drinks',
    desc: '4 voucher đồ uống mỗi tháng. Barista phục vụ cà phê specialty giúp bạn luôn tỉnh táo.',
  },
  {
    icon: LockClosedIcon,
    image: '/images/beaver-locker.png',
    title: 'The Essentials',
    desc: 'Wifi tốc độ cao, Locker riêng an toàn, hỗ trợ 24/7 và quyền lợi giảm giá 20% các dịch vụ khác.',
  },
]

const FeaturesSection: FC = () => {
  return (
    <section className="bg-white py-20 lg:py-28 dark:bg-neutral-900">
      <div className="container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
          >
            Đặc quyền
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            4 đặc quyền hội viên Monthly Beaver
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Nerd Society không chỉ cung cấp chỗ ngồi, chúng tôi cung cấp một môi trường làm việc tối ưu nhất.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-2">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative flex flex-col md:flex-row overflow-hidden rounded-3xl border border-neutral-200 bg-white transition-all hover:border-primary-200 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-primary-700"
              >
                {/* Image side */}
                <div className="relative h-48 w-full md:h-auto md:w-2/5">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Content side */}
                <div className="flex flex-1 flex-col p-8">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                    <IconComponent className="size-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
