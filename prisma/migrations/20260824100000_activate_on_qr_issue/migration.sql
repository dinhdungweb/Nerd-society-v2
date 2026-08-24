-- Membership validity starts when the QR is issued, not on the first scan.
-- Backfill legacy pending subscriptions that already have a QR credential.

WITH pending_with_qr AS (
  SELECT
    subscription."id",
    COALESCE(
      (
        SELECT registration."assignedAt"
        FROM "RegistrationOrder" registration
        WHERE registration."subscriptionId" = subscription."id"
          AND registration."assignedAt" IS NOT NULL
          AND registration."orderStatus" IN ('QR_ISSUED', 'ACTIVATED')
        ORDER BY registration."assignedAt" DESC
        LIMIT 1
      ),
      credential."issuedAt",
      subscription."purchasedAt"
    ) AS "issuedAt",
    CASE
      WHEN subscription."planType" = 'WEEKLY_LIMITED' THEN 7
      ELSE 30
    END AS "durationDays"
  FROM "Subscription" subscription
  INNER JOIN "MembershipQrCredential" credential
    ON credential."subscriberId" = subscription."subscriberId"
  WHERE subscription."status" = 'PENDING_ACTIVATION'
)
UPDATE "Subscription" subscription
SET
  "status" = 'ACTIVE',
  "activationDate" = pending."issuedAt",
  "startDate" = (
    pending."issuedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'
  )::date,
  "endDate" = (
    (
      pending."issuedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh'
    )::date + pending."durationDays"
  )::date,
  "activationDeadline" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM pending_with_qr pending
WHERE subscription."id" = pending."id";

UPDATE "RegistrationOrder" registration
SET "orderStatus" = 'ACTIVATED'
WHERE registration."orderStatus" IN ('QR_ISSUED', 'CARD_ASSIGNED')
  AND EXISTS (
    SELECT 1
    FROM "Subscription" subscription
    WHERE subscription."id" = registration."subscriptionId"
      AND subscription."status" = 'ACTIVE'
  );
