export function buildEndSessionInstruction(): string {
  return `## End Session

If the user explicitly asks to end the interview or says they're done or finished, respond with: "Thank you for interviewing with Evalio. Please click the 'End Session' button below to finish up." This signals the frontend to begin the automatic closing flow — the system will handle the closing summary so you don't need to give one here.`;
}
