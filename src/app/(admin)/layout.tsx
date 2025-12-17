'use client'

import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminNavbar from '@/components/admin/AdminNavbar'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { useState } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <PermissionsProvider>
            <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
                {/* Sidebar */}
                <AdminSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    isCollapsed={sidebarCollapsed}
                    onCollapse={setSidebarCollapsed}
                />

                {/* Main content */}
                <main className={`transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
                    <AdminNavbar
                        onMenuClick={() => setSidebarOpen(true)}
                        isCollapsed={sidebarCollapsed}
                        onCollapse={setSidebarCollapsed}
                    />
                    <div className="p-4 lg:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </PermissionsProvider>
    )
}
