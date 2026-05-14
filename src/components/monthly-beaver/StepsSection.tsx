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
import Image from 'next/image'

const steps = [
  {
    title: 'Đăng ký online',
    desc: 'Điền form ngay tại trang này. Chuyển khoản 549k qua VietQR. Mất khoảng 2 phút.',
    icon: CursorArrowRaysIcon,
    image: '/images/step-1.png'
  },
  {
    title: 'Đến Nerd nhận thẻ',
    desc: 'Ghé cơ sở đã đăng ký để nhận thẻ ZKTeco, voucher đồ uống, chìa khóa locker.',
    icon: MapPinIcon,
    image: '/images/step-2.png'
  },
  {
    title: 'Tap thẻ kích hoạt',
    desc: 'Lần đầu tap = gói có hiệu lực. 30 ngày tính từ tap đầu, bạn chủ động chọn.',
    icon: BoltIcon,
    image: '/images/beaver-checkin.png'
  },
  {
    title: 'Mỗi lần đến',
    desc: 'Tap vào → ngồi. Tap ra khi về. Không xếp hàng, không thanh toán từng buổi.',
    icon: UserGroupIcon,
    image: '/images/beaver-checkin.png'
  },
  {
    title: 'Gia hạn cuối tháng',
    desc: 'Nerd nhắn Zalo trước 7 ngày. Gia hạn để giữ nguyên locker và quyền lợi.',
    icon: CalendarDaysIcon,
    image: '/images/step-5.png'
  },
]

const StepsSection: FC = () => {
  return (
    <section className="bg-neutral-50 py-20 lg:py-28 dark:bg-neutral-800/50">
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

        {/* Steps Timeline */}
        <div className="mt-20 relative">
          {/* Vertical line for desktop */}
          <div className="absolute left-1/2 top-0 hidden h-full w-0.5 -translate-x-1/2 bg-neutral-200 dark:bg-neutral-700 lg:block" />

          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, index) => {
              const IconComponent = step.icon
              const isEven = index % 2 === 0

              return (
                <div key={step.title} className="relative flex flex-col lg:flex-row items-center">
                  {/* Content side */}
                  <motion.div
                    initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className={`w-full lg:w-1/2 ${isEven ? 'lg:pr-20 text-right' : 'lg:pl-20 order-2'}`}
                  >
                    <div className={`flex flex-col ${isEven ? 'items-end' : 'items-start'}`}>
                      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/20">
                        <IconComponent className="size-6" />
                      </div>
                      <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                        {index + 1}. {step.title}
                      </h3>
                      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>

                  {/* Circle indicator on line */}
                  <div className="absolute left-1/2 top-0 hidden -translate-x-1/2 rounded-full border-4 border-white bg-primary-500 p-1 dark:border-neutral-900 lg:block">
                    <div className="size-3 rounded-full bg-white" />
                  </div>

                  {/* Image side */}
                  <motion.div
                    initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className={`mt-8 w-full lg:mt-0 lg:w-1/2 ${isEven ? 'order-2 lg:pl-20' : 'lg:pr-20'}`}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-3xl shadow-xl">
                      <Image
                        src={step.image}
                        alt={step.title}
                        fill
                        className="object-cover transition-transform duration-500 hover:scale-105"
                      />
                    </div>
                  </motion.div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default StepsSection
