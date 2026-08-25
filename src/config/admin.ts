export const ADMIN_PERMISSION_KEYS = [
  'canViewDashboard',
  'canViewReports',
  'canViewBookings',
  'canCreateBookings',
  'canEditBookings',
  'canDeleteBookings',
  'canCheckIn',
  'canCheckOut',
  'canViewChat',
  'canViewRooms',
  'canManageRooms',
  'canViewServices',
  'canManageServices',
  'canViewLocations',
  'canManageLocations',
  'canViewPosts',
  'canManagePosts',
  'canViewGallery',
  'canManageGallery',
  'canViewContent',
  'canManageContent',
  'canViewCustomers',
  'canManageCustomers',
  'canViewWallets',
  'canManageWallets',
  'canViewNerdCoin',
  'canManageNerdCoin',
  'canViewSettings',
  'canViewStaff',
  'canManageStaff',
  'canViewAuditLog',
  'canViewEmailTemplates',
  'canManageEmailTemplates',
  'canViewRecruitment',
  'canManageRecruitment',
  'canViewQrGenerator',
  'canViewFeedback',
  'canViewStudyDate',
  'canManageStudyDate',
  'canViewNerdNight',
  'canManageNerdNight',
  'canConfirmNerdNightPayments',
] as const

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number]
export type AdminPermissions = Record<AdminPermissionKey, boolean>
export type ConfigurableAdminRole = 'MANAGER' | 'STAFF' | 'CONTENT_EDITOR'

function createPermissions(overrides: Partial<AdminPermissions> = {}): AdminPermissions {
  return Object.assign(
    Object.fromEntries(ADMIN_PERMISSION_KEYS.map((key) => [key, false])) as AdminPermissions,
    overrides,
  )
}

export const ADMIN_PERMISSIONS = createPermissions(
  Object.fromEntries(ADMIN_PERMISSION_KEYS.map((key) => [key, true])) as AdminPermissions,
)

export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableAdminRole, AdminPermissions> = {
  MANAGER: createPermissions({
    canViewDashboard: true,
    canViewReports: true,
    canViewBookings: true,
    canCreateBookings: true,
    canEditBookings: true,
    canDeleteBookings: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewChat: true,
    canViewRooms: true,
    canManageRooms: true,
    canViewServices: true,
    canManageServices: true,
    canViewLocations: true,
    canManageLocations: true,
    canViewPosts: true,
    canManagePosts: true,
    canViewGallery: true,
    canManageGallery: true,
    canViewContent: true,
    canManageContent: true,
    canViewCustomers: true,
    canManageCustomers: true,
    canViewWallets: true,
    canManageWallets: true,
    canViewNerdCoin: true,
    canManageNerdCoin: true,
    canViewStaff: true,
    canManageStaff: true,
    canViewAuditLog: true,
    canViewEmailTemplates: true,
    canManageEmailTemplates: true,
    canViewNerdNight: true,
    canManageNerdNight: true,
    canConfirmNerdNightPayments: true,
  }),
  STAFF: createPermissions({
    canViewDashboard: true,
    canViewBookings: true,
    canCreateBookings: true,
    canEditBookings: true,
    canCheckIn: true,
    canCheckOut: true,
    canViewChat: true,
    canViewCustomers: true,
    canViewWallets: true,
    canViewNerdNight: true,
    canManageNerdNight: true,
    canConfirmNerdNightPayments: true,
  }),
  CONTENT_EDITOR: createPermissions({
    canViewPosts: true,
    canManagePosts: true,
    canViewGallery: true,
    canManageGallery: true,
    canViewContent: true,
    canManageContent: true,
  }),
}

export type AdminNavIconKey =
  | 'dashboard'
  | 'bookings'
  | 'subscriptions'
  | 'study-date'
  | 'events'
  | 'locations'
  | 'rooms'
  | 'services'
  | 'combos'
  | 'customers'
  | 'wallets'
  | 'nerdcoin'
  | 'chat'
  | 'feedback'
  | 'posts'
  | 'pages'
  | 'gallery'
  | 'media'
  | 'content'
  | 'jobs'
  | 'applications'
  | 'staff'
  | 'permissions'
  | 'email'
  | 'audit'
  | 'settings'
  | 'qr'

export interface AdminNavItem {
  name: string
  href: string
  icon: AdminNavIconKey
  permissionKey?: AdminPermissionKey
  adminOnly?: boolean
  activeQuery?: Record<string, string>
  inactiveQuery?: Record<string, string>
}

export interface AdminNavGroup {
  name: string
  items: readonly AdminNavItem[]
}

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavGroup[] = [
  {
    name: 'Tổng quan',
    items: [
      { name: 'Dashboard', href: '/admin', icon: 'dashboard', permissionKey: 'canViewDashboard' },
    ],
  },
  {
    name: 'Vận hành',
    items: [
      { name: 'Bookings', href: '/admin/bookings', icon: 'bookings', permissionKey: 'canViewBookings' },
      { name: 'Monthly Beaver', href: '/admin/subscriptions', icon: 'subscriptions', permissionKey: 'canViewBookings' },
      { name: 'Study Date', href: '/admin/study-date', icon: 'study-date', permissionKey: 'canViewStudyDate' },
      { name: 'Nerd Night', href: '/admin/nerd-night', icon: 'events', permissionKey: 'canViewNerdNight' },
    ],
  },
  {
    name: 'Danh mục & địa điểm',
    items: [
      { name: 'Cơ sở', href: '/admin/locations', icon: 'locations', permissionKey: 'canViewLocations' },
      { name: 'Phòng', href: '/admin/rooms', icon: 'rooms', permissionKey: 'canViewRooms' },
      { name: 'Dịch vụ', href: '/admin/services', icon: 'services', permissionKey: 'canViewServices' },
      { name: 'Combos', href: '/admin/combos', icon: 'combos', permissionKey: 'canViewServices' },
    ],
  },
  {
    name: 'Khách hàng & cộng đồng',
    items: [
      { name: 'Khách hàng', href: '/admin/customers', icon: 'customers', permissionKey: 'canViewCustomers' },
      { name: 'Ví user', href: '/admin/wallets', icon: 'wallets', permissionKey: 'canViewWallets' },
      { name: 'Nerd Coin', href: '/admin/nerdcoin', icon: 'nerdcoin', permissionKey: 'canViewNerdCoin' },
      { name: 'Chat hỗ trợ', href: '/admin/chat', icon: 'chat', permissionKey: 'canViewChat' },
      { name: 'Góp ý', href: '/admin/feedback', icon: 'feedback', permissionKey: 'canViewFeedback' },
    ],
  },
  {
    name: 'Nội dung',
    items: [
      { name: 'Bài viết & sự kiện', href: '/admin/posts', icon: 'posts', permissionKey: 'canViewPosts', inactiveQuery: { type: 'PAGE' } },
      { name: 'Trang & chính sách', href: '/admin/posts?type=PAGE', icon: 'pages', permissionKey: 'canViewPosts', activeQuery: { type: 'PAGE' } },
      { name: 'Gallery', href: '/admin/gallery', icon: 'gallery', permissionKey: 'canViewGallery' },
      { name: 'Media', href: '/admin/media', icon: 'media', permissionKey: 'canViewGallery' },
      { name: 'Website content', href: '/admin/content', icon: 'content', permissionKey: 'canViewContent' },
      { name: 'Tuyển dụng', href: '/admin/jobs', icon: 'jobs', permissionKey: 'canViewRecruitment' },
      { name: 'Ứng viên', href: '/admin/applications', icon: 'applications', permissionKey: 'canViewRecruitment' },
    ],
  },
  {
    name: 'Hệ thống',
    items: [
      { name: 'Nhân viên', href: '/admin/staff', icon: 'staff', permissionKey: 'canViewStaff' },
      { name: 'Phân quyền', href: '/admin/permissions', icon: 'permissions', adminOnly: true },
      { name: 'Email templates', href: '/admin/email-templates', icon: 'email', permissionKey: 'canViewEmailTemplates' },
      { name: 'Lịch sử thao tác', href: '/admin/audit-log', icon: 'audit', permissionKey: 'canViewAuditLog' },
      { name: 'Cấu hình', href: '/admin/settings', icon: 'settings', permissionKey: 'canViewSettings' },
      { name: 'Công cụ QR', href: '/admin/qr-generator', icon: 'qr', permissionKey: 'canViewQrGenerator' },
    ],
  },
] as const

export const ADMIN_NAVIGATION_ITEMS = ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items)

export const ADMIN_ONLY_ROUTES = ADMIN_NAVIGATION_ITEMS
  .filter((item) => item.adminOnly)
  .map((item) => item.href.split('?')[0])

export const CONTENT_EDITOR_ROUTES = ADMIN_NAVIGATION_ITEMS
  .filter((item) => item.permissionKey && DEFAULT_ROLE_PERMISSIONS.CONTENT_EDITOR[item.permissionKey])
  .map((item) => item.href.split('?')[0])
  .filter((route, index, routes) => routes.indexOf(route) === index)

export const ADMIN_ROUTE_PERMISSIONS = Object.fromEntries(
  ADMIN_NAVIGATION_ITEMS
    .filter((item): item is AdminNavItem & { permissionKey: AdminPermissionKey } => Boolean(item.permissionKey))
    .map((item) => [item.href.split('?')[0], item.permissionKey]),
) as Record<string, AdminPermissionKey>

function routeMatches(pathname: string, route: string): boolean {
  if (route === '/admin') return pathname === route
  return pathname === route || pathname.startsWith(`${route}/`)
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((route) => routeMatches(pathname, route))
}

export function getAdminRoutePermission(pathname: string): AdminPermissionKey | null {
  const matchingRoute = Object.keys(ADMIN_ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length)
    .find((route) => routeMatches(pathname, route))

  return matchingRoute ? ADMIN_ROUTE_PERMISSIONS[matchingRoute] : null
}

export function getFirstAllowedAdminRoute(
  hasPermission: (permission: AdminPermissionKey) => boolean,
  isAdmin: boolean,
): string {
  const item = ADMIN_NAVIGATION_ITEMS.find((candidate) => {
    if (candidate.adminOnly) return isAdmin
    return candidate.permissionKey ? hasPermission(candidate.permissionKey) : true
  })

  return item?.href || '/'
}

interface SearchParamsReader {
  get(name: string): string | null
}

export function isAdminNavItemActive(
  item: AdminNavItem,
  pathname: string,
  searchParams: SearchParamsReader,
): boolean {
  const route = item.href.split('?')[0]
  if (!routeMatches(pathname, route)) return false

  if (item.activeQuery) {
    const matchesRequiredQuery = Object.entries(item.activeQuery)
      .every(([key, value]) => searchParams.get(key) === value)
    if (!matchesRequiredQuery) return false
  }

  if (item.inactiveQuery) {
    const matchesExcludedQuery = Object.entries(item.inactiveQuery)
      .every(([key, value]) => searchParams.get(key) === value)
    if (matchesExcludedQuery) return false
  }

  return true
}
