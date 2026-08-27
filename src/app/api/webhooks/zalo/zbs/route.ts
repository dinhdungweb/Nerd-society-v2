import { recordZaloDelivery, verifyZaloWebhookSignature, type ZaloDeliveryEvent } from '@/lib/external/zalo-oa'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const rawBody = await request.text()
  let event: ZaloDeliveryEvent

  if (!rawBody.trim()) {
    return NextResponse.json({ success: true, ignored: true })
  }

  try {
    event = JSON.parse(rawBody) as ZaloDeliveryEvent
  } catch {
    return NextResponse.json({ success: true, ignored: true })
  }

  const signature = request.headers.get('x-zevent-signature')
  if (!verifyZaloWebhookSignature(rawBody, event, signature)) {
    console.warn('[ZBS Webhook] Ignored an unsigned or invalid event')
    return NextResponse.json({ success: true, ignored: true })
  }

  try {
    const updated = await recordZaloDelivery(event)
    return NextResponse.json({ success: true, updated })
  } catch (error) {
    console.error('[ZBS Webhook] Unable to record delivery:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Unable to record delivery event' }, { status: 500 })
  }
}
