'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    ChatBubbleLeftRightIcon,
    XMarkIcon,
    PaperAirplaneIcon,
    PhotoIcon,
    XCircleIcon,
    PhoneIcon,
} from '@heroicons/react/24/outline'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { getPusherClient, CHAT_CHANNELS, CHAT_EVENTS } from '@/lib/pusher-client'

interface Message {
    id: string
    content: string
    attachments?: string[]
    senderType: 'GUEST' | 'STAFF' | 'SYSTEM'
    senderName?: string
    createdAt: string
}

interface Conversation {
    id: string
    messages: Message[]
}

interface ChatWidgetProps {
    logoUrl?: string
}

export function ChatWidget({ logoUrl }: ChatWidgetProps) {
    const pathname = usePathname()
    const { data: session } = useSession()

    // States
    const [isOpen, setIsOpen] = useState(false)
    const [isMenuOpen, setIsMenuOpen] = useState(false) // New state for FAB menu
    const [isStarted, setIsStarted] = useState(false)
    const [conversation, setConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputMessage, setInputMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [hasNewMessage, setHasNewMessage] = useState(false)

    // Media upload
    const [selectedImages, setSelectedImages] = useState<File[]>([])
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Guest info form
    const [guestName, setGuestName] = useState('')
    const [guestPhone, setGuestPhone] = useState('')
    const [initialMessage, setInitialMessage] = useState('')

    // Session ID for anonymous users
    const [sessionId, setSessionId] = useState('')

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            const maxHeight = 120

            textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`

            if (scrollHeight > maxHeight) {
                textareaRef.current.style.overflowY = 'auto'
            } else {
                textareaRef.current.style.overflowY = 'hidden'
            }
        }
    }, [inputMessage])

    // Hide on admin pages
    const isAdminPage = pathname?.startsWith('/admin')

    // Generate or retrieve session ID
    useEffect(() => {
        let sid = localStorage.getItem('chat_session_id')
        if (!sid) {
            sid = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            localStorage.setItem('chat_session_id', sid)
        }
        setSessionId(sid)

        // Check for existing conversation
        const savedConvId = localStorage.getItem('chat_conversation_id')
        if (savedConvId) {
            loadConversation(savedConvId)
        }
    }, [])

    // Pusher real-time subscription
    useEffect(() => {
        if (!conversation?.id) return

        try {
            const pusher = getPusherClient()
            const channel = pusher.subscribe(CHAT_CHANNELS.conversation(conversation.id))

            channel.bind(CHAT_EVENTS.NEW_MESSAGE, (newMessage: Message) => {
                // Only add if not from self (GUEST)
                if (newMessage.senderType !== 'GUEST') {
                    setMessages(prev => {
                        // Avoid duplicates
                        if (prev.find(m => m.id === newMessage.id)) return prev
                        return [...prev, newMessage]
                    })

                    // Show notification if widget is closed
                    if (!isOpen) {
                        setHasNewMessage(true)
                        // Play sound
                        try {
                            const audio = new Audio('/sounds/notification.mp3')
                            audio.volume = 0.3
                            audio.play().catch(() => { })
                        } catch { }
                    }
                }
            })

            channel.bind(CHAT_EVENTS.TYPING, () => {
                setIsTyping(true)
                setTimeout(() => setIsTyping(false), 3000)
            })

            return () => {
                channel.unbind_all()
                pusher.unsubscribe(CHAT_CHANNELS.conversation(conversation.id))
            }
        } catch (error) {
            console.error('Pusher connection error:', error)
        }
    }, [conversation?.id, isOpen])

    // Auto-fill from session
    useEffect(() => {
        if (session?.user) {
            if (session.user.name) setGuestName(session.user.name)
        }
    }, [session])

    // Scroll to bottom when new messages
    // Scroll to bottom when new messages or open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 100)
        }
    }, [messages, isOpen])

    // Clear new message indicator when opening
    useEffect(() => {
        if (isOpen) setHasNewMessage(false)
    }, [isOpen])

    const loadConversation = async (convId: string) => {
        try {
            const res = await fetch(`/api/chat/conversations/${convId}`)
            if (res.ok) {
                const data = await res.json()
                setConversation(data)
                setMessages(data.messages || [])
                setIsStarted(true)
            } else {
                localStorage.removeItem('chat_conversation_id')
            }
        } catch (error) {
            console.error('Error loading conversation:', error)
        }
    }

    const startConversation = async () => {
        if (!guestName.trim() || !initialMessage.trim()) return

        setIsLoading(true)
        try {
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestName: guestName.trim(),
                    guestPhone: guestPhone.trim() || undefined,
                    guestSessionId: sessionId,
                    userId: session?.user ? (session.user as any).id : undefined,
                    source: pathname || 'homepage',
                    initialMessage: initialMessage.trim(),
                }),
            })

            if (res.ok) {
                const data = await res.json()
                setConversation(data)
                setMessages(data.messages || [])
                setIsStarted(true)
                localStorage.setItem('chat_conversation_id', data.id)
                setInitialMessage('')
            }
        } catch (error) {
            console.error('Error starting conversation:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // Limit to 3 images
        const newFiles = files.slice(0, 3 - selectedImages.length)
        setSelectedImages(prev => [...prev, ...newFiles])

        // Create previews
        newFiles.forEach(file => {
            const url = URL.createObjectURL(file)
            setPreviewUrls(prev => [...prev, url])
        })
    }

    const removeImage = (index: number) => {
        URL.revokeObjectURL(previewUrls[index])
        setSelectedImages(prev => prev.filter((_, i) => i !== index))
        setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    }

    const uploadImages = async (): Promise<string[]> => {
        if (selectedImages.length === 0) return []

        const uploadedUrls: string[] = []
        for (const file of selectedImages) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('guestSessionId', sessionId)

            try {
                const res = await fetch('/api/chat/upload', {
                    method: 'POST',
                    body: formData,
                })
                if (res.ok) {
                    const data = await res.json()
                    uploadedUrls.push(data.url)
                }
            } catch (error) {
                console.error('Upload error:', error)
            }
        }
        return uploadedUrls
    }

    const sendMessage = async () => {
        if ((!inputMessage.trim() && selectedImages.length === 0) || !conversation) return

        const messageContent = inputMessage.trim()
        setInputMessage('')
        setIsUploading(selectedImages.length > 0)

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = '38px'
        }

        // Upload images first
        const attachmentUrls = await uploadImages()
        setIsUploading(false)

        // Clear images
        previewUrls.forEach(url => URL.revokeObjectURL(url))
        setSelectedImages([])
        setPreviewUrls([])

        // Optimistic update
        const tempMessage: Message = {
            id: `temp_${Date.now()}`,
            content: messageContent,
            attachments: attachmentUrls,
            senderType: 'GUEST',
            senderName: guestName,
            createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, tempMessage])

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: conversation.id,
                    content: messageContent,
                    attachments: attachmentUrls,
                    senderType: 'GUEST',
                    senderName: guestName,
                    guestSessionId: sessionId,
                }),
            })

            if (res.ok) {
                const newMessage = await res.json()
                setMessages(prev => prev.map(m =>
                    m.id === tempMessage.id ? newMessage : m
                ))
            }
        } catch (error) {
            console.error('Error sending message:', error)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (isStarted) {
                sendMessage()
            } else {
                startConversation()
            }
        }
    }

    // Scroll visibility
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const toggleVisibility = () => {
            if (window.scrollY > 100) {
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        window.addEventListener('scroll', toggleVisibility)

        return () => window.removeEventListener('scroll', toggleVisibility)
    }, [])

    if (isAdminPage) return null

    return (
        <>
            {/* Main FAB Menu */}
            {!isOpen && (
                <AnimatePresence>
                    {isVisible && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
                        >
                            <AnimatePresence>
                                {isMenuOpen && (
                                    <>
                                        {/* Call Button */}
                                        <motion.a
                                            initial={{ opacity: 0, scale: 0, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0, y: 10 }}
                                            transition={{ delay: 0.05 }}
                                            href="tel:0368483689"
                                            className="group flex items-center gap-3 rounded-full bg-white pl-4 pr-1 py-1 shadow-lg ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:ring-neutral-700 dark:hover:bg-neutral-700"
                                        >
                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Gọi ngay</span>
                                            <div className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm group-hover:bg-primary-700">
                                                <PhoneIcon className="size-5" />
                                            </div>
                                        </motion.a>

                                        {/* Chat Button */}
                                        <motion.button
                                            initial={{ opacity: 0, scale: 0, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0, y: 10 }}
                                            onClick={() => {
                                                setIsOpen(true)
                                                setIsMenuOpen(false)
                                            }}
                                            className="group flex items-center gap-3 rounded-full bg-white pl-4 pr-1 py-1 shadow-lg ring-1 ring-neutral-200 hover:bg-neutral-50 dark:bg-neutral-800 dark:ring-neutral-700 dark:hover:bg-neutral-700"
                                        >
                                            <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Chat hỗ trợ</span>
                                            <div className="flex size-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm group-hover:bg-primary-700">
                                                <ChatBubbleLeftRightIcon className="size-5" />
                                            </div>
                                        </motion.button>
                                    </>
                                )}
                            </AnimatePresence>

                            {/* Trigger Button */}
                            <motion.button
                                layout
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={`group flex size-14 items-center justify-center rounded-full shadow-lg transition-all ${isMenuOpen ? 'bg-neutral-100 text-neutral-600 rotate-45' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                                whileTap={{ scale: 0.95 }}
                            >
                                {isMenuOpen ? (
                                    <span className="text-3xl font-light">+</span>
                                ) : (
                                    <>
                                        <ChatBubbleLeftRightIcon className="size-7" />
                                        {hasNewMessage && (
                                            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold ring-2 ring-white">
                                                !
                                            </span>
                                        )}
                                    </>
                                )}
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}


            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_-5px_20px_rgba(0,0,0,0.15)] ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800 max-[400px]:bottom-0 max-[400px]:right-0 max-[400px]:h-full max-[400px]:w-full max-[400px]:rounded-none"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30">
                                        <ChatBubbleLeftRightIcon className="size-5" />
                                    </div>
                                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-neutral-900"></span>
                                </div>
                                <div>
                                    <span className="block text-sm font-bold text-neutral-900 dark:text-white">Nerd Society</span>
                                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Thường trả lời ngay</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            >
                                <XMarkIcon className="size-5" />
                            </button>
                        </div>

                        {!isStarted ? (
                            /* Start Form */
                            <div className="flex flex-1 flex-col justify-center gap-4 bg-neutral-50/50 p-6 dark:bg-black/20">
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                                        Xin chào! 👋
                                    </h3>
                                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                        Để lại lời nhắn, chúng mình sẽ phản hồi sớm nhất có thể.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        placeholder="Tên của bạn *"
                                        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                    <input
                                        type="tel"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value)}
                                        placeholder="Số điện thoại"
                                        className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                    <textarea
                                        value={initialMessage}
                                        onChange={(e) => setInitialMessage(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        placeholder="Bạn cần hỗ trợ gì? *"
                                        rows={3}
                                        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                                    />
                                </div>

                                <button
                                    onClick={startConversation}
                                    disabled={!guestName.trim() || !initialMessage.trim() || isLoading}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <>
                                            Bắt đầu chat
                                            <PaperAirplaneIcon className="size-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* Chat Messages */
                            <>
                                <div className="flex-1 overflow-y-auto bg-neutral-50/50 p-4 scrollbar-thin dark:bg-black/20">
                                    <div className="flex flex-col gap-3">
                                        {messages.map((msg) => (
                                            <motion.div
                                                key={msg.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex w-full ${msg.senderType === 'GUEST' ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div className={`flex max-w-[85%] items-end gap-2 ${msg.senderType === 'GUEST' ? 'flex-row-reverse' : 'flex-row'}`}>
                                                    {/* Avatar */}
                                                    {msg.senderType !== 'GUEST' && msg.senderType !== 'SYSTEM' && (
                                                        logoUrl ? (
                                                            <div className="flex size-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-neutral-100">
                                                                <Image src={logoUrl} alt="NS" width={24} height={24} className="size-full object-cover" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm">
                                                                <span className="text-[8px] font-bold">NS</span>
                                                            </div>
                                                        )
                                                    )}

                                                    <div
                                                        className={`relative rounded-2xl px-3 py-2 text-sm ${msg.senderType === 'GUEST'
                                                            ? 'bg-primary-600 text-white rounded-tr-sm'
                                                            : msg.senderType === 'SYSTEM'
                                                                ? 'w-full text-center text-xs text-neutral-500 italic bg-transparent shadow-none'
                                                                : 'bg-white text-neutral-900 border border-neutral-100 rounded-tl-sm dark:bg-neutral-800 dark:border-neutral-700 dark:text-white'
                                                            }`}
                                                    >
                                                        {msg.content}

                                                        {/* Attachments */}
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <div className={`grid gap-1 mt-1 ${msg.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                                {msg.attachments.map((url, i) => (
                                                                    <img
                                                                        key={i}
                                                                        src={url}
                                                                        alt="Attachment"
                                                                        className="rounded-lg object-cover cursor-pointer hover:opacity-90"
                                                                        onClick={() => window.open(url, '_blank')}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}

                                        {/* Typing indicator */}
                                        {isTyping && (
                                            <div className="flex justify-start">
                                                <div className="ml-8 rounded-2xl bg-neutral-100 px-4 py-2 dark:bg-neutral-800">
                                                    <div className="flex gap-1">
                                                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                {/* Image Previews */}
                                {previewUrls.length > 0 && (
                                    <div className="border-t border-neutral-200 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
                                        <div className="flex gap-2">
                                            {previewUrls.map((url, i) => (
                                                <div key={i} className="relative group">
                                                    <img src={url} alt="Preview" className="size-14 rounded-lg object-cover ring-1 ring-neutral-200" />
                                                    <button
                                                        onClick={() => removeImage(i)}
                                                        className="absolute -top-1 -right-1 rounded-full bg-red-500 p-0.5 text-white shadow-sm hover:bg-red-600"
                                                    >
                                                        <XCircleIcon className="size-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Input */}
                                <div className="border-t border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageSelect}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={selectedImages.length >= 3}
                                            className="text-neutral-400 hover:text-primary-600 disabled:opacity-50 dark:hover:text-primary-400"
                                        >
                                            <PhotoIcon className="size-6" />
                                        </button>

                                        <div className="relative flex-1">
                                            <textarea
                                                ref={textareaRef}
                                                value={inputMessage}
                                                onChange={(e) => setInputMessage(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault()
                                                        sendMessage()
                                                    }
                                                }}
                                                placeholder="Nhập tin nhắn..."
                                                rows={1}
                                                className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm scrollbar-thin focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:focus:bg-neutral-800"
                                                style={{ minHeight: '38px' }}
                                            />
                                        </div>

                                        <button
                                            onClick={sendMessage}
                                            disabled={(!inputMessage.trim() && selectedImages.length === 0) || isUploading}
                                            className="flex items-center justify-center rounded-full bg-primary-600 p-2 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                                        >
                                            {isUploading ? (
                                                <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            ) : (
                                                <PaperAirplaneIcon className="size-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
