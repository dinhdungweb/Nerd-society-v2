import StaffClient from '../staff/StaffClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function StaffTestPage() {
    return (
        <div>
            <div className="bg-blue-600 text-white p-4 text-center font-bold">
                DAY LA TRANG TEST CACHE (STAFF-TEST)
            </div>
            <StaffClient />
        </div>
    )
}
