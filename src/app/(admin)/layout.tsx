'use client'

import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminNavbar from '@/components/admin/AdminNavbar'
import AdminRouteGuard from '@/components/admin/AdminRouteGuard'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { AdminChatProvider } from '@/contexts/AdminChatContext'
import AdminChatWindow from '@/components/admin/AdminChatWindow'
import { Suspense, useState } from 'react'
import { AdminLoadingState } from '@/components/admin/ui'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <PermissionsProvider>
            <AdminChatProvider>
                <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
                    {/* Sidebar */}
                    <Suspense fallback={<aside aria-hidden="true" className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-neutral-200 bg-white lg:block dark:border-neutral-800 dark:bg-neutral-900" />}>
                        <AdminSidebar
                            isOpen={sidebarOpen}
                            onClose={() => setSidebarOpen(false)}
                            isCollapsed={sidebarCollapsed}
                            onCollapse={setSidebarCollapsed}
                        />
                    </Suspense>

                    {/* Main content */}
                    <main className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
                        <AdminNavbar
                            onMenuClick={() => setSidebarOpen(true)}
                            isCollapsed={sidebarCollapsed}
                            onCollapse={setSidebarCollapsed}
                        />
                        <div className="p-4 lg:p-8">
                            <AdminRouteGuard>
                                <Suspense fallback={<AdminLoadingState label="Đang tải trang quản trị..." />}>
                                    {children}
                                </Suspense>
                            </AdminRouteGuard>
                        </div>
                    </main>

                    {/* Floating Chat Window */}
                    <AdminChatWindow />
                </div>
            </AdminChatProvider>
        </PermissionsProvider>
    )
}

