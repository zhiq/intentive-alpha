-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "FulfillmentMode" AS ENUM ('HOME_SERVICE', 'VISIT_PROVIDER', 'EITHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('DRAFT', 'NEEDS_DETAILS', 'MARKET_ACTIONABLE', 'LIVE', 'OFFER_READY', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveIntentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'EDITED', 'SENT', 'DECLINED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('SAME_DAY', 'TODAY', 'THIS_WEEK', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferencePassport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredBudgetMin" INTEGER,
    "preferredBudgetMax" INTEGER,
    "preferredServiceStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "avoidPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredProviderGender" TEXT,
    "defaultTravelRadiusKm" DOUBLE PRECISION,
    "preferredFulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferencePassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "description" TEXT,
    "baseLocation" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "serviceRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "offersHomeService" BOOLEAN NOT NULL DEFAULT false,
    "offersInStoreService" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseTimeMinutes" INTEGER NOT NULL DEFAULT 60,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderService" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'massage_wellness',
    "serviceType" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "minPrice" INTEGER NOT NULL,
    "maxPrice" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProviderService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderAvailability" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ProviderAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOfferPolicy" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "minPrice" INTEGER NOT NULL,
    "standardPrice" INTEGER NOT NULL,
    "maxDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "allowAddOns" BOOLEAN NOT NULL DEFAULT false,
    "allowedAddOns" JSONB NOT NULL DEFAULT '[]',
    "requireDeposit" BOOLEAN NOT NULL DEFAULT false,
    "depositPercent" INTEGER NOT NULL DEFAULT 0,
    "cancellationPolicy" TEXT NOT NULL DEFAULT 'Free cancellation up to 2 hours before.',
    "autoSuggestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoSendEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxTravelRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOfferPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentObject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'massage_wellness',
    "serviceType" TEXT,
    "desiredOutcome" TEXT,
    "requestedStartTime" TIMESTAMP(3),
    "requestedEndTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "locationText" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "travelRadiusKm" DOUBLE PRECISION,
    "fulfillmentMode" "FulfillmentMode" NOT NULL DEFAULT 'UNKNOWN',
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "urgency" "Urgency",
    "flexibilityTimeMinutes" INTEGER,
    "flexibilityBudgetPercent" INTEGER,
    "flexibilityTravelKm" DOUBLE PRECISION,
    "preferencesJson" JSONB NOT NULL DEFAULT '{}',
    "missingFieldsJson" JSONB NOT NULL DEFAULT '[]',
    "confidenceJson" JSONB NOT NULL DEFAULT '{}',
    "status" "IntentStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveIntent" (
    "id" TEXT NOT NULL,
    "intentObjectId" TEXT NOT NULL,
    "status" "LiveIntentStatus" NOT NULL DEFAULT 'ACTIVE',
    "providersInvitedCount" INTEGER NOT NULL DEFAULT 0,
    "offersReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "firstOfferAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferObject" (
    "id" TEXT NOT NULL,
    "liveIntentId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'SUGGESTED',
    "title" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MYR',
    "addOnsJson" JSONB NOT NULL DEFAULT '[]',
    "depositRequired" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "cancellationPolicy" TEXT NOT NULL,
    "reasonedBrief" TEXT NOT NULL,
    "fitScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "convenienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "providerEditNotes" TEXT,
    "availabilityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "offerObjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "depositAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "lastBookingId" TEXT,
    "usualServiceType" TEXT,
    "usualDurationMinutes" INTEGER,
    "usualBudgetMin" INTEGER,
    "usualBudgetMax" INTEGER,
    "notes" TEXT,
    "rebookingCount" INTEGER NOT NULL DEFAULT 0,
    "satisfactionScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelationshipAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReliabilitySignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "providerId" TEXT,
    "signalType" TEXT NOT NULL,
    "signalValue" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReliabilitySignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOutcomeTrace" (
    "id" TEXT NOT NULL,
    "intentObjectId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOutcomeTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PreferencePassport_userId_key" ON "PreferencePassport"("userId");

-- CreateIndex
CREATE INDEX "Provider_ownerUserId_idx" ON "Provider"("ownerUserId");

-- CreateIndex
CREATE INDEX "Provider_isActive_idx" ON "Provider"("isActive");

-- CreateIndex
CREATE INDEX "ProviderService_providerId_idx" ON "ProviderService"("providerId");

-- CreateIndex
CREATE INDEX "ProviderService_serviceType_idx" ON "ProviderService"("serviceType");

-- CreateIndex
CREATE INDEX "ProviderAvailability_providerId_startTime_idx" ON "ProviderAvailability"("providerId", "startTime");

-- CreateIndex
CREATE INDEX "ProviderAvailability_isBooked_idx" ON "ProviderAvailability"("isBooked");

-- CreateIndex
CREATE INDEX "ProviderOfferPolicy_providerId_idx" ON "ProviderOfferPolicy"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOfferPolicy_providerId_serviceType_key" ON "ProviderOfferPolicy"("providerId", "serviceType");

-- CreateIndex
CREATE INDEX "IntentObject_userId_idx" ON "IntentObject"("userId");

-- CreateIndex
CREATE INDEX "IntentObject_status_idx" ON "IntentObject"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LiveIntent_intentObjectId_key" ON "LiveIntent"("intentObjectId");

-- CreateIndex
CREATE INDEX "LiveIntent_status_idx" ON "LiveIntent"("status");

-- CreateIndex
CREATE INDEX "OfferObject_liveIntentId_idx" ON "OfferObject"("liveIntentId");

-- CreateIndex
CREATE INDEX "OfferObject_providerId_idx" ON "OfferObject"("providerId");

-- CreateIndex
CREATE INDEX "OfferObject_status_idx" ON "OfferObject"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_offerObjectId_key" ON "Booking"("offerObjectId");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_providerId_idx" ON "Booking"("providerId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "RelationshipAsset_userId_idx" ON "RelationshipAsset"("userId");

-- CreateIndex
CREATE INDEX "RelationshipAsset_providerId_idx" ON "RelationshipAsset"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "RelationshipAsset_userId_providerId_key" ON "RelationshipAsset"("userId", "providerId");

-- CreateIndex
CREATE INDEX "ReliabilitySignal_userId_idx" ON "ReliabilitySignal"("userId");

-- CreateIndex
CREATE INDEX "ReliabilitySignal_providerId_idx" ON "ReliabilitySignal"("providerId");

-- CreateIndex
CREATE INDEX "ReliabilitySignal_signalType_idx" ON "ReliabilitySignal"("signalType");

-- CreateIndex
CREATE INDEX "MarketOutcomeTrace_intentObjectId_idx" ON "MarketOutcomeTrace"("intentObjectId");

-- CreateIndex
CREATE INDEX "MarketOutcomeTrace_eventType_idx" ON "MarketOutcomeTrace"("eventType");

-- CreateIndex
CREATE INDEX "MarketOutcomeTrace_createdAt_idx" ON "MarketOutcomeTrace"("createdAt");

-- AddForeignKey
ALTER TABLE "PreferencePassport" ADD CONSTRAINT "PreferencePassport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderService" ADD CONSTRAINT "ProviderService_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAvailability" ADD CONSTRAINT "ProviderAvailability_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOfferPolicy" ADD CONSTRAINT "ProviderOfferPolicy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentObject" ADD CONSTRAINT "IntentObject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveIntent" ADD CONSTRAINT "LiveIntent_intentObjectId_fkey" FOREIGN KEY ("intentObjectId") REFERENCES "IntentObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferObject" ADD CONSTRAINT "OfferObject_liveIntentId_fkey" FOREIGN KEY ("liveIntentId") REFERENCES "LiveIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferObject" ADD CONSTRAINT "OfferObject_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_offerObjectId_fkey" FOREIGN KEY ("offerObjectId") REFERENCES "OfferObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipAsset" ADD CONSTRAINT "RelationshipAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipAsset" ADD CONSTRAINT "RelationshipAsset_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipAsset" ADD CONSTRAINT "RelationshipAsset_lastBookingId_fkey" FOREIGN KEY ("lastBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilitySignal" ADD CONSTRAINT "ReliabilitySignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReliabilitySignal" ADD CONSTRAINT "ReliabilitySignal_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOutcomeTrace" ADD CONSTRAINT "MarketOutcomeTrace_intentObjectId_fkey" FOREIGN KEY ("intentObjectId") REFERENCES "IntentObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
