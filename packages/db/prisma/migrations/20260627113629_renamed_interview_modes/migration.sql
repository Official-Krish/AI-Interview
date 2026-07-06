/*
  Warnings:

  - The values [DSA,SYSTEM_DESIGN] on the enum `InterviewMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InterviewMode_new" AS ENUM ('VOICE', 'LIVE_CODE', 'LIVE_CANVAS');
ALTER TABLE "public"."InterviewSession" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "InterviewSession" ALTER COLUMN "mode" TYPE "InterviewMode_new" USING ("mode"::text::"InterviewMode_new");
ALTER TYPE "InterviewMode" RENAME TO "InterviewMode_old";
ALTER TYPE "InterviewMode_new" RENAME TO "InterviewMode";
DROP TYPE "public"."InterviewMode_old";
ALTER TABLE "InterviewSession" ALTER COLUMN "mode" SET DEFAULT 'VOICE';
COMMIT;
