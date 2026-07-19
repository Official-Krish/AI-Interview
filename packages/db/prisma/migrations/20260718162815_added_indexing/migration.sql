-- CreateIndex
CREATE INDEX "InterviewSession_userId_createdAt_idx" ON "InterviewSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_status_createdAt_idx" ON "InterviewSession"("userId", "status", "createdAt");
