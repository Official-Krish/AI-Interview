-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN     "communicationConfidence" DOUBLE PRECISION,
ADD COLUMN     "momentum" TEXT,
ADD COLUMN     "momentumSlope" DOUBLE PRECISION,
ADD COLUMN     "overallConfidence" DOUBLE PRECISION,
ADD COLUMN     "problemSolvingConfidence" DOUBLE PRECISION,
ADD COLUMN     "technicalConfidence" DOUBLE PRECISION;
