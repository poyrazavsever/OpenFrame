ALTER TABLE "users"
ADD COLUMN "billingTrialConsumedAt" TIMESTAMP(3);

UPDATE "users"
SET "billingTrialConsumedAt" = "trialEndsAt"
WHERE "trialEndsAt" IS NOT NULL;
