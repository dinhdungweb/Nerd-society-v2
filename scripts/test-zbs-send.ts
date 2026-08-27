import {
  createZbsTrackingId,
  sendZaloNotification,
  ZALO_TEMPLATE_TYPES,
  type ZaloTemplateType,
} from '@/lib/external/zalo-oa'
import { prisma } from '@/lib/prisma'

const SAMPLE_DATA: Record<ZaloTemplateType, Record<string, string>> = {
  SUBSCRIPTION_SUCCESS: {
    customer_name: 'Khách kiểm thử',
    action: 'Đăng ký mới',
    plan_name: 'Gói Tháng Limited',
    branch: 'HTM',
    expiry_date: '01/10/2026',
  },
  OVERAGE_DEBT: {
    customer_name: 'Khách kiểm thử',
    branch: 'HTM',
    overage_minutes: '30',
    amount_due: '7500',
    total_debt: '7500',
  },
  BLOCK_DEBT: {
    customer_name: 'Khách kiểm thử',
    branch: 'HTM',
    amount_due: '30000',
  },
  SUB_EXPIRING: {
    customer_name: 'Khách kiểm thử',
    plan_name: 'Gói Tháng Limited',
    expiry_date: '31/12/2026',
    days_remaining: '3',
  },
}

async function main() {
  const phone = process.env.ZALO_ZBS_TEST_PHONE?.trim()
  if (!phone) throw new Error('Missing ZALO_ZBS_TEST_PHONE')

  const requestedType = process.env.ZALO_ZBS_TEST_TYPE?.trim() || 'SUBSCRIPTION_SUCCESS'
  if (!ZALO_TEMPLATE_TYPES.includes(requestedType as ZaloTemplateType)) {
    throw new Error(`Unsupported ZALO_ZBS_TEST_TYPE: ${requestedType}`)
  }
  const type = requestedType as ZaloTemplateType
  const result = await sendZaloNotification(phone, type, SAMPLE_DATA[type], {
    developmentMode: true,
    trackingId: createZbsTrackingId(type, `development-${Date.now()}`),
  })
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
