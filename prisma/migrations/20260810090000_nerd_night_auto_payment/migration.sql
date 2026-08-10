ALTER TABLE "NerdNightRegistration"
ADD COLUMN "paymentTransactionId" TEXT,
ADD COLUMN "paymentReceivedAmount" INTEGER,
ADD COLUMN "paymentQrUrl" TEXT;

CREATE UNIQUE INDEX "NerdNightRegistration_paymentTransactionId_key"
ON "NerdNightRegistration"("paymentTransactionId");
