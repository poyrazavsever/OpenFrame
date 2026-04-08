ALTER TABLE "users"
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "billingAccessEndedAt" TIMESTAMP(3);

UPDATE "users"
SET "trialEndsAt" = "createdAt" + INTERVAL '7 days'
WHERE "trialEndsAt" IS NULL;
