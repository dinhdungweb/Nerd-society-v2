import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
    BriefcaseIcon,
    MapPinIcon,
    ClockIcon,
    CheckCircleIcon,
    ArrowLeftIcon,
    SparklesIcon
} from '@heroicons/react/24/outline'
import ApplicationForm from './ApplicationForm'

async function getData(slug: string) {
    const job = await prisma.job.findUnique({
        where: { slug }
    })
    const setting = await prisma.setting.findUnique({
        where: { key: 'recruitmentHeroImage' }
    })
    return { job, heroImage: setting?.value }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const job = await prisma.job.findUnique({
        where: { slug },
        select: { title: true, description: true }
    })

    if (!job) {
        return {
            title: 'Không tìm thấy vị trí tuyển dụng',
        }
    }

    return {
        title: `${job.title} | Tuyển dụng Nerd Society`,
        description: job.description.substring(0, 160),
        openGraph: {
            title: job.title,
            description: job.description.substring(0, 160),
        },
    }
}

export default async function JobDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params
    const { job, heroImage } = await getData(slug)

    if (!job) {
        notFound()
    }

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
            {/* Header Gradient */}
            <div className="relative bg-neutral-900 pb-32 pt-32 lg:pt-40 overflow-hidden">
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

                {/* Default Background Pattern */}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute -left-40 -top-40 size-96 rounded-full bg-primary-500 blur-3xl" />
                    <div className="absolute right-0 top-0 size-96 rounded-full bg-amber-500 blur-3xl opacity-50" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
                </div>

                <div className="container mx-auto relative z-10">
                    <Link
                        href="/tuyen-dung"
                        className="mb-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-white/20 hover:text-white backdrop-blur-sm"
                    >
                        <ArrowLeftIcon className="size-4" />
                        Quay lại danh sách
                    </Link>

                    <h1 className="mb-6 text-3xl font-bold text-white md:text-5xl">
                        {job.title}
                    </h1>

                    <div className="flex flex-wrap gap-4">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white backdrop-blur-md">
                            <MapPinIcon className="size-5 text-primary-400" />
                            <span>{job.location}</span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white backdrop-blur-md">
                            <ClockIcon className="size-5 text-primary-400" />
                            <span>{job.workShift}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto -mt-20 relative z-20 pb-24">
                <div className="grid gap-8 lg:grid-cols-12">
                    {/* Job Details - Left Column */}
                    <div className="lg:col-span-8">
                        <div className="space-y-6">
                            {/* Description Card */}
                            <div className="rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="rounded-xl bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                        <BriefcaseIcon className="size-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Mô tả công việc</h2>
                                </div>
                                <div className="prose prose-neutral max-w-none dark:prose-invert text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                                    {job.description}
                                </div>
                            </div>

                            {/* Requirements Card */}
                            <div className="rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="rounded-xl bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                        <CheckCircleIcon className="size-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Yêu cầu</h2>
                                </div>
                                <div className="prose prose-neutral max-w-none dark:prose-invert text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                                    {job.requirements}
                                </div>
                            </div>

                            {/* Benefits Card */}
                            <div className="rounded-3xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-900">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="rounded-xl bg-primary-100 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                                        <SparklesIcon className="size-6" />
                                    </div>
                                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Quyền lợi</h2>
                                </div>
                                <div className="prose prose-neutral max-w-none dark:prose-invert text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                                    {job.benefits}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Application Form - Right Column */}
                    <div className="lg:col-span-4">
                        <ApplicationForm jobId={job.id} />
                    </div>
                </div>
            </div>
        </div>
    )
}
