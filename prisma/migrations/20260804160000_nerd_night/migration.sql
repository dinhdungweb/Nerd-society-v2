CREATE TYPE "NerdNightEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "NerdNightVotingStatus" AS ENUM ('CLOSED', 'OPEN', 'RESULTS');
CREATE TYPE "NerdNightRegistrationStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "NerdNightSpeakerStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "NerdNightPaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'CONFIRMED');
CREATE TYPE "NerdNightRefundStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'COMPLETED');

CREATE TABLE "NerdNightEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 1,
    "episode" INTEGER NOT NULL,
    "themeCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "themeDescription" TEXT,
    "topicSuggestions" TEXT[] NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT,
    "price" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "speakerCapacity" INTEGER NOT NULL DEFAULT 6,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "speakerRegistrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "status" "NerdNightEventStatus" NOT NULL DEFAULT 'DRAFT',
    "votingStatus" "NerdNightVotingStatus" NOT NULL DEFAULT 'CLOSED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NerdNightEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NerdNightEvent_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "NerdNightEvent_speaker_capacity_check" CHECK ("speakerCapacity" >= 0 AND "speakerCapacity" <= "capacity"),
    CONSTRAINT "NerdNightEvent_price_check" CHECK ("price" >= 0)
);

CREATE TABLE "NerdNightRegistration" (
    "id" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendeeName" TEXT NOT NULL,
    "attendeePhone" TEXT NOT NULL,
    "status" "NerdNightRegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "wantsToShare" BOOLEAN NOT NULL DEFAULT false,
    "topicTitle" TEXT,
    "topicBackup1" TEXT,
    "topicBackup2" TEXT,
    "topicDescription" TEXT,
    "hasSlides" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT[] NOT NULL,
    "speakerStatus" "NerdNightSpeakerStatus" NOT NULL DEFAULT 'NONE',
    "amount" INTEGER NOT NULL,
    "transferContent" TEXT NOT NULL,
    "paymentBankCode" TEXT NOT NULL,
    "paymentAccountNumber" TEXT NOT NULL,
    "paymentAccountName" TEXT NOT NULL,
    "paymentStatus" "NerdNightPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentReportedAt" TIMESTAMP(3),
    "paymentConfirmedAt" TIMESTAMP(3),
    "paymentConfirmedById" TEXT,
    "paymentExpiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundStatus" "NerdNightRefundStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NerdNightRegistration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NerdNightRegistration_amount_check" CHECK ("amount" >= 0)
);

CREATE TABLE "NerdNightReview" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NerdNightReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NerdNightReview_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE TABLE "NerdNightVote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "speakerRegistrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NerdNightVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NerdNightPaymentConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bankCode" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NerdNightPaymentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NerdNightEvent_slug_key" ON "NerdNightEvent"("slug");
CREATE UNIQUE INDEX "NerdNightEvent_season_episode_key" ON "NerdNightEvent"("season", "episode");
CREATE INDEX "NerdNightEvent_status_startsAt_idx" ON "NerdNightEvent"("status", "startsAt");
CREATE INDEX "NerdNightEvent_locationId_idx" ON "NerdNightEvent"("locationId");

CREATE UNIQUE INDEX "NerdNightRegistration_registrationCode_key" ON "NerdNightRegistration"("registrationCode");
CREATE UNIQUE INDEX "NerdNightRegistration_transferContent_key" ON "NerdNightRegistration"("transferContent");
CREATE UNIQUE INDEX "NerdNightRegistration_eventId_userId_key" ON "NerdNightRegistration"("eventId", "userId");
CREATE INDEX "NerdNightRegistration_eventId_status_idx" ON "NerdNightRegistration"("eventId", "status");
CREATE INDEX "NerdNightRegistration_eventId_paymentStatus_idx" ON "NerdNightRegistration"("eventId", "paymentStatus");
CREATE INDEX "NerdNightRegistration_eventId_speakerStatus_idx" ON "NerdNightRegistration"("eventId", "speakerStatus");
CREATE INDEX "NerdNightRegistration_userId_createdAt_idx" ON "NerdNightRegistration"("userId", "createdAt");

CREATE UNIQUE INDEX "NerdNightReview_eventId_userId_key" ON "NerdNightReview"("eventId", "userId");
CREATE INDEX "NerdNightReview_eventId_isVisible_idx" ON "NerdNightReview"("eventId", "isVisible");

CREATE UNIQUE INDEX "NerdNightVote_eventId_voterId_key" ON "NerdNightVote"("eventId", "voterId");
CREATE INDEX "NerdNightVote_eventId_speakerRegistrationId_idx" ON "NerdNightVote"("eventId", "speakerRegistrationId");

ALTER TABLE "NerdNightEvent" ADD CONSTRAINT "NerdNightEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NerdNightEvent" ADD CONSTRAINT "NerdNightEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NerdNightRegistration" ADD CONSTRAINT "NerdNightRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NerdNightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightRegistration" ADD CONSTRAINT "NerdNightRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightRegistration" ADD CONSTRAINT "NerdNightRegistration_paymentConfirmedById_fkey" FOREIGN KEY ("paymentConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NerdNightReview" ADD CONSTRAINT "NerdNightReview_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NerdNightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightReview" ADD CONSTRAINT "NerdNightReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightVote" ADD CONSTRAINT "NerdNightVote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NerdNightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightVote" ADD CONSTRAINT "NerdNightVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightVote" ADD CONSTRAINT "NerdNightVote_speakerRegistrationId_fkey" FOREIGN KEY ("speakerRegistrationId") REFERENCES "NerdNightRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NerdNightPaymentConfig" ADD CONSTRAINT "NerdNightPaymentConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
