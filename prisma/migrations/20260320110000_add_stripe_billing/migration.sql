CREATE TYPE "BillingSubscriptionStatus" AS ENUM (
  'FREE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
  'INCOMPLETE',
  'INCOMPLETE_EXPIRED'
);

ALTER TABLE "users"
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "stripePriceId" TEXT,
ADD COLUMN "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN "subscriptionStatus" "BillingSubscriptionStatus" NOT NULL DEFAULT 'FREE';

CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");
CREATE UNIQUE INDEX "users_stripeSubscriptionId_key" ON "users"("stripeSubscriptionId");
