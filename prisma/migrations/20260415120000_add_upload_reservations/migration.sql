-- CreateTable
CREATE TABLE "upload_reservations" (
    "id" TEXT NOT NULL,
    "billedUserId" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upload_reservations_billedUserId_expiresAt_idx" ON "upload_reservations"("billedUserId", "expiresAt");
