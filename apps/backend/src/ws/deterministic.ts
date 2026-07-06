export interface ScoredTurn {
  turnNumber: number;
  score: number;
  weight: number;
  evidence: string;
}

export interface DeterministicState {
  turns: ScoredTurn[];
  runningScore: number;
  totalWeight: number;
  weightedSum: number;
}

export function createDeterministicState(): DeterministicState {
  return {
    turns: [],
    runningScore: 0,
    totalWeight: 0,
    weightedSum: 0,
  };
}

export function addScoredTurn(
  state: DeterministicState,
  turn: ScoredTurn,
): void {
  state.turns.push(turn);
  state.totalWeight += turn.weight;
  state.weightedSum += turn.score * turn.weight;
  state.runningScore =
    state.totalWeight > 0
      ? Math.round(state.weightedSum / state.totalWeight)
      : 0;
}

export function getRunningScore(state: DeterministicState): number {
  return state.runningScore;
}

export function getMomentum(
  state: DeterministicState,
  windowSize = 5,
): { direction: "improving" | "stable" | "declining"; slope: number } {
  const turns = state.turns;
  if (turns.length < 2) {
    return { direction: "stable", slope: 0 };
  }

  const latest = turns.slice(-windowSize);
  const n = latest.length;
  if (n < 2) {
    return { direction: "stable", slope: 0 };
  }

  const indices = latest.map((_, i) => i);
  const scores = latest.map((t) => t.score);
  const meanX = (n - 1) / 2;
  const meanY = scores.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = indices[i]! - meanX;
    const dy = scores[i]! - meanY;
    num += dx * dy;
    den += dx * dx;
  }

  const slope = den > 0 ? num / den : 0;

  if (slope > 2) {
    return { direction: "improving", slope };
  }
  if (slope < -2) {
    return { direction: "declining", slope };
  }
  return { direction: "stable", slope };
}

export function getScoreConfidence(turnCount: number, turnsNeeded = 3): number {
  if (turnCount <= 0) return 0;
  const ratio = turnCount / turnsNeeded;
  return Math.min(Math.round(ratio * 100), 95);
}

export function getDimensionConfidence(
  dimensionTurns: number,
  turnsNeeded = 3,
): number {
  if (dimensionTurns <= 0) return 0;
  const ratio = dimensionTurns / turnsNeeded;
  return Math.min(Math.round(ratio * 100), 95);
}
