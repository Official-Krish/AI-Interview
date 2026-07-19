-- CreateTable
CREATE TABLE "PendingEmail" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'general',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PendingEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingEmail_nextRetryAt_idx" ON "PendingEmail"("nextRetryAt");

-- CreateIndex
CREATE INDEX "PendingEmail_createdAt_idx" ON "PendingEmail"("createdAt");
