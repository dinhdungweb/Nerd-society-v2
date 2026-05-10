'use client'

import React, { FC, useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { motion, AnimatePresence } from 'framer-motion'

const faqs = [
  {
    q: 'Đến mỗi ngày được không?',
    a: 'Được luôn. Max 8 giờ/ngày. Nhiều bạn đến 4–5 lần/tuần, tính ra chỉ ~5–6k/giờ. Vượt 8h thì tính 15k/h cho phần thừa.',
  },
  {
    q: 'Tôi chỉ đến 2 lần/tuần, có nên mua gói?',
    a: 'Thật thà thì không. Mua Bee lẻ (39k) hợp hơn. Gói tháng dành cho ai đến từ 4 lần/tuần trở lên — khi đó bạn vừa tiết kiệm vừa được benefit. Đến nhiều hơn thì nghĩ lại nha.',
  },
  {
    q: 'Locker hết slot thì sao?',
    a: 'HTM 12 slot, TS 6 slot — đăng ký sớm để giữ tủ riêng. Nếu hết slot, bạn vào waitlist nhưng vẫn nhận đầy đủ benefit khác (tap thẻ, voucher, giảm pod/MR). Nerd báo ngay khi mở thêm tủ.',
  },
  {
    q: 'Mua xong mà chưa kịp đến nhận thẻ?',
    a: '30 ngày kể từ ngày mua, gói tự động convert thành credit 549k giữ trong 90 ngày. Bạn dùng credit này cho lần đăng ký sau hoặc các sản phẩm khác tại Nerd. Không mất tiền.',
  },
  {
    q: 'Refund được không?',
    a: 'Chưa kích hoạt + trong 7 ngày từ ngày mua → refund 100%. Chưa kích hoạt + sau 7 ngày → convert thành credit giữ 90 ngày. Đã kích hoạt (tap thẻ lần đầu) → không refund.',
  },
  {
    q: 'Mất thẻ thì sao?',
    a: 'Báo quầy bất kỳ lúc nào, Nerd cấp thẻ mới (50k). Thẻ cũ tự deactivate, không ai dùng được nữa.',
  },
  {
    q: 'Tôi đăng ký HTM nhưng đôi khi muốn qua TS?',
    a: 'Hoàn toàn được. Gói valid cả 2 cơ sở. Cap 8h/ngày dùng chung — VD 4h sáng HTM + 4h chiều TS = đầy cap.',
  },
  {
    q: 'Vì sao cần ảnh selfie?',
    a: 'Thẻ chỉ dùng cho riêng bạn. Ảnh giúp nhân viên nhận ra bạn khi đến quán. Ảnh lưu nội bộ, không chia sẻ.',
  },
  {
    q: 'Có gia hạn tự động không?',
    a: 'Không. Trước hết hạn 7 ngày Nerd nhắn Zalo. Bạn chủ động quyết. Không gia hạn cũng OK — locker giữ thêm 7 ngày để lấy đồ.',
  },
]

function FAQItem({ faq, index }: { faq: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-3xl border bg-white transition-all dark:bg-neutral-800/50 ${
        open
          ? 'border-primary-200 dark:border-primary-700'
          : 'border-neutral-200 dark:border-neutral-700'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="pr-4 text-base font-semibold text-neutral-900 dark:text-white">
          {faq.q}
        </span>
        <ChevronDownIcon
          className={`size-5 shrink-0 text-neutral-500 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-5 text-neutral-600 dark:text-neutral-400">
              {faq.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const FAQSection: FC = () => {
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
            FAQ
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            Những câu hay được hỏi
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Mọi thứ bạn cần biết về gói Monthly Beaver
          </motion.p>
        </div>

        {/* FAQ List */}
        <div className="mx-auto mt-16 max-w-3xl space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem key={index} faq={faq} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQSection
