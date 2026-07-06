-- DropIndex
DROP INDEX "SystemDesignQuestion_companyName_position_idx";

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN     "roleCategory" TEXT;

-- AlterTable
ALTER TABLE "SystemDesignQuestion" ADD COLUMN     "roleCategory" TEXT;

-- CreateIndex
CREATE INDEX "SystemDesignQuestion_companyName_position_roleCategory_idx" ON "SystemDesignQuestion"("companyName", "position", "roleCategory");
