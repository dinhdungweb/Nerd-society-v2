'use client'

import React, { FC } from 'react'
import {
  LockClosedIcon,
  IdentificationIcon,
  TicketIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

const features = [
  {
    icon: LockClosedIcon,
    title: 'Tủ riêng cho bạn',
    desc: 'Slot cố định gắn với tên bạn — 12 charter member đầu tiên tại HTM, 6 tại Tây Sơn',
  },
  {
    icon: IdentificationIcon,
    title: 'Tap thẻ, ngồi luôn',
    desc: 'Không cần đến quầy mỗi lần. Không thanh toán từng buổi. Nhân viên nhớ tên + góc quen',
  },
  {
    icon: TicketIcon,
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
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group rounded-3xl border border-neutral-200 bg-white p-8 transition-all hover:border-primary-200 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-primary-700"
              >
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                  <IconComponent className="size-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  {feature.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
