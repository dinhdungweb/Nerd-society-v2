import { prisma } from '@/lib/prisma'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto'

const QR_PREFIX = 'NS1'

function signingSecret() {
  const secret = process.env.QR_SIGNING_SECRET
  if (secret && secret.length >= 32) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('QR_SIGNING_SECRET must contain at least 32 characters in production')
  }
  if (secret) console.warn('[QR] QR_SIGNING_SECRET should contain at least 32 characters')
  return 'development-only-qr-secret-change-me'
}

function signatureFor(publicId: string, version: number) {
  return createHmac('sha256', signingSecret())
    .update(`${QR_PREFIX}.${publicId}.${version}`)
    .digest('base64url')
}

export function buildMembershipQrPayload(input: { publicId: string; version: number }) {
  return `${QR_PREFIX}.${input.publicId}.${input.version}.${signatureFor(input.publicId, input.version)}`
}

export function fingerprintQrPayload(payload: string) {
  return createHash('sha256').update(payload).digest('hex')
}

export function verifyMembershipQrPayload(payload: string) {
  const [prefix, publicId, versionText, suppliedSignature, ...extra] = payload.trim().split('.')
  const version = Number(versionText)
  if (
    prefix !== QR_PREFIX ||
    !publicId ||
    !Number.isSafeInteger(version) ||
    version < 1 ||
    !suppliedSignature ||
    extra.length > 0
  ) {
    return null
  }

  const expected = Uint8Array.from(Buffer.from(signatureFor(publicId, version)))
  const supplied = Uint8Array.from(Buffer.from(suppliedSignature))
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  return { publicId, version }
}

export async function ensureMembershipQrCredential(subscriberId: string) {
  const existing = await prisma.membershipQrCredential.findUnique({ where: { subscriberId } })
  const credential =
    existing ||
    (await prisma.membershipQrCredential.create({
      data: { subscriberId, publicId: randomUUID() },
    }))

  return {
    credential,
    payload: buildMembershipQrPayload(credential),
  }
}

export async function rotateMembershipQrCredential(subscriberId: string) {
  const existing = await prisma.membershipQrCredential.findUnique({ where: { subscriberId } })
  const credential = existing
    ? await prisma.membershipQrCredential.update({
        where: { id: existing.id },
        data: {
          version: { increment: 1 },
          status: 'ACTIVE',
          rotatedAt: new Date(),
          lastUsedAt: null,
        },
      })
    : await prisma.membershipQrCredential.create({
        data: { subscriberId, publicId: randomUUID() },
      })

  return {
    credential,
    payload: buildMembershipQrPayload(credential),
  }
}

export async function revokeMembershipQrCredential(subscriberId: string) {
  return prisma.membershipQrCredential.update({
    where: { subscriberId },
    data: { status: 'REVOKED', rotatedAt: new Date() },
  })
}
