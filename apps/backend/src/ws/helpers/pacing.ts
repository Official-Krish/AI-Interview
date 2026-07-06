import type { PacingBudget } from "../../prompt/types";

export type { PacingBudget };

export type SteerLevel = "ahead" | "normal" | "behind" | "hard" | "force";

export interface PacingState {
  elapsedPct: number;
  remainingPct: number;
  stage: string;
  stageBudget: number;
  stageUsed: number;
  drift: number;
  steer: SteerLevel;
}

export class PacingTracker {
  private startTime: number;
  private totalTimeMs: number;
  private budgets: PacingBudget[];
  private stageIndex = 0;
  private stageStartTime: number;
  private cumulativeUsedPerStage: Map<string, number> = new Map();
  private lastHardSteerTurn = 0;
  private hardSteerSentCount = 0;

  constructor(totalTimeMs: number, budgets: PacingBudget[]) {
    this.startTime = Date.now();
    this.totalTimeMs = totalTimeMs;
    this.budgets = budgets;
    this.stageStartTime = this.startTime;
  }

  advanceTo(stageName: string): void {
    const idx = this.budgets.findIndex((b) => b.name === stageName);
    if (idx === -1) {
      console.warn(
        `[pacing] advanceTo: unknown stage "${stageName}" — no matching budget`,
      );
      return;
    }
    if (idx > this.stageIndex) {
      const elapsed = Date.now() - this.stageStartTime;
      const current = this.budgets[this.stageIndex]!;
      this.cumulativeUsedPerStage.set(
        current.name,
        (this.cumulativeUsedPerStage.get(current.name) ?? 0) + elapsed,
      );
      this.stageIndex = idx;
      this.stageStartTime = Date.now();
    }
  }

  handleTurnCompletion(): void {
    // Called on audio_stream_end to keep stageUsed tracking current
    // No-op if advanceTo handles the increments, but keeps the elapsed
    // tracking fresh for the next getState() call
  }

  private getCumulativeBudget(): number {
    return this.budgets
      .slice(0, this.stageIndex + 1)
      .reduce((s, b) => s + b.budgetPct, 0);
  }

  getState(): PacingState {
    const now = Date.now();
    const elapsed = now - this.startTime;
    const elapsedPct = Math.min(elapsed / this.totalTimeMs, 1);
    const remainingPct = 1 - elapsedPct;

    // Auto-advance: if elapsed exceeds cumulative budget for current stage,
    // move to next stage (deterministic fallback)
    const cumulative = this.getCumulativeBudget();
    if (
      elapsedPct * 100 > cumulative &&
      this.stageIndex < this.budgets.length - 1
    ) {
      const currentStage = this.budgets[this.stageIndex]!;
      this.cumulativeUsedPerStage.set(
        currentStage.name,
        (this.cumulativeUsedPerStage.get(currentStage.name) ?? 0) +
          (now - this.stageStartTime),
      );
      this.stageIndex++;
      this.stageStartTime = now;
    }

    const stage = this.budgets[this.stageIndex]!;
    const stageElapsed =
      (this.cumulativeUsedPerStage.get(stage.name) ?? 0) +
      (now - this.stageStartTime);
    const stageUsedPct = stageElapsed / this.totalTimeMs;

    // Drift: positive = behind (using more time than budgeted for stages completed)
    const budgetUpToThisStage = this.budgets
      .slice(0, this.stageIndex)
      .reduce((s, b) => s + b.budgetPct, 0);
    const drift = elapsedPct * 100 - budgetUpToThisStage;

    // Steer level determination
    let steer: SteerLevel = "normal";

    if (drift < -5) {
      steer = "ahead";
    } else if (drift > 10 || stageUsedPct * 100 > stage.budgetPct) {
      steer = "behind";
    }

    if (steer === "behind" && remainingPct < 0.2) {
      // Check if deep-dive hasn't meaningfully started yet
      const deepDiveIdx = this.budgets.findIndex(
        (b) => b.name === "deep-dive" || b.name === "coding",
      );
      const onCriticalStage = deepDiveIdx >= 0 && this.stageIndex < deepDiveIdx;

      if (onCriticalStage || remainingPct < 0.1) {
        this.hardSteerSentCount++;
        steer = this.hardSteerSentCount > 1 ? "force" : "hard";
      }
    }

    // Absolute floor: when < 5% remaining, always force transition regardless of stage
    if (remainingPct < 0.05 && steer !== "force") {
      steer = "force";
    }

    return {
      elapsedPct: Math.round(elapsedPct * 100),
      remainingPct: Math.round(remainingPct * 100),
      stage: stage.name,
      stageBudget: stage.budgetPct,
      stageUsed: Math.round(stageUsedPct * 100),
      drift: Math.round(drift),
      steer,
    };
  }

  buildMessage(candidateSignal?: string): string {
    const s = this.getState();
    const signal = candidateSignal
      ? `\ncandidate_signal: ${candidateSignal}`
      : "";
    return `[PACING]
elapsed: ${s.elapsedPct}%
remaining: ${s.remainingPct}%
stage: ${s.stage}
stage_budget: ${s.stageBudget}%
stage_used: ${s.stageUsed}%
drift: ${s.drift > 0 ? "+" : ""}${s.drift}%
steer: ${s.steer}${signal}`;
  }

  getTotalTimeMs(): number {
    return this.totalTimeMs;
  }
}
