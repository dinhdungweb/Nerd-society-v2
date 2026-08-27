# Zalo ZBS integration runbook

## 1. Zalo prerequisites

1. Verify the Zalo OA business account.
2. Use an OA Growth or Comprehensive plan with OpenAPI access.
3. Link the OA to a ZBS Account and ensure the ZBS balance is funded.
4. Activate the application in Zalo for Developers and grant it permission to send by phone number.
5. Obtain the initial OA refresh token through OAuth v4 or Zalo API Explorer.

Do not commit tokens or secrets. Configure them only in the production secret store.

## 2. Required environment variables

```dotenv
ZALO_APP_ID=
ZALO_APP_SECRET=
ZALO_OA_REFRESH_TOKEN=
ZALO_TOKEN_ENCRYPTION_KEY=
ZALO_OA_SECRET_KEY=

ZALO_ZBS_TEMPLATE_SUBSCRIPTION_SUCCESS=
ZALO_ZBS_TEMPLATE_OVERAGE_DEBT=
ZALO_ZBS_TEMPLATE_BLOCK_DEBT=
ZALO_ZBS_TEMPLATE_SUB_EXPIRING=
```

`ZALO_TOKEN_ENCRYPTION_KEY` must be a unique random value of at least 32 characters. The initial refresh token is bootstrapped from the environment. Every rotated access/refresh token pair is encrypted and stored in `ZaloOAuthCredential`.

`ZALO_OA_ACCESS_TOKEN` remains available only as a short-lived fallback when the four OAuth variables are not configured.

## 3. Template parameter contracts

Create and approve the templates with exactly these parameter names:

| Template               | Required parameters                                                      |
| ---------------------- | ------------------------------------------------------------------------ |
| `SUBSCRIPTION_SUCCESS` | `customer_name`, `action`, `plan_name`, `branch`, `expiry_date`          |
| `OVERAGE_DEBT`         | `customer_name`, `branch`, `overage_minutes`, `amount_due`, `total_debt` |
| `BLOCK_DEBT`           | `customer_name`, `branch`, `amount_due`                                  |
| `SUB_EXPIRING`         | `customer_name`, `plan_name`, `expiry_date`, `days_remaining`            |

The time values are minutes. Money values are integer VND strings without separators.

No ZBS message is sent for ordinary check-in/check-out, unpaid-debt reminders, successful debt payments, low wallet balance, or non-debt check-in blocks.

## 4. Deploy

```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
```

Configure the Zalo application delivery webhook as:

```text
https://<production-domain>/api/webhooks/zalo/zbs
```

The webhook verifies `X-ZEvent-Signature` before updating `ZbsMessageLog` from `SENT` to `DELIVERED`.

## 5. Test safely

Run local contract tests:

```powershell
npm run test:zbs
```

For a real Zalo development-mode send, use an approved test template and an application/OA administrator phone number. Never use a customer phone until the template, balance, OA package, and production permissions have been confirmed.

## 6. Operations

- `ZbsMessageLog` stores only the last four phone digits, tracking ID, provider message ID, status, and errors.
- Subscription/order/session IDs generate deterministic tracking IDs, so retrying the same business event does not charge/send twice after a successful send.
- Subscription maintenance sends the expiry reminder only for active subscriptions whose end date is exactly three business days away. It runs every 15 minutes and the tracking ID prevents duplicates.
- Zalo error `-124` triggers one forced OAuth refresh and one resend attempt.
- If the refresh token expires or authorization is revoked, obtain a new token pair and replace `ZALO_OA_REFRESH_TOKEN`; clear the `primary` row in `ZaloOAuthCredential` only as part of that controlled re-authorization procedure.
