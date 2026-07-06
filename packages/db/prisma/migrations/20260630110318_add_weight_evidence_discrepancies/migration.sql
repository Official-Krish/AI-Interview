-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN     "discrepancies" JSONB;

-- AlterTable
ALTER TABLE "InterviewTurn" ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;
