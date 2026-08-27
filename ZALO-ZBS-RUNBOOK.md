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

ZALO_ZBS_TEMPLATE_CHECK_IN_SUB=
ZALO_ZBS_TEMPLATE_CHECK_IN_WALLET=
ZALO_ZBS_TEMPLATE_CHECK_OUT_SUB=
ZALO_ZBS_TEMPLATE_CHECK_OUT_WALLET=
ZALO_ZBS_TEMPLATE_BLOCK_CHECKIN=
```

`ZALO_TOKEN_ENCRYPTION_KEY` must be a unique random value of at least 32 characters. The initial refresh token is bootstrapped from the environment. Every rotated access/refresh token pair is encrypted and stored in `ZaloOAuthCredential`.

`ZALO_OA_ACCESS_TOKEN` remains available only as a short-lived fallback when the four OAuth variables are not configured.

## 3. Template parameter contracts

Create and approve the templates with exactly these parameter names:

| Template           | Required parameters                                                       |
| ------------------ | ------------------------------------------------------------------------- |
| `CHECK_IN_SUB`     | `customer_name`, `branch`, `remaining_time`                               |
| `CHECK_IN_WALLET`  | `customer_name`, `branch`, `wallet_balance`                               |
| `CHECK_OUT_SUB`    | `customer_name`, `branch`, `duration`, `remaining_time`                   |
| `CHECK_OUT_WALLET` | `customer_name`, `branch`, `duration`, `amount_charged`, `wallet_balance` |
| `BLOCK_CHECKIN`    | `customer_name`, `branch`, `amount_due`, `message`                        |

The time values are minutes. Money values are integer VND strings without separators.

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
- A scan request generates a deterministic tracking ID, so retrying the same request does not charge/send twice after a successful send.
- Zalo error `-124` triggers one forced OAuth refresh and one resend attempt.
- If the refresh token expires or authorization is revoked, obtain a new token pair and replace `ZALO_OA_REFRESH_TOKEN`; clear the `primary` row in `ZaloOAuthCredential` only as part of that controlled re-authorization procedure.
