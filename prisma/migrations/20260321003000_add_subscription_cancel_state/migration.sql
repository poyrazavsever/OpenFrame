ALTER TABLE "users"
ADD COLUMN "stripeCancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "stripeCancelAt" TIMESTAMP(3);
