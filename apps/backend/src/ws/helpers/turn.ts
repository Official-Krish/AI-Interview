import { prisma } from "../../lib/prisma";
import type { InterviewConnection } from "../session";

function cleanQuestionText(conn: InterviewConnection): string {
  return conn.cleanQuestionBuf || conn.questionBuf;
}

export function isNewQuestion(
  conn: InterviewConnection,
  text: string,
): boolean {
  // Primary signal: function call already handled the transition
  if (conn.dsaTransitioned) return true;

  // Fallback: text heuristics
  const lower = text.toLowerCase();
  const newQIndicators = [
    "let's move on",
    "let\u2019s move on",
    "next question",
    "next, ",
    "now i'd like to",
    "now i\u2019d like to",
    "tell me about",
    "how do you",
    "how would you",
    "what is your",
    "what's your",
    "let's talk about",
    "let\u2019s talk about",
    "moving on",
    "another topic",
    "let me ask you",
    "now tell me",
  ];
  return newQIndicators.some((i) => lower.includes(i));
}

export async function createTurn(
  conn: InterviewConnection,
  questionText: string,
) {
  const turn = await prisma.interviewTurn.create({
    data: {
      interviewId: conn.interviewId!,
      orderNumber: conn.nextOrderNumber++,
      questionText,
      answerText: "",
    },
  });
  console.log(
    `[ws] created turn ${turn.id}: "${questionText.slice(0, 60)}..."`,
  );
  return turn.id;
}

export async function flushTurn(conn: InterviewConnection) {
  if (!conn.interviewId || !conn.questionBuf) return;
  const qText = cleanQuestionText(conn);
  const turnId = await createTurn(conn, qText);
  if (conn.answerBuf) {
    await prisma.interviewTurn.update({
      where: { id: turnId },
      data: { answerText: conn.answerBuf },
    });
  }
  conn.currentTurnId = turnId;
  conn.questionBuf = "";
  conn.cleanQuestionBuf = "";
  conn.answerBuf = "";
}

export async function flushChallengeTurn(conn: InterviewConnection) {
  if (!conn.interviewId || !conn.currentTurnId) return;
  if (conn.answerBuf) {
    const prev = await prisma.interviewTurn.findUnique({
      where: { id: conn.currentTurnId },
      select: { answerText: true },
    });
    const merged = prev?.answerText
      ? prev.answerText + "\n\n" + conn.answerBuf
      : conn.answerBuf;
    await prisma.interviewTurn.update({
      where: { id: conn.currentTurnId },
      data: { answerText: merged },
    });
    conn.answerBuf = "";
  }
}

export async function mergeAnswerBuf(
  conn: InterviewConnection,
  separator = " ",
) {
  if (!conn.interviewId || !conn.currentTurnId || !conn.answerBuf) return;
  const prev = await prisma.interviewTurn.findUnique({
    where: { id: conn.currentTurnId },
    select: { answerText: true },
  });
  const merged = prev?.answerText
    ? prev.answerText + separator + conn.answerBuf
    : conn.answerBuf;
  await prisma.interviewTurn.update({
    where: { id: conn.currentTurnId },
    data: { answerText: merged },
  });
  conn.answerBuf = "";
}

export function isChallengeMode(conn: InterviewConnection): boolean {
  return (
    conn.interviewDepth === "CHALLENGE" || conn.interviewDepth === "BAR_RAISER"
  );
}
