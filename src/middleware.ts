import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { CONTENT_EDITOR_ROUTES, isAdminOnlyRoute } from '@/config/admin'

// All staff-like roles (not CUSTOMER, not ADMIN)
const STAFF_ROLES = ['STAFF', 'MANAGER', 'CONTENT_EDITOR']
const CHECKIN_ROLES = ['STAFF', 'MANAGER', 'ADMIN']

export default withAuth(
    function middleware(req) {
        const pathname = req.nextUrl.pathname
        const role = req.nextauth.token?.role as string

        if (pathname.startsWith('/staff')) {
            if (!CHECKIN_ROLES.includes(role)) {
                return NextResponse.redirect(new URL('/?error=access_denied', req.url))
            }
            return
        }

        if (pathname.startsWith('/admin')) {
            // Block customers from all admin routes
            if (role === 'CUSTOMER' || !role) {
                return NextResponse.redirect(new URL('/', req.url))
            }

            // Admin has full access
            if (role === 'ADMIN') {
                return
            }

            // Manager has almost full access except staff/permissions management
            if (role === 'MANAGER') {
                if (isAdminOnlyRoute(pathname)) {
                    return NextResponse.redirect(new URL('/admin?error=access_denied', req.url))
                }
                return // Manager can access everything else
            }

            // Content Editor can only access content-related routes
            if (role === 'CONTENT_EDITOR') {
                // Exact match for /admin (dashboard) - redirect to posts
                if (pathname === '/admin') {
                    return NextResponse.redirect(new URL('/admin/posts', req.url))
                }

                const isAllowedRoute = CONTENT_EDITOR_ROUTES.some(route =>
                    pathname === route || pathname.startsWith(route + '/')
                )
                if (!isAllowedRoute) {
                    return NextResponse.redirect(new URL('/admin/posts?error=access_denied', req.url))
                }
                return
            }

            // Staff - check admin-only routes, other permissions handled by context
            if (role === 'STAFF') {
                if (isAdminOnlyRoute(pathname)) {
                    return NextResponse.redirect(new URL('/admin?error=access_denied', req.url))
                }
            }
        }
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
    }
)

export const config = {
    matcher: ['/admin/:path*', '/profile/:path*', '/staff/:path*'],
}
