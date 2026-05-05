-- Keep legacy Subscriber wallet fields in sync with the current Prisma schema.
-- Some production databases were created before these columns were tracked by migrations.

ALTER TABLE "Subscriber"
ADD COLUMN IF NOT EXISTS "walletCode" TEXT;

ALTER TABLE "Subscriber"
ADD COLUMN IF NOT EXISTS "walletBalance" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Subscriber_walletCode_idx" ON "Subscriber"("walletCode");
