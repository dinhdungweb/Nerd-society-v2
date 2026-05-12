'use client'

import React, { FC } from 'react'
import { Button } from '@/shared/Button'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Image from 'next/image'

interface HeroSectionProps {
  onRegisterClick: () => void
}

const HeroSection: FC<HeroSectionProps> = ({ onRegisterClick }) => {
  return (
    <section className="relative min-h-[85vh] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src="/hero-banner-beaver.JPG"
          alt="Nerd Society Space"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/70 to-neutral-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-transparent to-transparent" />
      </div>

      <div className="container relative z-10 flex min-h-[85vh] items-center pb-20 pt-32 lg:pt-40">
        <div className="grid w-full gap-12 lg:grid-cols-2 lg:gap-8">
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
              🦫 Monthly Beaver
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              Đến thoải mái.
              <br />
              <span className="text-primary-400">Chỗ luôn của bạn.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 max-w-lg text-lg text-neutral-300"
            >
              Gói thành viên cho những ai xem Nerd như không gian thứ hai. Tủ riêng cố định, tap thẻ vào ngồi luôn, voucher đồ uống mỗi tháng và đặc quyền ưu tiên.
            </motion.p>

            {/* Price pills */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
                <span className="text-2xl font-bold">549.000đ</span>
                <span className="text-neutral-400">/ tháng</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
                2 cơ sở · Max 8h/ngày
              </div>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-10 flex flex-col gap-4 sm:flex-row"
            >
              <Button
                color="primary"
                onClick={onRegisterClick}
                className="px-8 py-3.5 text-base"
              >
                <ArrowRightIcon className="size-5" />
                Đăng ký ngay
              </Button>
            </motion.div>

            {/* Scarcity */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-4 text-sm text-neutral-400"
            >
              ✨ 12 charter slot tại HTM · 6 charter slot tại Tây Sơn
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-12 flex gap-8 border-t border-white/10 pt-8"
            >
              <div>
                <div className="text-3xl font-bold text-white">549k</div>
                <div className="text-sm text-neutral-400">/ tháng</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">8h</div>
                <div className="text-sm text-neutral-400">/ ngày</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">2</div>
                <div className="text-sm text-neutral-400">Cơ sở</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right side - floating cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative hidden lg:flex lg:items-center lg:justify-center"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute left-10 top-[20%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white text-2xl">
                  🦫
                </div>
                <div>
                  <p className="font-semibold text-white">Tủ riêng cố định</p>
                  <p className="text-sm text-neutral-300">Gắn tên bạn</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="absolute right-0 top-[45%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white text-2xl">
                  🪪
                </div>
                <div>
                  <p className="font-semibold text-white">Tap thẻ, ngồi luôn</p>
                  <p className="text-sm text-neutral-300">Không chờ đợi</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="absolute bottom-[15%] left-[20%] rounded-2xl bg-white/10 p-5 backdrop-blur-md transition-transform hover:scale-105"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary-500 text-white text-2xl">
                  ☕
                </div>
                <div>
                  <p className="font-semibold text-white">4 voucher/tháng</p>
                  <p className="text-sm text-neutral-300">Đồ uống miễn phí</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
