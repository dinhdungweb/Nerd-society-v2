'use client'

import React, { FC } from 'react'
import {
  LockClosedIcon,
  IdentificationIcon,
  TicketIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Image from 'next/image'

const features = [
  {
    icon: LockClosedIcon,
    image: '/images/beaver-locker.png',
    title: 'Tủ riêng cho bạn',
    desc: 'Slot cố định gắn với tên bạn — 12 charter member đầu tiên tại HTM, 6 tại Tây Sơn',
  },
  {
    icon: IdentificationIcon,
    image: '/images/beaver-checkin.png',
    title: 'Tap thẻ, ngồi luôn',
    desc: 'Không cần đến quầy mỗi lần. Không thanh toán từng buổi. Nhân viên nhớ tên + góc quen',
  },
  {
    icon: TicketIcon,
    image: '/images/beaver-coffee.png',
    title: '4 voucher đồ uống/tháng',
    desc: 'Đồ uống cơ bản miễn phí, dùng bất kỳ lúc nào trong tháng',
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
            Quyền lợi
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            3 đặc quyền hội viên
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Không chỉ là chỗ ngồi — mà là quyền lợi của riêng bạn
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid gap-8 md:grid-cols-1">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group relative flex flex-col md:flex-row overflow-hidden rounded-3xl border border-neutral-200 bg-white transition-all hover:border-primary-200 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-primary-700 ${
                  index % 2 === 1 ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Image side */}
                <div className="relative h-64 w-full md:h-80 md:w-1/2">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>

                {/* Content side */}
                <div className="flex flex-1 flex-col justify-center p-8 lg:p-12">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                    <IconComponent className="size-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
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
