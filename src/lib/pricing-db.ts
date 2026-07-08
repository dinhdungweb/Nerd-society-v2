import { prisma } from './prisma'
import { ServiceType } from '@prisma/client'

/**
 * System constants (không đổi thường xuyên)
 */
export const SYSTEM_CONFIG = {
    DEPOSIT_RATE: 0.5,           // Cọc 50%
    GRACE_PERIOD_MINUTES: 15,    // Thời gian ân hạn (phút) không tính phụ trội
    GUEST_THRESHOLD: 8,          // Ngưỡng số người cho Meeting Room
} as const

/**
 * Mức giá mặc định theo yêu cầu cho Meeting Room:
 * 1 người: 30k/h | 2-3 người: 60k/h | 4+ người: 100k/h
 */
export const DEFAULT_MEETING_TIERS = [
    { minGuests: 1, maxGuests: 1, pricePerHour: 30000, label: '1 người (30k/h)' },
    { minGuests: 2, maxGuests: 3, pricePerHour: 60000, label: '2-3 người (60k/h)' },
    { minGuests: 4, maxGuests: null, pricePerHour: 100000, label: '4 người trở lên (100k/h)' },
]

/**
 * Interface cho Service pricing từ database
 */
export interface PricingTierItem {
    minGuests: number
    maxGuests?: number | null
    pricePerHour: number
    label?: string
}

export interface ServicePricing {
    priceSmall: number | null
    priceLarge: number | null
    priceFirstHour: number | null
    pricePerHour: number | null
    nerdCoinReward: number
    pricingTiers?: PricingTierItem[] | null
}

/**
 * Helper xác định đơn giá Meeting Room theo số người
 */
export function resolveMeetingPricePerHour(guests: number, pricing: ServicePricing): { pricePerHour: number; label: string } {
    const rawTiers = pricing.pricingTiers
    const tiers = (rawTiers && Array.isArray(rawTiers) && rawTiers.length > 0)
        ? rawTiers
        : DEFAULT_MEETING_TIERS

    const sortedTiers = [...tiers].sort((a, b) => (Number(a.minGuests) || 1) - (Number(b.minGuests) || 1))
    const matched = sortedTiers.find(tier => {
        const min = Number(tier.minGuests) || 1
        const max = (tier.maxGuests !== null && tier.maxGuests !== undefined && Number(tier.maxGuests) > 0) ? Number(tier.maxGuests) : Infinity
        return guests >= min && guests <= max
    })
    const chosen = matched || sortedTiers[sortedTiers.length - 1]
    const price = Number(chosen.pricePerHour) || 0
    const min = Number(chosen.minGuests) || 1
    const max = (chosen.maxGuests !== null && chosen.maxGuests !== undefined && Number(chosen.maxGuests) > 0) ? Number(chosen.maxGuests) : null
    let label = chosen.label
    if (!label || label === `${min}-${min} người`) {
        if (max !== null) {
            label = min === max ? `${min} người` : `${min}-${max} người`
        } else {
            label = `${min}+ người`
        }
    }
    return { pricePerHour: price, label }
}

/**
 * Cache service pricing để tránh query DB mỗi lần tính giá
 */
let servicePricingCache: Map<ServiceType, ServicePricing> | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 60000 // 1 phút

/**
 * Lấy pricing từ database theo service type
 */
export async function getServicePricing(serviceType: ServiceType): Promise<ServicePricing | null> {
    const now = Date.now()

    // Check cache
    if (servicePricingCache && (now - cacheTimestamp) < CACHE_TTL) {
        return servicePricingCache.get(serviceType) || null
    }

    // Fetch all services and cache
    const services = await prisma.service.findMany({
        where: { isActive: true },
        select: {
            type: true,
            priceSmall: true,
            priceLarge: true,
            priceFirstHour: true,
            pricePerHour: true,
            nerdCoinReward: true,
            pricingTiers: true,
        }
    })

    servicePricingCache = new Map()
    for (const service of services) {
        servicePricingCache.set(service.type, {
            priceSmall: service.priceSmall,
            priceLarge: service.priceLarge,
            priceFirstHour: service.priceFirstHour,
            pricePerHour: service.pricePerHour,
            nerdCoinReward: service.nerdCoinReward,
            pricingTiers: (service as any).pricingTiers || null,
        })
    }
    cacheTimestamp = now

    return servicePricingCache.get(serviceType) || null
}

/**
 * Invalidate cache khi admin update pricing
 */
export function invalidateServicePricingCache() {
    servicePricingCache = null
    cacheTimestamp = 0
}

/**
 * Tính giá Meeting Room từ database
 */
export async function calculateMeetingPriceFromDB(
    guests: number,
    durationMinutes: number
): Promise<number> {
    const pricing = await getServicePricing('MEETING')
    if (!pricing) {
        throw new Error('Meeting pricing not found in database')
    }

    const { pricePerHour } = resolveMeetingPricePerHour(guests, pricing)

    const hours = durationMinutes / 60
    return Math.round(pricePerHour * hours)
}

/**
 * Tính giá Pod từ database
 * - Giờ đầu: giá cố định
 * - Từ giờ 2: tính theo phút
 */
export async function calculatePodPriceFromDB(
    type: 'POD_MONO' | 'POD_MULTI',
    durationMinutes: number
): Promise<number> {
    const pricing = await getServicePricing(type)
    if (!pricing) {
        throw new Error(`${type} pricing not found in database`)
    }

    const firstHour = pricing.priceFirstHour || 0
    const perHour = pricing.pricePerHour || 0

    if (durationMinutes <= 60) {
        return firstHour
    }

    const extraMinutes = durationMinutes - 60
    const extraHours = extraMinutes / 60
    return firstHour + Math.round(perHour * extraHours)
}

/**
 * Tính giá booking từ database
 */
export async function calculateBookingPriceFromDB(
    serviceType: ServiceType,
    durationMinutes: number,
    guests: number = 1
): Promise<number> {
    switch (serviceType) {
        case 'MEETING':
            return calculateMeetingPriceFromDB(guests, durationMinutes)
        case 'POD_MONO':
            return calculatePodPriceFromDB('POD_MONO', durationMinutes)
        case 'POD_MULTI':
            return calculatePodPriceFromDB('POD_MULTI', durationMinutes)
        default:
            throw new Error(`Unknown service type: ${serviceType}`)
    }
}

/**
 * Tính tiền cọc (50%)
 */
export function calculateDeposit(totalAmount: number): number {
    return Math.round(totalAmount * SYSTEM_CONFIG.DEPOSIT_RATE)
}

/**
 * Lấy số Nerd Coin reward từ database
 */
export async function getNerdCoinRewardFromDB(serviceType: ServiceType): Promise<number> {
    const pricing = await getServicePricing(serviceType)
    return pricing?.nerdCoinReward || 0
}

/**
 * Tính phụ trội (Surcharge) khi quá giờ - đọc từ database
 */
export async function calculateSurchargeFromDB(
    serviceType: ServiceType,
    actualDuration: number,
    scheduledDuration: number,
    guests: number = 1
): Promise<number> {
    const overtimeMinutes = actualDuration - scheduledDuration
    if (overtimeMinutes <= SYSTEM_CONFIG.GRACE_PERIOD_MINUTES) return 0

    const pricing = await getServicePricing(serviceType)
    if (!pricing) return 0

    if (serviceType === 'MEETING') {
        // Meeting: Làm tròn lên theo block 1h
        const overtimeHours = Math.ceil(overtimeMinutes / 60)
        const { pricePerHour } = resolveMeetingPricePerHour(guests, pricing)
        return overtimeHours * pricePerHour
    }

    // Pod: Tính theo phút dựa trên giá giờ thứ 2 trở đi
    const extraHours = overtimeMinutes / 60
    return Math.round((pricing.pricePerHour || 0) * extraHours)
}

/**
 * Tạo breakdown chi tiết từ database
 */
export async function getPriceBreakdownFromDB(
    serviceType: ServiceType,
    durationMinutes: number,
    guests: number = 1
) {
    const pricing = await getServicePricing(serviceType)
    if (!pricing) {
        throw new Error(`${serviceType} pricing not found`)
    }

    const hours = durationMinutes / 60

    if (serviceType === 'MEETING') {
        const { pricePerHour, label } = resolveMeetingPricePerHour(guests, pricing)
        return {
            type: 'MEETING',
            pricePerHour,
            hours,
            guestTier: label,
        }
    }

    return {
        type: serviceType,
        firstHourPrice: pricing.priceFirstHour || 0,
        perHourPrice: pricing.pricePerHour || 0,
        hours,
        extraMinutes: Math.max(0, durationMinutes - 60),
    }
}
