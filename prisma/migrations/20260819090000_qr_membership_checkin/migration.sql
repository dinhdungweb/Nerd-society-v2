-- QR membership check-in. Legacy MyTime/card identifiers remain readable.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SubscriptionSession"
    WHERE "checkOutTime" IS NULL AND "status" = 'ACTIVE'
    GROUP BY "subscriberId"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate active sessions found; reconcile them before applying the QR migration.';
  END IF;
END $$;

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'QR_ISSUED';

CREATE TYPE "QrCredentialStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "MembershipScanOutcome" AS ENUM (
  'CHECK_IN_SUCCESS',
  'CHECK_OUT_SUCCESS',
  'DUPLICATE_IGNORED',
  'BLOCK_CROSS_BRANCH',
  'BLOCK_DEBT',
  'BLOCK_EXPIRED',
  'BLOCK_DAILY_LIMIT',
  'BLOCK_LOW_BALANCE',
  'INVALID_QR',
  'REVOKED_QR',
  'NO_ELIGIBLE_ACCOUNT'
);

ALTER TABLE "Location" ADD COLUMN "code" TEXT;
UPDATE "Location"
SET "code" = CASE
  WHEN upper("name") LIKE '%HỒ TÙNG MẬU%' OR upper("name") LIKE '%HO TUNG MAU%' OR upper("name") = 'HTM' THEN 'HTM'
  WHEN upper("name") LIKE '%TÂY SƠN%' OR upper("name") LIKE '%TAY SON%' OR upper("name") = 'TS' THEN 'TS'
  ELSE 'LOC-' || substr(md5("id"), 1, 8)
END;
ALTER TABLE "Location" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

ALTER TABLE "DailyUsage"
  ADD COLUMN "quotaMin" INTEGER,
  ADD COLUMN "overageMin" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "amountCharged" INTEGER NOT NULL DEFAULT 0;

UPDATE "SubscriptionSession" SET "source" = 'legacy_card' WHERE "source" = 'card';
ALTER TABLE "SubscriptionSession" ALTER COLUMN "source" SET DEFAULT 'legacy_card';

CREATE TABLE "MembershipQrCredential" (
  "id" TEXT NOT NULL,
  "subscriberId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "QrCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "MembershipQrCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipScan" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "credentialId" TEXT,
  "subscriberId" TEXT,
  "locationId" TEXT NOT NULL,
  "performedById" TEXT NOT NULL,
  "sessionId" TEXT,
  "outcome" "MembershipScanOutcome" NOT NULL,
  "payloadFingerprint" TEXT,
  "latencyMs" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB NOT NULL,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MembershipQrCredential_subscriberId_key" ON "MembershipQrCredential"("subscriberId");
CREATE UNIQUE INDEX "MembershipQrCredential_publicId_key" ON "MembershipQrCredential"("publicId");
CREATE INDEX "MembershipQrCredential_status_idx" ON "MembershipQrCredential"("status");
CREATE INDEX "MembershipQrCredential_issuedAt_idx" ON "MembershipQrCredential"("issuedAt");
CREATE UNIQUE INDEX "MembershipScan_requestId_key" ON "MembershipScan"("requestId");
CREATE INDEX "MembershipScan_subscriberId_scannedAt_idx" ON "MembershipScan"("subscriberId", "scannedAt");
CREATE INDEX "MembershipScan_credentialId_scannedAt_idx" ON "MembershipScan"("credentialId", "scannedAt");
CREATE INDEX "MembershipScan_locationId_scannedAt_idx" ON "MembershipScan"("locationId", "scannedAt");
CREATE INDEX "MembershipScan_outcome_scannedAt_idx" ON "MembershipScan"("outcome", "scannedAt");

ALTER TABLE "MembershipQrCredential"
  ADD CONSTRAINT "MembershipQrCredential_subscriberId_fkey"
  FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipScan"
  ADD CONSTRAINT "MembershipScan_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "MembershipQrCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipScan"
  ADD CONSTRAINT "MembershipScan_subscriberId_fkey"
  FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembershipScan"
  ADD CONSTRAINT "MembershipScan_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipScan"
  ADD CONSTRAINT "MembershipScan_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MembershipScan"
  ADD CONSTRAINT "MembershipScan_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "SubscriptionSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fail fast if legacy data already has duplicate open sessions; reconcile those
-- records before applying this invariant rather than silently closing sessions.
CREATE UNIQUE INDEX "SubscriptionSession_one_open_per_subscriber"
ON "SubscriptionSession"("subscriberId")
WHERE "checkOutTime" IS NULL AND "status" = 'ACTIVE';
