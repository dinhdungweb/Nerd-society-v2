'use client'

import React, { FC } from 'react'
import {
  CursorArrowRaysIcon,
  MapPinIcon,
  BoltIcon,
  UserGroupIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

const steps = [
  {
    title: 'Đăng ký online',
    desc: 'Điền form ngay tại trang này. Chuyển khoản 549k qua VietQR. Mất khoảng 2 phút.',
    icon: CursorArrowRaysIcon,
  },
  {
    title: 'Đến Nerd nhận thẻ',
    desc: 'Ghé cơ sở đã đăng ký để nhận thẻ ZKTeco, voucher đồ uống, chìa khóa locker.',
    icon: MapPinIcon,
  },
  {
    title: 'Tap thẻ kích hoạt',
    desc: 'Lần đầu tap = gói có hiệu lực. 30 ngày tính từ tap đầu, bạn chủ động chọn.',
    icon: BoltIcon,
  },
  {
    title: 'Mỗi lần đến',
    desc: 'Tap vào → ngồi. Tap ra khi về. Không xếp hàng, không thanh toán từng buổi.',
    icon: UserGroupIcon,
  },
  {
    title: 'Gia hạn cuối tháng',
    desc: 'Nerd nhắn Zalo trước 7 ngày. Gia hạn để giữ nguyên locker và quyền lợi.',
    icon: CalendarDaysIcon,
  },
]

const StepsSection: FC = () => {
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
            Cách dùng
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            Trở thành hội viên chỉ với 5 bước
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Quy trình đơn giản, nhanh gọn, chủ động
          </motion.p>
        </div>

        {/* Steps Grid */}
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, index) => {
            const IconComponent = step.icon
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative rounded-3xl border border-neutral-200 bg-white p-8 text-center transition-all hover:border-primary-200 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-primary-700"
              >
                {/* Step Number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-500 px-3 py-0.5 text-xs font-bold text-white">
                  {index + 1}
                </div>

                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
                  <IconComponent className="size-6 text-primary-600 dark:text-primary-400" />
                </div>

                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {step.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default StepsSection
