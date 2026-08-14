-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('SEMANTIC', 'EPISODIC', 'FAILURE_PATTERN');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'WEAKENING', 'IMPROVING', 'STALE');

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "embedding" vector(768),
    "sourceInterviewId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memory_userId_status_idx" ON "Memory"("userId", "status");

-- CreateIndex
CREATE INDEX "Memory_userId_type_idx" ON "Memory"("userId", "type");
