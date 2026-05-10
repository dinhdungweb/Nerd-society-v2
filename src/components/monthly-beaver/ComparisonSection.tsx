'use client'

import React, { FC } from 'react'
import { CheckIcon, MinusIcon } from '@heroicons/react/24/solid'
import { motion } from 'framer-motion'

const comparisonData = [
  { benefit: 'Wifi + ổ cắm', combo: true, beaver: true },
  { benefit: 'Nước tự pha', combo: true, beaver: true },
  { benefit: 'Mượn laptop stand', combo: true, beaver: true },
  { benefit: 'Locker', combo: 'Dùng chung', beaver: 'Tủ riêng cố định' },
  { benefit: 'Check-in', combo: 'Đến quầy, thanh toán', beaver: 'Tap thẻ, ngồi luôn' },
  { benefit: 'Voucher đồ uống', combo: false, beaver: '4 voucher/tháng' },
  { benefit: 'Nhân viên nhớ tên', combo: false, beaver: true },
]

const ComparisonSection: FC = () => {
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
            So sánh
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            Bạn được gì so với combo lẻ?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Cái khác biệt thật sự không nằm ở giá — mà ở việc bạn không phải nghĩ về nó nữa.
          </motion.p>
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-16 max-w-4xl overflow-x-auto rounded-3xl border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800/50"
        >
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-6 py-5 text-sm font-bold text-neutral-900 dark:text-white">Quyền lợi</th>
                <th className="px-6 py-5 text-sm font-medium text-neutral-500 dark:text-neutral-400">Combo lẻ</th>
                <th className="bg-primary-50 px-6 py-5 text-sm font-bold text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">Monthly Beaver 🦫</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700">
              {comparisonData.map((row, index) => (
                <tr key={index} className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="px-6 py-4 font-medium text-neutral-700 dark:text-neutral-300">{row.benefit}</td>
                  <td className="px-6 py-4 text-sm text-neutral-500 dark:text-neutral-400">
                    {typeof row.combo === 'boolean' ? (
                      row.combo ? <CheckIcon className="size-5 text-neutral-400" /> : <MinusIcon className="size-5 text-neutral-300" />
                    ) : (
                      row.combo
                    )}
                  </td>
                  <td className="bg-primary-50/50 px-6 py-4 text-sm font-semibold text-primary-600 dark:bg-primary-900/10 dark:text-primary-400">
                    {typeof row.beaver === 'boolean' ? (
                      row.beaver ? <CheckIcon className="size-5 text-primary-500" /> : <MinusIcon className="size-5 text-neutral-300" />
                    ) : (
                      row.beaver
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center text-sm text-neutral-500 dark:text-neutral-400"
        >
          Đến 4 lần/tuần trở lên, gói tháng tiết kiệm hơn mua Bee lẻ.
        </motion.p>
      </div>
    </section>
  )
}

export default ComparisonSection
