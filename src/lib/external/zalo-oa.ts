import { prisma } from '@/lib/prisma'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSecretKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'

const ZBS_SEND_URL = 'https://business.openapi.zalo.me/message/template'
const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token'
const ACCESS_TOKEN_SKEW_MS = 5 * 60 * 1000
const PENDING_DEDUPLICATION_MS = 60 * 1000
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export const ZALO_TEMPLATE_TYPES = ['SUBSCRIPTION_SUCCESS', 'OVERAGE_DEBT', 'BLOCK_DEBT', 'SUB_EXPIRING'] as const

export type ZaloTemplateType = (typeof ZALO_TEMPLATE_TYPES)[number]

export interface ZaloSendOptions {
  trackingId?: string
  developmentMode?: boolean
}

export interface ZaloSendResult {
  success: boolean
  trackingId: string
  messageId?: string
  skipped?: boolean
}

interface ZbsApiResponse {
  error: number
  message?: string
  data?: {
    msg_id?: string
    sent_time?: string
    sending_mode?: string
    quota?: {
      dailyQuota?: string
      remainingQuota?: string
    }
  }
}

interface ZaloOAuthResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: string | number
  refresh_token_expires_in?: string | number
  error?: number
  error_name?: string
  error_reason?: string
  message?: string
}

export interface ZaloDeliveryEvent {
  event_name?: string
  app_id?: string
  timestamp?: string
  message?: {
    delivery_time?: string
    msg_id?: string
    tracking_id?: string
  }
}

const TEMPLATE_ENV_KEYS: Record<ZaloTemplateType, string> = {
  SUBSCRIPTION_SUCCESS: 'ZALO_ZBS_TEMPLATE_SUBSCRIPTION_SUCCESS',
  OVERAGE_DEBT: 'ZALO_ZBS_TEMPLATE_OVERAGE_DEBT',
  BLOCK_DEBT: 'ZALO_ZBS_TEMPLATE_BLOCK_DEBT',
  SUB_EXPIRING: 'ZALO_ZBS_TEMPLATE_SUB_EXPIRING',
}

export class ZaloConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ZaloConfigurationError'
  }
}

export class ZaloProviderError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message)
    this.name = 'ZaloProviderError'
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new ZaloConfigurationError(`Missing ${name}`)
  return value
}

function requestTimeoutMs() {
  const configured = Number(process.env.ZALO_ZBS_REQUEST_TIMEOUT_MS)
  return Number.isFinite(configured) && configured >= 1_000 ? configured : DEFAULT_REQUEST_TIMEOUT_MS
}

function templateIdFor(type: ZaloTemplateType) {
  return requireEnv(TEMPLATE_ENV_KEYS[type])
}

function maskPhone(phone: string) {
  return `***${phone.slice(-4)}`
}

function providerMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return String(error).slice(0, 500)
}

export function normalizeVietnamPhone(input: string) {
  const normalized = input.trim().replace(/[\s().-]/g, '')
  const digits = normalized.startsWith('+') ? normalized.slice(1) : normalized

  if (!/^\d+$/.test(digits)) {
    throw new ZaloConfigurationError('Invalid recipient phone number')
  }

  if (/^0\d{9}$/.test(digits)) return `84${digits.slice(1)}`
  if (/^84\d{9}$/.test(digits)) return digits

  throw new ZaloConfigurationError('Vietnam phone must use 0xxxxxxxxx or 84xxxxxxxxx format')
}

export function createZbsTrackingId(type: ZaloTemplateType, seed: string = randomUUID()) {
  const digest = createHash('sha256').update(seed).digest('hex').slice(0, 20)
  return `nerd_${type.toLowerCase()}_${digest}`.slice(0, 48)
}

function encryptionKey() {
  const secret = requireEnv('ZALO_TOKEN_ENCRYPTION_KEY')
  if (secret.length < 32) {
    throw new ZaloConfigurationError('ZALO_TOKEN_ENCRYPTION_KEY must contain at least 32 characters')
  }
  return createSecretKey(createHash('sha256').update(secret).digest('hex'), 'hex')
}

function encryptToken(value: string) {
  const iv = Uint8Array.from(randomBytes(12))
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = cipher.update(value, 'utf8', 'hex') + cipher.final('hex')
  const tag = cipher.getAuthTag()
  return ['v1', Buffer.from(iv).toString('hex'), tag.toString('hex'), ciphertext].join(':')
}

function decryptToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new ZaloConfigurationError('Stored Zalo token has an unsupported encryption format')
  }

  const iv = Uint8Array.from(Buffer.from(ivValue, 'hex'))
  const tag = Uint8Array.from(Buffer.from(tagValue, 'hex'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertextValue, 'hex', 'utf8') + decipher.final('utf8')
}

function oauthConfiguration() {
  const names = ['ZALO_APP_ID', 'ZALO_APP_SECRET', 'ZALO_OA_REFRESH_TOKEN', 'ZALO_TOKEN_ENCRYPTION_KEY'] as const
  const present = names.filter((name) => Boolean(process.env[name]?.trim()))

  if (present.length === 0) return null
  if (present.length !== names.length) {
    const missing = names.filter((name) => !process.env[name]?.trim())
    throw new ZaloConfigurationError(`Incomplete Zalo OAuth configuration; missing ${missing.join(', ')}`)
  }

  return {
    appId: requireEnv('ZALO_APP_ID'),
    appSecret: requireEnv('ZALO_APP_SECRET'),
    bootstrapRefreshToken: requireEnv('ZALO_OA_REFRESH_TOKEN'),
  }
}

async function fetchJson(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs())
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const raw = await response.text()
    let body: unknown
    try {
      body = raw ? JSON.parse(raw) : {}
    } catch {
      throw new ZaloProviderError(`Zalo returned a non-JSON response (HTTP ${response.status})`)
    }
    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshOAuthAccessToken(forceRefresh = false) {
  const config = oauthConfiguration()
  if (!config) return null

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'zalo_oauth_refresh'}))`

      const stored = await tx.zaloOAuthCredential.findUnique({ where: { id: 'primary' } })
      if (!forceRefresh && stored && stored.accessTokenExpiresAt.getTime() > Date.now() + ACCESS_TOKEN_SKEW_MS) {
        return decryptToken(stored.accessTokenCiphertext)
      }

      const refreshToken = stored ? decryptToken(stored.refreshTokenCiphertext) : config.bootstrapRefreshToken
      const body = new URLSearchParams({
        refresh_token: refreshToken,
        app_id: config.appId,
        grant_type: 'refresh_token',
      })
      const { response, body: responseBody } = await fetchJson(ZALO_OAUTH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          secret_key: config.appSecret,
        },
        body,
      })
      const token = responseBody as ZaloOAuthResponse

      if (!response.ok || !token.access_token || !token.refresh_token) {
        const detail = token.error_reason || token.error_name || token.message || `HTTP ${response.status}`
        throw new ZaloProviderError(`Unable to refresh Zalo OA token: ${detail}`, token.error)
      }

      const expiresInSeconds = Number(token.expires_in || 90_000)
      const refreshExpiresInSeconds = Number(token.refresh_token_expires_in)
      const now = Date.now()
      const accessTokenExpiresAt = new Date(now + expiresInSeconds * 1000)
      const refreshTokenExpiresAt =
        Number.isFinite(refreshExpiresInSeconds) && refreshExpiresInSeconds > 0
          ? new Date(now + refreshExpiresInSeconds * 1000)
          : new Date(now + DEFAULT_REFRESH_TOKEN_TTL_MS)

      await tx.zaloOAuthCredential.upsert({
        where: { id: 'primary' },
        update: {
          accessTokenCiphertext: encryptToken(token.access_token),
          refreshTokenCiphertext: encryptToken(token.refresh_token),
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
        },
        create: {
          id: 'primary',
          accessTokenCiphertext: encryptToken(token.access_token),
          refreshTokenCiphertext: encryptToken(token.refresh_token),
          accessTokenExpiresAt,
          refreshTokenExpiresAt,
        },
      })

      return token.access_token
    },
    { maxWait: 5_000, timeout: 20_000 }
  )
}

async function getZaloAccessToken(forceRefresh = false) {
  const oauthToken = await refreshOAuthAccessToken(forceRefresh)
  if (oauthToken) return oauthToken
  return requireEnv('ZALO_OA_ACCESS_TOKEN')
}

async function beginMessageLog(input: {
  trackingId: string
  templateType: ZaloTemplateType
  templateId: string
  recipientLast4: string
}) {
  const existing = await prisma.zbsMessageLog.findUnique({ where: { trackingId: input.trackingId } })
  if (existing?.status === 'SENT' || existing?.status === 'DELIVERED') {
    return { proceed: false, existing }
  }
  if (existing?.status === 'PENDING' && Date.now() - existing.updatedAt.getTime() < PENDING_DEDUPLICATION_MS) {
    return { proceed: false, existing }
  }

  const log = await prisma.zbsMessageLog.upsert({
    where: { trackingId: input.trackingId },
    update: {
      status: 'PENDING',
      templateType: input.templateType,
      templateId: input.templateId,
      recipientLast4: input.recipientLast4,
      providerErrorCode: null,
      providerMessage: null,
      attempts: { increment: 1 },
    },
    create: {
      ...input,
      status: 'PENDING',
      attempts: 1,
    },
  })
  return { proceed: true, existing: log }
}

async function requestZbsMessage(input: {
  accessToken: string
  phone: string
  templateId: string
  templateData: Record<string, string>
  trackingId: string
  developmentMode?: boolean
}) {
  const { response, body } = await fetchJson(ZBS_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: input.accessToken,
    },
    body: JSON.stringify({
      phone: input.phone,
      template_id: input.templateId,
      template_data: input.templateData,
      tracking_id: input.trackingId,
      ...(input.developmentMode ? { mode: 'development' } : {}),
    }),
  })
  const result = body as ZbsApiResponse
  if (!response.ok && typeof result.error !== 'number') {
    throw new ZaloProviderError(`ZBS request failed with HTTP ${response.status}`)
  }
  return result
}

export async function sendZaloNotification(
  phone: string,
  type: ZaloTemplateType,
  data: Record<string, string>,
  options: ZaloSendOptions = {}
): Promise<ZaloSendResult> {
  const normalizedPhone = normalizeVietnamPhone(phone)
  const templateId = templateIdFor(type)
  const trackingId = options.trackingId || createZbsTrackingId(type)
  const recipientLast4 = normalizedPhone.slice(-4)
  const log = await beginMessageLog({ trackingId, templateType: type, templateId, recipientLast4 })

  if (!log.proceed) {
    return {
      success: log.existing.status === 'SENT' || log.existing.status === 'DELIVERED',
      trackingId,
      messageId: log.existing.providerMessageId || undefined,
      skipped: true,
    }
  }

  try {
    let accessToken = await getZaloAccessToken()
    let result = await requestZbsMessage({
      accessToken,
      phone: normalizedPhone,
      templateId,
      templateData: data,
      trackingId,
      developmentMode: options.developmentMode,
    })

    if (result.error === -124 && oauthConfiguration()) {
      accessToken = await getZaloAccessToken(true)
      await prisma.zbsMessageLog.update({
        where: { trackingId },
        data: { attempts: { increment: 1 } },
      })
      result = await requestZbsMessage({
        accessToken,
        phone: normalizedPhone,
        templateId,
        templateData: data,
        trackingId,
        developmentMode: options.developmentMode,
      })
    }

    if (result.error !== 0 || !result.data?.msg_id) {
      throw new ZaloProviderError(result.message || 'ZBS rejected the message', result.error)
    }

    await prisma.zbsMessageLog.update({
      where: { trackingId },
      data: {
        status: 'SENT',
        providerMessageId: result.data.msg_id,
        providerErrorCode: null,
        providerMessage: result.message || 'Success',
        sentAt: result.data.sent_time ? new Date(Number(result.data.sent_time)) : new Date(),
      },
    })
    console.info(`[ZBS] Sent ${type} to ${maskPhone(normalizedPhone)} (${trackingId})`)
    return { success: true, trackingId, messageId: result.data.msg_id }
  } catch (error) {
    await prisma.zbsMessageLog
      .update({
        where: { trackingId },
        data: {
          status: 'FAILED',
          providerErrorCode: error instanceof ZaloProviderError ? error.code : undefined,
          providerMessage: providerMessage(error),
        },
      })
      .catch((logError) => console.error('[ZBS] Unable to persist send failure:', providerMessage(logError)))
    console.error(`[ZBS] Failed ${type} to ${maskPhone(normalizedPhone)} (${trackingId}):`, providerMessage(error))
    throw error
  }
}

export function verifyZaloWebhookSignature(rawBody: string, event: ZaloDeliveryEvent, signature: string | null) {
  const secret = process.env.ZALO_OA_SECRET_KEY?.trim()
  const expectedAppId = process.env.ZALO_APP_ID?.trim()
  if (!secret || !expectedAppId || !signature || event.app_id !== expectedAppId || !event.timestamp) return false

  const expected = createHash('sha256').update(`${event.app_id}${rawBody}${event.timestamp}${secret}`).digest('hex')
  const received = signature.replace(/^mac=/i, '').trim().toLowerCase()
  const expectedBuffer = new TextEncoder().encode(expected)
  const receivedBuffer = new TextEncoder().encode(received)
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export async function recordZaloDelivery(event: ZaloDeliveryEvent) {
  if (event.event_name !== 'user_received_message') return false
  const trackingId = event.message?.tracking_id
  const messageId = event.message?.msg_id
  if (!trackingId && !messageId) return false

  const deliveryTime = Number(event.message?.delivery_time)
  const deliveredAt = Number.isFinite(deliveryTime) ? new Date(deliveryTime) : new Date()
  const match = trackingId ? { trackingId } : { providerMessageId: messageId }
  const existing = await prisma.zbsMessageLog.findFirst({ where: match })
  if (!existing) return false

  await prisma.zbsMessageLog.update({
    where: { id: existing.id },
    data: {
      status: 'DELIVERED',
      deliveredAt,
      providerMessageId: messageId || existing.providerMessageId,
    },
  })
  return true
}
