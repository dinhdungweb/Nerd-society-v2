import { prisma } from '@/lib/prisma'
import FeedbackForm from './FeedbackForm'
import { ChatBubbleBottomCenterTextIcon, EnvelopeIcon, MapPinIcon, PhoneIcon, LightBulbIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'

async function getHeroImage() {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'feedbackHeroImage' }
        })
        return setting?.value
    } catch (error) {
        return null
    }
}

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Góp ý | Nerd Society - Chúng tôi lắng nghe bạn',
    description: 'Chia sẻ góp ý, đề xuất hoặc phản hồi của bạn để Nerd Society ngày càng hoàn thiện hơn.',
}

export default async function GopYPage() {
    const heroImage = await getHeroImage()

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-neutral-900 pb-24 pt-32 lg:pb-32 lg:pt-40">
                {/* Background Image if available */}
                {heroImage && (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={heroImage}
                            alt="Feedback Hero"
                            fill
                            className="object-cover"
                            priority
                        />
                        {/* Overlay để text dễ đọc */}
                        <div className="absolute inset-0 bg-neutral-900/80" />
                    </div>
                )}

                {/* Background Pattern */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute -left-40 -top-40 size-96 rounded-full bg-primary-500 blur-3xl" />
                    <div className="absolute bottom-0 right-0 size-96 rounded-full bg-primary-400 blur-3xl opacity-50" />
                </div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-300 backdrop-blur-sm">
                            <ChatBubbleBottomCenterTextIcon className="size-4" />
                            Hòm thư góp ý
                        </div>
                        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                            Chúng tôi <span className="text-primary-400">lắng nghe</span> bạn
                        </h1>
                        <p className="mx-auto max-w-2xl text-lg text-neutral-400">
                            Mọi góp ý của bạn đều quý giá với chúng tôi. Hãy chia sẻ để Nerd Society ngày càng hoàn thiện hơn.
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto -mt-16 pb-24 relative z-20">
                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Form Section */}
                    <div className="lg:col-span-2">
                        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900 sm:p-8">
                            <h2 className="mb-6 text-xl font-bold text-neutral-900 dark:text-white">
                                Gửi góp ý cho chúng tôi
                            </h2>
                            <FeedbackForm />
                        </div>
                    </div>

                    {/* Contact Info Sidebar */}
                    <div className="space-y-6">
                        <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                            <h3 className="mb-4 font-semibold text-neutral-900 dark:text-white">
                                Thông tin liên hệ
                            </h3>
                            <div className="space-y-4 text-sm">
                                <a href="https://maps.app.goo.gl/RVeYRTPuWTuiTymq9" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                                    <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary-500" />
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-500">Cơ sở Tây Sơn</p>
                                        <p className="text-neutral-600 dark:text-neutral-400">Tầng 2, 3 ngõ 167 Tây Sơn</p>
                                    </div>
                                </a>
                                <a href="https://maps.app.goo.gl/1hdXj2VDtcScxGKm9" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                                    <MapPinIcon className="mt-0.5 size-5 shrink-0 text-primary-500" />
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-500">Cơ sở Hồ Tùng Mậu</p>
                                        <p className="text-neutral-600 dark:text-neutral-400">Tập thể trường múa, Khu Văn hóa & Nghệ Thuật</p>
                                    </div>
                                </a>
                                <a href="tel:0368483689" className="flex items-start gap-3 group">
                                    <PhoneIcon className="mt-0.5 size-5 shrink-0 text-primary-500" />
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-500">Hotline</p>
                                        <p className="text-neutral-600 dark:text-neutral-400">036 848 3689</p>
                                    </div>
                                </a>
                                <a href="mailto:nerd.society98@gmail.com" className="flex items-start gap-3 group">
                                    <EnvelopeIcon className="mt-0.5 size-5 shrink-0 text-primary-500" />
                                    <div>
                                        <p className="font-medium text-neutral-900 dark:text-white group-hover:text-primary-500">Email</p>
                                        <p className="text-neutral-600 dark:text-neutral-400">nerd.society98@gmail.com</p>
                                    </div>
                                </a>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-900/50 dark:bg-primary-900/20">
                            <h3 className="mb-2 flex items-center gap-2 font-semibold text-primary-900 dark:text-primary-300">
                                <LightBulbIcon className="size-5" /> Mẹo gửi góp ý hiệu quả
                            </h3>
                            <ul className="space-y-2 text-sm text-primary-800 dark:text-primary-200/80">
                                <li>• Mô tả chi tiết vấn đề bạn gặp phải</li>
                                <li>• Nêu rõ thời gian, địa điểm (nếu có)</li>
                                <li>• Đề xuất giải pháp nếu có thể</li>
                                <li>• Để lại liên hệ để nhận phản hồi</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
