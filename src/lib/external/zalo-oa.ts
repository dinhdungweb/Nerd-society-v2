/**
 * Zalo OA Notification Service
 */

const ZALO_OA_ACCESS_TOKEN = process.env.ZALO_OA_ACCESS_TOKEN;
const ZALO_OA_API_URL = 'https://openapi.zalo.me/v3.0/oa/message/transaction';

export type ZaloTemplateType = 
  | 'CHECK_IN_SUB' 
  | 'CHECK_IN_WALLET' 
  | 'CHECK_OUT_SUB' 
  | 'CHECK_OUT_WALLET'
  | 'OVERAGE_WARNING'
  | 'LOW_BALANCE'
  | 'PAYMENT_RECEIVED'
  | 'SUB_EXPIRING';

interface ZaloMessagePayload {
  recipient: {
    user_id?: string;
    phone?: string;
  };
  message: {
    template_id: string;
    template_data: Record<string, string>;
  };
}

/**
 * Gửi thông báo qua Zalo OA
 */
export async function sendZaloNotification(phone: string, type: ZaloTemplateType, data: Record<string, string>) {
  console.log(`[Zalo OA] Sending ${type} to ${phone}`, data);
  
  if (!ZALO_OA_ACCESS_TOKEN) {
    console.warn('[Zalo OA] Access Token missing, skipping live notification.');
    return;
  }

  // Chú ý: Cần đăng ký template với Zalo OA trước và lấy Template ID
  const templateIdMap: Record<ZaloTemplateType, string> = {
    CHECK_IN_SUB: 'template_001',
    CHECK_IN_WALLET: 'template_002',
    CHECK_OUT_SUB: 'template_003',
    CHECK_OUT_WALLET: 'template_004',
    OVERAGE_WARNING: 'template_005',
    LOW_BALANCE: 'template_006',
    PAYMENT_RECEIVED: 'template_007',
    SUB_EXPIRING: 'template_008',
  };

  try {
    const payload: ZaloMessagePayload = {
      recipient: { phone: phone.startsWith('0') ? '84' + phone.substring(1) : phone },
      message: {
        template_id: templateIdMap[type],
        template_data: data
      }
    };

    const res = await fetch(ZALO_OA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ZALO_OA_ACCESS_TOKEN
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.error !== 0) {
      console.error('[Zalo OA] Error response:', result);
    }
    return result;
  } catch (error) {
    console.error('[Zalo OA] Failed to send notification:', error);
  }
}
