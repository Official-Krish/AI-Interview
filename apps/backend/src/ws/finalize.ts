import { prisma } from "../lib/prisma";
import {
  evaluateInterview,
  evaluateDsaSession,
  evaluateSystemDesignSession,
} from "../services/evaluate";
import type { InterviewerRuntime } from "./runtime";
import type { DeterministicState } from "./deterministic";
export async function finalizeInterview(
  interviewId: string,
  liveAssessments?: Array<{
    orderNumber: number;
    confidence: "low" | "medium" | "high";
    nervousness: "low" | "medium" | "high";
    engagement: "low" | "medium" | "high";
    clarity: "low" | "medium" | "high";
    fluency: "low" | "medium" | "high";
    signal: "none" | "strong" | "struggling" | "off_track" | "going_deep";
    rationale: string;
  }>,
  interruptionCount?: number,
  runtime?: Pick<
    InterviewerRuntime,
    | "notes"
    | "simplifiedQuestions"
    | "followUps"
    | "recoveryEvents"
    | "overconfidenceDetected"
    | "constraints"
  >,
  deterministic?: DeterministicState,
) {
  try {
    const interview = await prisma.interviewSession.findUnique({
      where: { id: interviewId },
      select: { status: true, startedAt: true, mode: true },
    });
    if (!interview || interview.status === "COMPLETED") return;

    await prisma.interviewSession.update({
      where: { id: interviewId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
        ...(interview.startedAt
          ? {
              durationSeconds: Math.round(
                (Date.now() - new Date(interview.startedAt).getTime()) / 1000,
              ),
            }
          : {}),
      },
    });

    console.log(
      `[ws] finalizing interview ${interviewId}, triggering evaluation`,
    );

    if (interview.mode === "LIVE_CODE") {
      evaluateDsaSession(
        interviewId,
        liveAssessments,
        interruptionCount,
        runtime,
        deterministic,
      ).catch((err) => {
        console.error("DSA evaluation failed:", err);
      });
    } else if (interview.mode === "LIVE_CANVAS") {
      evaluateSystemDesignSession(
        interviewId,
        liveAssessments,
        interruptionCount,
        runtime,
        deterministic,
      ).catch((err) => {
        console.error("System Design evaluation failed:", err);
      });
    } else {
      evaluateInterview(interviewId, {
        liveAssessments,
        interruptionCount,
        runtime,
        deterministic,
      }).catch((err) => {
        console.error("Evaluation failed:", err);
        prisma.interviewSession
          .update({
            where: { id: interviewId },
            data: { status: "FAILED" },
          })
          .catch((e) => console.error("Failed to set FAILED status:", e));
      });
    }
  } catch (err) {
    console.error("finalizeInterview error:", err);
  }
}
