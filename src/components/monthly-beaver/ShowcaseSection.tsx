'use client'

import React, { FC } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'

const ShowcaseSection: FC = () => {
  const images = [
    {
      src: '/images/beaver-space.png',
      alt: 'Coworking Space',
      title: 'Không gian cảm hứng',
      subtitle: 'Ánh sáng tự nhiên, bàn gỗ ấm cúng',
      className: 'col-span-2 row-span-2'
    },
    {
      src: '/images/beaver-coffee.png',
      alt: 'Coffee Bar',
      title: 'Nerd Drinks',
      subtitle: 'Barista phục vụ tận tâm',
      className: 'col-span-1 row-span-1'
    },
    {
      src: '/images/beaver-checkin.png',
      alt: 'Card Check-in',
      title: 'Tap & Go',
      subtitle: 'Check-in trong 1 giây',
      className: 'col-span-1 row-span-1'
    }
  ]

  return (
    <section className="bg-neutral-50 py-20 lg:py-28 dark:bg-neutral-900/50">
      <div className="container">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block rounded-full bg-primary-100 px-4 py-2 text-sm font-medium text-primary-700 dark:bg-primary-900/50 dark:text-primary-300"
          >
            Showcase
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-3xl font-bold text-neutral-900 sm:text-4xl dark:text-white"
          >
            Tận hưởng không gian làm việc chuyên nghiệp
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-lg text-neutral-600 dark:text-neutral-300"
          >
            Được thiết kế để bạn tập trung tối đa và sáng tạo không giới hạn.
          </motion.p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 h-[600px]">
          {images.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-3xl group ${image.className}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/80 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
              
              <div className="absolute bottom-0 left-0 p-6 w-full">
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl">
                  <h3 className="text-xl font-bold text-white">{image.title}</h3>
                  <p className="text-sm text-neutral-200 mt-1">{image.subtitle}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ShowcaseSection
