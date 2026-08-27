CREATE TYPE "ZbsMessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

CREATE TABLE "ZaloOAuthCredential" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "accessTokenCiphertext" TEXT NOT NULL,
  "refreshTokenCiphertext" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "refreshTokenExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZaloOAuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ZbsMessageLog" (
  "id" TEXT NOT NULL,
  "trackingId" TEXT NOT NULL,
  "templateType" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "recipientLast4" TEXT NOT NULL,
  "status" "ZbsMessageStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "providerErrorCode" INTEGER,
  "providerMessage" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ZbsMessageLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZbsMessageLog_trackingId_key" ON "ZbsMessageLog"("trackingId");
CREATE INDEX "ZbsMessageLog_status_createdAt_idx" ON "ZbsMessageLog"("status", "createdAt");
CREATE INDEX "ZbsMessageLog_providerMessageId_idx" ON "ZbsMessageLog"("providerMessageId");
