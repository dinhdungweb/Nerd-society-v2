'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { CalendarDaysIcon, MapPinIcon, ClockIcon, ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/shared/Badge'

interface Post {
    id: string
    title: string
    slug: string
    type: 'NEWS' | 'EVENT'
    excerpt: string | null
    thumbnail: string | null
    images: string[]
    publishedAt: string | null
    eventDate: string | null
    eventTime: string | null
    eventLocation: string | null
    featured: boolean
    author: { name: string }
}

interface CarouselSettings {
    newsTitle?: string
    newsSubtitle?: string
    newsLimit?: string
    newsAutoplay?: string
    newsAutoplayDelay?: string
    newsShowNavigation?: string
}

export default function NewsSection() {
    const [posts, setPosts] = useState<Post[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'ALL' | 'NEWS' | 'EVENT'>('ALL')
    const [settings, setSettings] = useState<CarouselSettings>({
        newsTitle: 'Tin tức & Sự kiện',
        newsSubtitle: 'Cập nhật những hoạt động mới nhất từ Nerd Society',
        newsLimit: '6',
        newsAutoplay: 'true',
        newsAutoplayDelay: '5000',
        newsShowNavigation: 'true',
    })

    // Create autoplay plugin with dynamic delay
    const autoplayPlugin = useMemo(() => {
        if (settings.newsAutoplay === 'false') return []
        return [Autoplay({
            delay: parseInt(settings.newsAutoplayDelay || '5000'),
            stopOnInteraction: false
        })]
    }, [settings.newsAutoplay, settings.newsAutoplayDelay])

    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: false, align: 'start' },
        autoplayPlugin
    )

    // Fetch settings on mount
    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/admin/settings')
                if (res.ok) {
                    const data = await res.json()
                    setSettings(prev => ({ ...prev, ...data }))
                }
            } catch (error) {
                console.error('Error fetching settings:', error)
            }
        }
        fetchSettings()
    }, [])

    useEffect(() => {
        async function fetchPosts() {
            try {
                const limit = settings.newsLimit || '6'
                const params = new URLSearchParams({ limit })
                if (activeTab !== 'ALL') {
                    params.set('type', activeTab)
                }
                const res = await fetch(`/api/posts?${params}`)
                if (res.ok) {
                    const data = await res.json()
                    setPosts(data.posts)
                }
            } catch (error) {
                console.error('Error fetching posts:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPosts()
    }, [activeTab, settings.newsLimit])

    const scrollPrev = () => emblaApi?.scrollPrev()
    const scrollNext = () => emblaApi?.scrollNext()

    const showNavigation = settings.newsShowNavigation !== 'false'

    if (loading) {
        return (
            <section className="py-16 lg:py-24">
                <div className="container">
                    <div className="flex items-center justify-center py-12">
                        <div className="text-neutral-500">Đang tải...</div>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section id="news" className="py-16 lg:py-24">
            <div className="container">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
                    <div>
                        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white lg:text-4xl">
                            {settings.newsTitle || 'Tin tức & Sự kiện'}
                        </h2>
                        <p className="mt-3 text-lg text-neutral-600 dark:text-neutral-400">
                            {settings.newsSubtitle || 'Cập nhật những hoạt động mới nhất từ Nerd Society'}
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        {(['ALL', 'NEWS', 'EVENT'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`cursor-pointer px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                    }`}
                            >
                                {tab === 'ALL' ? 'Tất cả' : tab === 'NEWS' ? 'Tin tức' : 'Sự kiện'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {posts.length > 0 ? (
                    <>
                        {/* Carousel */}
                        <div className="relative">
                            <div className="embla overflow-hidden" ref={emblaRef}>
                                <div className="embla__container flex -ml-4">
                                    {posts.map((post) => (
                                        <div
                                            key={post.id}
                                            className="embla__slide flex-shrink-0 pl-4 w-full sm:w-1/2 lg:w-[calc(33.333%)]"
                                        >
                                            <PostCard post={post} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Navigation buttons */}
                            {showNavigation && posts.length > 3 && (
                                <>
                                    <button
                                        onClick={scrollPrev}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 size-10 cursor-pointer rounded-full bg-white dark:bg-neutral-800 shadow-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors z-10 hidden lg:flex"
                                    >
                                        <ChevronLeftIcon className="size-5" />
                                    </button>
                                    <button
                                        onClick={scrollNext}
                                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 size-10 cursor-pointer rounded-full bg-white dark:bg-neutral-800 shadow-lg flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors z-10 hidden lg:flex"
                                    >
                                        <ChevronRightIcon className="size-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12 bg-white dark:bg-neutral-800 rounded-2xl">
                        <CalendarDaysIcon className="size-16 mx-auto text-neutral-300 dark:text-neutral-600" />
                        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
                            Chưa có bài viết nào trong danh mục này
                        </p>
                    </div>
                )}

                {/* View all link */}
                <div className="mt-10 text-center">
                    <Link
                        href="/news"
                        className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:underline"
                    >
                        Xem tất cả bài viết
                        <ArrowRightIcon className="size-4" />
                    </Link>
                </div>
            </div>
        </section>
    )
}

function PostCard({ post }: { post: Post }) {
    return (
        <Link href={`/news/${post.slug}`} className="group block">
            <article className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                {/* Thumbnail */}
                <div className="relative aspect-[16/10] overflow-hidden">
                    {post.thumbnail ? (
                        <Image
                            src={post.thumbnail}
                            alt={post.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center">
                            <CalendarDaysIcon className="size-12 text-primary-400" />
                        </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-3 left-3">
                        <Badge color="primary">
                            {post.type === 'EVENT' ? 'Sự kiện' : 'Tin tức'}
                        </Badge>
                    </div>

                    {post.featured && (
                        <div className="absolute top-3 right-3">
                            <Badge color="featured">Nổi bật</Badge>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                    {/* Event info */}
                    {post.type === 'EVENT' && post.eventDate && (
                        <div className="flex flex-wrap gap-3 mb-3 text-sm text-neutral-500 dark:text-neutral-400">
                            <div className="flex items-center gap-1">
                                <CalendarDaysIcon className="size-4" />
                                {format(new Date(post.eventDate), 'dd/MM/yyyy', { locale: vi })}
                            </div>
                            {post.eventTime && (
                                <div className="flex items-center gap-1">
                                    <ClockIcon className="size-4" />
                                    {post.eventTime}
                                </div>
                            )}
                            {post.eventLocation && (
                                <div className="flex items-center gap-1">
                                    <MapPinIcon className="size-4" />
                                    <span className="truncate max-w-[150px]">{post.eventLocation}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                        {post.title}
                    </h3>

                    {/* Excerpt */}
                    {post.excerpt && (
                        <p className="mt-2 text-neutral-600 dark:text-neutral-400 text-sm line-clamp-2 flex-1">
                            {post.excerpt}
                        </p>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between text-sm">
                        <span className="text-neutral-500 dark:text-neutral-400">
                            {post.publishedAt && format(new Date(post.publishedAt), 'dd MMM yyyy', { locale: vi })}
                        </span>
                        <span className="text-primary-600 dark:text-primary-400 font-medium group-hover:underline">
                            Đọc thêm →
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    )
}
