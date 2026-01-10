import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Image from 'next/image'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { EyeIcon } from '@heroicons/react/24/outline'
import { HeaderNerd, FooterNerd } from '@/components/landing'
import Breadcrumb from '@/components/Breadcrumb'
import TableOfContents from '@/components/TableOfContents'

interface PageProps {
    params: Promise<{ slug: string }>
}

async function getPage(slug: string) {
    const post = await prisma.post.findUnique({
        where: {
            slug,
            status: 'PUBLISHED',
            type: 'PAGE', // Only fetch static pages
        },
        include: {
            author: { select: { name: true } },
        },
    })

    if (post) {
        // Increment view count
        await prisma.post.update({
            where: { id: post.id },
            data: { viewCount: { increment: 1 } },
        })
    }

    return post
}

async function getSettings() {
    try {
        const settings = await prisma.setting.findMany()
        return settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value
            return acc
        }, {} as Record<string, string>)
    } catch {
        return {}
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params
    const post = await prisma.post.findUnique({
        where: {
            slug,
            type: 'PAGE',
            status: 'PUBLISHED'
        },
        select: { title: true, excerpt: true, thumbnail: true },
    })

    if (!post) {
        return { title: 'Không tìm thấy trang' }
    }

    return {
        title: post.title,
        description: post.excerpt || undefined,
        openGraph: {
            title: post.title,
            description: post.excerpt || undefined,
            images: post.thumbnail ? [post.thumbnail] : undefined,
        },
    }
}

export default async function PageDetailPage({ params }: PageProps) {
    const { slug } = await params
    const post = await getPage(slug)

    if (!post) {
        notFound()
    }

    const settings = await getSettings()

    // Breadcrumb structured data for SEO
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Trang chủ',
                item: process.env.NEXT_PUBLIC_SITE_URL || 'https://nerdsociety.vn',
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: post.title,
            },
        ],
    }

    return (
        <>
            {/* Breadcrumb JSON-LD for SEO */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <HeaderNerd logoUrl={settings.siteLogo} logoLightUrl={settings.siteLogoLight} />
            <main className="pt-20">
                <article className="pb-16 lg:pb-24">
                    {/* Hero / Thumbnail (optional for Pages) */}
                    {post.thumbnail && (
                        <div className="relative h-[200px] md:h-[300px] lg:h-[400px] w-full">
                            <Image
                                src={post.thumbnail}
                                alt={post.title}
                                fill
                                className="object-cover"
                                priority
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                        </div>
                    )}

                    <div className="container">
                        {/* Breadcrumb */}
                        <div className="py-6">
                            <Breadcrumb
                                items={[
                                    { label: post.title },
                                ]}
                            />
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Main Content */}
                            <div className="flex-1 max-w-4xl mx-auto">
                                {/* Header */}
                                <header className="mb-8 text-center lg:text-left">
                                    <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white leading-tight">
                                        {post.title}
                                    </h1>

                                    {/* Meta (optional for pages, maybe just Updated At) */}
                                    <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                                        {post.updatedAt && (
                                            <span>
                                                Cập nhật: {format(new Date(post.updatedAt), 'dd/MM/yyyy', { locale: vi })}
                                            </span>
                                        )}
                                    </div>
                                </header>

                                {/* Content */}
                                <div
                                    id="post-content"
                                    className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary-600 dark:prose-a:text-primary-400"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />
                            </div>

                            {/* Sidebar - Table of Contents (Optional for pages with long content) */}
                            {post.content.includes('<h') && (
                                <aside className="hidden xl:block w-72 flex-shrink-0">
                                    <div className="sticky top-24">
                                        <TableOfContents contentSelector="#post-content" />
                                    </div>
                                </aside>
                            )}
                        </div>
                    </div>
                </article>
            </main>
            <FooterNerd logoUrl={settings.siteLogoLight || settings.siteLogo} />
        </>
    )
}
