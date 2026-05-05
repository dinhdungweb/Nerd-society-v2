-- Shared wallet module. Balance source moves from Subscriber.walletBalance to Wallet.balance.

CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'LOCKED');
CREATE TYPE "WalletTransactionType" AS ENUM (
    'TOPUP',
    'DEBIT',
    'ADJUSTMENT',
    'REFUND',
    'BOOKING_PAYMENT',
    'SUBSCRIPTION_PURCHASE',
    'SESSION_CHARGE',
    'OVERAGE_CHARGE',
    'OVERAGE_PAYMENT'
);
CREATE TYPE "WalletTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
CREATE TYPE "WalletTransactionSource" AS ENUM (
    'SYSTEM',
    'VIETQR',
    'MANUAL_ADMIN',
    'BOOKING',
    'SUBSCRIPTION',
    'MONTHLY_BEAVER'
);
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'MATCHED', 'DUPLICATE', 'IGNORED', 'ERROR');

CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletCode" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "status" "WalletTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "source" "WalletTransactionSource" NOT NULL DEFAULT 'SYSTEM',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "externalTransactionId" TEXT,
    "description" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "externalTransactionId" TEXT NOT NULL,
    "bankAccount" TEXT,
    "amount" INTEGER NOT NULL,
    "transType" TEXT,
    "content" TEXT,
    "transactionTime" TIMESTAMP(3),
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "matchedWalletId" TEXT,
    "matchedTransactionId" TEXT,
    "rawPayload" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "Wallet_walletCode_key" ON "Wallet"("walletCode");
CREATE INDEX "Wallet_walletCode_idx" ON "Wallet"("walletCode");
CREATE INDEX "Wallet_status_idx" ON "Wallet"("status");
CREATE INDEX "Wallet_createdAt_idx" ON "Wallet"("createdAt");
CREATE UNIQUE INDEX "WalletTransaction_externalTransactionId_key" ON "WalletTransaction"("externalTransactionId");
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");
CREATE INDEX "WalletTransaction_source_idx" ON "WalletTransaction"("source");
CREATE INDEX "WalletTransaction_referenceType_referenceId_idx" ON "WalletTransaction"("referenceType", "referenceId");
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");
CREATE UNIQUE INDEX "BankTransaction_externalTransactionId_key" ON "BankTransaction"("externalTransactionId");
CREATE UNIQUE INDEX "BankTransaction_matchedTransactionId_key" ON "BankTransaction"("matchedTransactionId");
CREATE INDEX "BankTransaction_status_idx" ON "BankTransaction"("status");
CREATE INDEX "BankTransaction_matchedWalletId_idx" ON "BankTransaction"("matchedWalletId");
CREATE INDEX "BankTransaction_transactionTime_idx" ON "BankTransaction"("transactionTime");
CREATE INDEX "BankTransaction_createdAt_idx" ON "BankTransaction"("createdAt");

ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedWalletId_fkey" FOREIGN KEY ("matchedWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedTransactionId_fkey" FOREIGN KEY ("matchedTransactionId") REFERENCES "WalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
