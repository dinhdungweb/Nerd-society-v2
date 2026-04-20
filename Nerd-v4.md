# Nerd Society — Wallet & Subscription System Spec
## For Developer | v1.0 | 30/03/2026

---

# 1. OVERVIEW

Một hệ thống duy nhất xử lý 2 loại account:
- **Wallet**: khách nạp tiền trước, dùng dần (tính giờ × giá)
- **Subscription**: khách mua gói tháng 549k, unlimited, cap 8h/entry

Cả hai dùng chung: thẻ proximity (ZKTeco), flow check-in/out, notification, web portal.

---

# 2. DATABASE SCHEMA

```
TABLE: members
  id                  PK
  phone               UNIQUE, NOT NULL
  name                VARCHAR
  photo_url           VARCHAR         -- selfie lúc đăng ký (anti-sharing)
  card_id             VARCHAR UNIQUE  -- mã thẻ ZKTeco 125KHz
  branch_primary      ENUM('HTM','TS')
  created_at          TIMESTAMP
  
TABLE: accounts
  id                  PK
  member_id           FK → members
  type                ENUM('wallet', 'subscription')
  status              ENUM('active', 'expired', 'suspended')
  
  -- Wallet:
  balance             INT DEFAULT 0   -- VND, wallet only
  rate_per_hour       INT             -- VND/h, wallet only (default 15000)
  
  -- Subscription:
  plan                VARCHAR         -- 'monthly_unlimited'
  started_at          TIMESTAMP       -- ngày kích hoạt (first tap, NOT purchase date)
  expires_at          TIMESTAMP       -- started_at + 30 days
  daily_cap_minutes   INT DEFAULT 480 -- 8h
  discount_code       VARCHAR         -- code giảm 20% book phòng
  
  -- Shared:
  outstanding_balance INT DEFAULT 0   -- VND, tiền vượt giờ chưa thanh toán
  created_at          TIMESTAMP

TABLE: sessions
  id                  PK
  account_id          FK → accounts
  branch              ENUM('HTM', 'TS')
  check_in            TIMESTAMP
  check_out           TIMESTAMP NULL  -- null = đang active
  duration_minutes    INT NULL        -- tính khi check-out
  capped_minutes      INT NULL        -- phần nằm trong cap (sub only)
  overage_minutes     INT NULL        -- phần vượt cap (sub only)
  amount_charged      INT DEFAULT 0   -- VND
  status              ENUM('active', 'completed', 'force_closed')
  created_at          TIMESTAMP

TABLE: transactions
  id                  PK
  account_id          FK → accounts
  type                ENUM('topup', 'session_charge', 'overage_charge', 
                           'subscription_purchase', 'refund', 'overage_payment')
  amount              INT             -- VND (positive = credit, negative = debit)
  reference           VARCHAR         -- payment ref / session_id
  created_at          TIMESTAMP

TABLE: quick_calls      -- subscriber dùng pod/MR ≤15 phút
  id                  PK
  account_id          FK → accounts
  branch              ENUM('HTM', 'TS')
  room                VARCHAR         -- 'mono_pod', 'multi_pod', 'mr1', 'mr2'
  start_time          TIMESTAMP
  end_time            TIMESTAMP NULL
  duration_minutes    INT NULL
  logged_by           VARCHAR         -- staff name
  created_at          TIMESTAMP
```

---

# 3. CHECK-IN FLOW

```
Khách TAP THẺ VÀO
│
├─ Lookup card_id → member → account(s)
│  (1 member có thể có cả wallet + subscription)
│
├─ Chọn account ưu tiên:
│  1. Subscription active? → dùng subscription
│  2. Không có sub → dùng wallet
│  3. Không có gì active → ❌ reject
│
├─ SUBSCRIPTION CHECK:
│  │
│  ├─ status != 'active'?
│  │  → ❌ "Gói chưa kích hoạt hoặc đã hết hạn"
│  │
│  ├─ expires_at < now?
│  │  → Update status = 'expired'
│  │  → Fallback sang wallet nếu có
│  │  → Không có wallet → ❌ "Gói đã hết hạn [ngày]. Gia hạn tại [link]"
│  │
│  ├─ outstanding_balance > 0?
│  │  → ❌ "Vui lòng thanh toán [X]đ phí vượt giờ để check-in"
│  │  → Hiển thị QR thanh toán
│  │  → Sau khi nhận payment → outstanding = 0 → cho check-in
│  │
│  ├─ started_at IS NULL? (chưa kích hoạt)
│  │  → Set started_at = now, expires_at = now + 30 days
│  │  → Notify: "Gói tháng đã kích hoạt! HSD đến [date]"
│  │
│  ├─ Tính remaining today:
│  │  used_today = SUM(duration_minutes) WHERE 
│  │    account_id = X AND date(check_in) = today
│  │    (dùng calendar day cho đơn giản — xem note qua đêm bên dưới)
│  │  remaining = daily_cap_minutes - used_today
│  │
│  ├─ remaining <= 0?
│  │  → ❌ "Hôm nay đã dùng đủ 8h"
│  │
│  └─ remaining > 0?
│     → CREATE session (status = 'active')
│     → ✅ "Chào [tên]! Hôm nay còn [remaining/60]h"
│
├─ WALLET CHECK:
│  │
│  ├─ outstanding_balance > 0?
│  │  → ❌ "Vui lòng thanh toán [X]đ trước khi check-in: [link QR]"
│  │
│  ├─ balance < rate_per_hour? (không đủ cho 1h)
│  │  → ❌ "Số dư [X]đ không đủ. Nạp thêm tại [link]"
│  │
│  └─ balance >= rate_per_hour?
│     → CREATE session (status = 'active')
│     → ✅ "Chào [tên]! Số dư [balance]đ"
```

---

# 4. CHECK-OUT FLOW

```
Khách TAP THẺ RA
│
├─ Find active session (status = 'active', check_out IS NULL)
│
├─ Set check_out = now
├─ Calculate duration_minutes = ROUND((check_out - check_in) / 60)
│
├─ WALLET:
│  │
│  ├─ amount = CEIL(duration_minutes / 15) × (rate_per_hour / 4)
│  │  (làm tròn LÊN per 15 phút)
│  │  VD: 2h10m = 130 min → CEIL(130/15) = 9 → 9 × 3,750 = 33,750đ
│  │
│  ├─ balance >= amount?
│  │  → balance -= amount
│  │  → Create transaction (type = 'session_charge', amount = -amount)
│  │  → session: amount_charged = amount, status = 'completed'
│  │  → Notify: "Phiên [X]h[Y]m — Trừ [amount]đ — Còn [balance]đ"
│  │
│  └─ balance < amount? (hết tiền giữa phiên)
│     → Charge hết balance trước: paid = balance, balance = 0
│     → Phần thiếu: outstanding_balance += (amount - paid)
│     → session: amount_charged = paid, status = 'completed'
│     → Notify: "Phiên [X]h[Y]m — Còn thiếu [outstanding]đ. 
│              Thanh toán: [link QR]"
│
├─ SUBSCRIPTION:
│  │
│  ├─ Tính remaining = daily_cap - used_today_before_this_session
│  │
│  ├─ duration <= remaining? (trong cap)
│  │  → capped_minutes = duration, overage_minutes = 0
│  │  → amount_charged = 0
│  │  → status = 'completed'
│  │  → Notify: "Phiên [X]h[Y]m — Hôm nay còn [new_remaining]h"
│  │
│  └─ duration > remaining? (vượt cap)
│     → capped_minutes = remaining
│     → overage_minutes = duration - remaining
│     → overage_amount = CEIL(overage_minutes / 15) × (15000 / 4)
│     → outstanding_balance += overage_amount
│     → Create transaction (type = 'overage_charge', amount = -overage_amount)
│     → status = 'completed'
│     → Notify: "Phiên [X]h[Y]m — Vượt [overage]m = [overage_amount]đ
│              Thanh toán trước lần check-in sau: [link QR]"
```

---

# 5. CAP 8H — EDGE CASES

## 5.1. Quên check-out

```
CRON JOB chạy mỗi 30 phút:
  
  Find sessions WHERE status = 'active' AND check_in < (now - 10h)
  
  For each:
    → force check-out: check_out = check_in + 8h (cap)
    → duration_minutes = 480
    → status = 'force_closed'
    → Tính charge tương tự check-out flow bình thường
    → Notify: "Bạn quên tap ra — phiên tự đóng sau 8h"
```

## 5.2. Cảnh báo gần hết cap

```
CRON JOB chạy mỗi 5 phút:

  Find active subscription sessions WHERE:
    elapsed + used_today_before >= daily_cap - 30
    AND chưa gửi warning
    
  30 min trước cap:
  → Notify: "Còn 30 phút nữa là hết 8h hôm nay"
  
  Khi chạm cap:
  → Notify: "Đã hết 8h. Ngồi thêm sẽ tính giờ lẻ 15k/h, 
    cộng dồn thanh toán online"
  → Session vẫn TIẾP TỤC — KHÔNG auto-close
  → Phần vượt tính vào outstanding khi check-out
```

## 5.3. Re-entry cùng ngày

```
  Session 1: 9h → 13h = 4h (240 min)
  Session 2: 15h → system check: used_today = 240, remaining = 240 min
  → Cho vào: "Chào [tên]! Hôm nay còn 4h"
  → Nếu ngồi đến 19h → hết cap → ngồi thêm → tính giờ lẻ
```

## 5.4. Qua đêm

```
  Check-in 22h → thuộc ngày hôm đó (calendar day)
  → used_today (ngày check-in) += duration
  → Nếu ngồi đến 6h sáng = 8h → vừa đúng cap
  → Nếu ngồi đến 8h sáng = 10h → vượt 2h → tính phí 2h
  
  Ngày hôm sau (sau 0h) nếu check-in mới → daily cap reset = 8h mới
  
  NOTE: session qua đêm tính vào ngày CHECK-IN, không split 2 ngày
```

---

# 6. THANH TOÁN OUTSTANDING

```
Khách nhận notification vượt giờ → click link → payment page

PAGE hiển thị:
  "Phí vượt giờ: [amount]đ"
  "Phiên ngày [date]: vượt [overage]m"
  [QR Code VietQR — BIDV]
  
Payment received (webhook/manual check):
  → outstanding_balance = 0
  → Create transaction (type = 'overage_payment', amount = +amount)
  → Notify: "Đã nhận [amount]đ. Check-in bình thường!"

RULE: 
  outstanding_balance > 0 → BLOCK check-in (cả sub lẫn wallet)
  Nợ tối đa 1 lần → phải trả trước khi vào lần tiếp
```

---

# 7. WALLET TOP-UP & CHARGING

```
NẠP TIỀN:
  Web → chọn số tiền (hoặc nhập tự do) → QR VietQR (BIDV)
  → Webhook/manual → balance += amount
  → Create transaction (type = 'topup')
  → Notify: "Nạp thành công [amount]đ. Số dư [balance]đ"

RATE:
  Mặc định: 15,000đ/h (= giờ lẻ)
  Làm tròn: per 15 phút
  VD: 2h10m → charge 2h15m = 33,750đ
  
  Tương lai (phase 4+): rate tiers theo mức nạp
  VD: nạp ≥500k → rate = 13k/h (Bee equivalent)

SỐ DƯ THẤP:
  Balance < 1h × rate → Notify: "Số dư thấp, đủ ~[Y] phút"
  Balance = 0 khi đang trong session → phần vượt → outstanding
```

---

# 8. SUBSCRIPTION LIFECYCLE

```
MUA GÓI:
  Web / tại quán → thanh toán 549k
  → Create account: type='subscription', status='active', started_at=NULL
  → Create transaction (type='subscription_purchase', amount=+549000)
  → Nhận thẻ ZKTeco + chụp selfie + chọn locker

KÍCH HOẠT (first tap):
  → started_at = now, expires_at = now + 30 days
  → Notify: "Gói kích hoạt! HSD đến [date]"

NHẮC GIA HẠN:
  expires_at - 7 ngày → "Gói hết hạn [date]. Gia hạn: [link]"
  expires_at - 3 ngày → nhắc lại
  expires_at - 1 ngày → nhắc lần cuối

HẾT HẠN:
  → status = 'expired'
  → Nếu có wallet active → fallback sang wallet
  → Không → block check-in, mời gia hạn

GIA HẠN:
  Trước khi hết: expires_at = old_expires_at + 30 days (cộng dồn)
  Sau khi hết:   started_at = NULL (kích hoạt lại bằng first tap)

MINIMUM COMMITMENT: 2 tháng
  → Khi mua lần đầu: charge 549k × 2 = 1,098k
  → Hoặc: charge 549k + auto-renew tháng 2 (cần confirm)
```

---

# 9. SUBSCRIBER QUICK CALL (POD/MR)

```
≤15 PHÚT — MIỄN PHÍ, WALK-IN:
  Subscriber báo NV → NV check phòng trống → vào dùng
  NV log vào quick_calls table (hoặc Google Sheet phase 1)
  Tự canh 15 phút. Quá giờ → NV nhắc

>15 PHÚT — BOOK TRÊN WEB, GIẢM 20%:
  Book bình thường, nhập discount_code từ account
  Minimum booking: 1h
  Giá subscriber: Mono Pod 20k/h, Multi Pod 28k/h, MR 64k/h
  Vào schedule bình thường, không ảnh hưởng booking khác

DISCOUNT CODE:
  Gắn với account, chỉ hoạt động khi subscription status = 'active'
  1 code / subscriber, không transferable
```

---

# 10. NOTIFICATIONS (Zalo OA)

| Event | Message |
|-------|---------|
| Check-in (sub) | Chào [tên]! Hôm nay còn [X]h |
| Check-in (wallet) | Chào [tên]! Số dư [X]đ |
| Check-out (sub, OK) | Phiên [X]h[Y]m. Hôm nay còn [Z]h |
| Check-out (sub, vượt) | Phiên [X]h. Vượt [Y]m = [Z]đ. TT: [link] |
| Check-out (wallet) | Phiên [X]h[Y]m. Trừ [A]đ. Còn [B]đ |
| Gần hết cap | Còn 30 phút nữa là hết 8h hôm nay |
| Chạm cap | Đã hết 8h. Ngồi thêm tính 15k/h |
| Quên tap ra | Bạn quên tap ra — phiên tự đóng 8h |
| Wallet thấp | Số dư còn [X]đ, đủ ~[Y] phút |
| Sub 7 ngày trước HH | Gói hết hạn [date]. Gia hạn: [link] |
| Sub hết hạn | Gói đã hết hạn. Gia hạn: [link] |
| Block check-in (nợ) | Thanh toán [X]đ để check-in: [link QR] |
| Payment OK | Đã nhận [X]đ. Check-in bình thường! |
| Gói kích hoạt | Gói kích hoạt! HSD đến [date] |
| Top-up OK | Nạp [X]đ thành công. Số dư [Y]đ |

---

# 11. PHASE PLAN

| Phase | Scope | Khi nào |
|-------|-------|---------|
| **1** | Subscription only. Check-in/out thủ công (NV log Google Sheet). Zalo OA notify thủ công. 10-15 subs HTM. | Tuần 8 |
| **2** | ZKTeco integration. Auto check-in/out. Auto Zalo notifications. Outstanding payment web page. 30 subs. | Tuần 12 |
| **3** | Wallet launch. Web top-up (VietQR BIDV). Unified check-in flow. Mở cho tất cả khách. | Tuần 16+ |
| **4** | Dashboard analytics. Auto-renewal. Subscriber usage reports. Rate tiers cho wallet. | Tuần 20+ |

---

# 12. TECH STACK & NOTES

- **ZKTeco W666 Plus** (SN: 8116250900027): proximity 125KHz cards, integrate qua MyTime HRS REST API hoặc direct SDK
- **Payment**: VietQR qua BIDV (đã có auto-reconcile cho web booking)
- **Web**: build vào nerdsociety.com.vn hiện tại
- **Notifications**: Zalo OA API
- **Daily cap**: tính theo calendar day (session qua đêm = tính vào ngày check-in)
- **Rounding**: wallet charge per 15 phút, làm tròn LÊN
- **Concurrent sessions**: 1 member = 1 active session. Tap vào khi đang có session → auto check-out session cũ
- **Multi-branch**: subscription valid cả HTM + TS. Daily cap shared (4h HTM sáng → TS chiều còn 4h)
- **Anti-sharing**: photo_url + NV đối chiếu visual khi check-in

---

*Spec v1.0 — 30/03/2026*
