CREATE TYPE "BillingStatus" AS ENUM (
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED',
  'PAUSED'
);

CREATE TABLE "billing_subscriptions" (
  "id" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "stripePriceId" TEXT NOT NULL,
  "status" "BillingStatus" NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "lastEventCreated" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_subscriptions_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES "personals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "billing_subscriptions_personalId_key"
  ON "billing_subscriptions"("personalId");
CREATE UNIQUE INDEX "billing_subscriptions_stripeSubscriptionId_key"
  ON "billing_subscriptions"("stripeSubscriptionId");
CREATE INDEX "billing_subscriptions_status_currentPeriodEnd_idx"
  ON "billing_subscriptions"("status", "currentPeriodEnd");

CREATE TABLE "stripe_webhook_events" (
  "eventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "personalId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("eventId"),
  CONSTRAINT "stripe_webhook_events_personalId_fkey"
    FOREIGN KEY ("personalId") REFERENCES "personals"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "stripe_webhook_events_personalId_receivedAt_idx"
  ON "stripe_webhook_events"("personalId", "receivedAt");
