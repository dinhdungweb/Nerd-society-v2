import { prisma } from '@/lib/prisma'
import JobsList from './JobsList'
import Image from 'next/image'

async function getSettings() {
    try {
        const setting = await prisma.setting.findUnique({
            where: { key: 'recruitmentHeroImage' }
        })
        return setting?.value
    } catch (error) {
        return null
    }
}

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Tuyển dụng | Nerd Society - Gia nhập đội ngũ của chúng tôi',
    description: 'Khám phá cơ hội nghề nghiệp tại Nerd Society. Môi trường làm việc năng động, sáng tạo và nhiều đãi ngộ hấp dẫn.',
}

export default async function TuyenDungPage() {
    const heroImage = await getSettings()

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
            {/* Modern Hero Section */}
            <div className="relative overflow-hidden bg-neutral-900 pb-24 pt-32 lg:pb-32 lg:pt-48">
                {/* Background Image if available */}
                {heroImage && (
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={heroImage}
                            alt="Recruitment Hero"
                            fill
                            className="object-cover"
                            priority
                        />
                        {/* Overlay để text dễ đọc */}
                        <div className="absolute inset-0 bg-neutral-900/80" />
                    </div>
                )}

                {/* Default Background Pattern - Overlay lên ảnh để giữ hiệu ứng, hoặc fallback */}
                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                    <div className="absolute -left-40 -top-40 size-96 rounded-full bg-primary-500 blur-3xl" />
                    <div className="absolute bottom-0 right-0 size-96 rounded-full bg-amber-500 blur-3xl opacity-50" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                </div>

                <div className="container mx-auto relative z-10">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-300 backdrop-blur-sm">
                            <span className="flex size-2 rounded-full bg-primary-400 animate-pulse" />
                            We are hiring!
                        </div>
                        <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
                            Gia nhập đội ngũ <br />
                            <span className="text-primary-400">
                                Nerd Society
                            </span>
                        </h1>
                        <p className="mx-auto max-w-2xl text-lg text-neutral-400 sm:text-xl relative z-10">
                            Không gian làm việc năng động, cơ hội phát triển bản thân và làm việc cùng những người trẻ đầy nhiệt huyết.
                        </p>
                    </div>
                </div>
            </div>

            <JobsList />
        </div>
    )
}
