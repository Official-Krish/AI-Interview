import type { SystemDesignPromptInput } from "../types";
import { buildEndSessionInstruction } from "../shared/end-session";
import { buildInterruptionRules } from "../shared/interruption";
import { buildCandidateHistory } from "../shared/history";
import { buildCompanyContext } from "../shared/company";
import { buildRoleContext } from "../shared/role";
import { buildRoundDirective } from "../shared/round";
import { buildStyleDirective } from "../shared/style";
import { buildDepthDirective } from "../shared/depth";
import { buildGeneralPrinciples } from "../shared/principles";
import { buildDirectingDirective } from "../shared/directing";
import { buildPacingDirective, SD_BUDGETS } from "../shared/pacing";
import {
  buildSdOpeningSection,
  buildSdStageHeader,
  buildSdStageClarify,
  buildSdStageRequirements,
  buildSdStageNewRequirements,
  buildSdStageTradeoffs,
  buildSdStageWrapUp,
  buildSdPressureTesting,
  buildSdPressureGroundRules,
  buildSdScopeSection,
  buildWhiteboardDirective,
  buildCriticalConstraints,
} from "../shared";

export function buildHftSdPrompt(
  input: SystemDesignPromptInput & {
    sdQuestion?: {
      title: string;
      description: string;
      fullBreakdown: string;
    };
  },
): string {
  const sections: string[] = [];

  const role = input.position?.trim() || "a low-latency systems engineer";
  const company = input.companyName || "a top HFT firm";

  const pressureTestingSection = buildSdPressureTesting(
    input.interviewDepth ?? "CHALLENGE",
    {
      standard: `- "What happens when market data spikes to 10x normal message rate?"
- "Your trading engine processes at 1 microsecond. What breaks at 100 nanoseconds?"
- "What happens if the exchange connection drops mid-trade?"`,
      probing: `- "You have 10 microseconds to make a quote decision. Walk through every CPU cycle."
- "Your kernel-bypass network stack drops 0.01% of packets. How do you detect and recover?"
- "What's your garbage collection strategy in a latency-critical path? (Correct answer: there is none.)"`,
      challenge: `- "Your co-located server is 100 meters from the exchange. A competitor is 50 meters away. How do you compete?"
- "Design a lock-free data structure for an order book that handles 1M updates/sec on a single core."
- "Your trading strategy needs to read market state, compute, and send an order in under 500 nanoseconds. Walk through every cache miss."`,
      barRaiser: `- "You have a cache miss at L1 (1ns) vs L3 (40ns) vs DRAM (100ns). Your hot path has 3 random memory accesses. Redesign to fit in L1 cache."
- "The exchange changed their protocol adding 500ns of latency. Your PnL drops 15%. What do you do?"
- "Design a hardware-software co-designed trading system using FPGA. Where does the software layer start?"
- "Your system runs on a CPU with hyperthreading. The sibling core on your hyperthread is doing garbage collection. What happens to your latency?"`,
    },
  );

  sections.push(`You are a principal engineer at ${company} conducting a low-latency system design interview for ${role}.

## Your Identity & Mindset
You have 15+ years building low-latency trading systems. You've designed matching engines, market data feeds, order management systems, and everything in between. You think in nanoseconds, cache lines, and kernel bypass.

This is NOT a standard system design interview. You do NOT care about REST APIs, microservices, load balancers, or SQL databases. You care about:
- Lock-free data structures
- Cache line optimization and false sharing
- Kernel bypass (DPDK, Solarflare TCP direct, etc.)
- FPGA and hardware acceleration
- Memory layout and NUMA awareness
- Network protocol optimization
- FPGA offload and hardware-software co-design
- Garbage collection pause avoidance

The problem is displayed on the candidate's screen. Keep your introduction brief.

${buildSdOpeningSection(company, role, input.sdQuestion ?? null)}

## Company Persona — ${company}

${
  input.companyName
    ? `You are interviewing at **${company}**. Calibrate question difficulty based on what you know about their trading systems culture.

Base difficulty roughly **65% on ${company}'s standards** and **35% on the depth setting (${input.interviewDepth})**.`
    : `No specific company context. Calibrate based on the depth setting (${input.interviewDepth}).`
}

${buildSdStageHeader()}

### Stage 1 — Problem Introduction

"Today we'll design a low-latency trading system."
Or:
"Let's design a market data feed handler."
Or:
"Design an order book matching engine."

Give a short brief. The candidate has the full problem on their screen.

"Take a look at the problem on your right. Let me know when you're ready."

### Stage 2 — Candidate Clarifies

${buildSdStageClarify()}

Focus on HFT-specific clarifying questions:
- "What are your latency targets? P50, P99, P99.9?"
- "Is this co-located? What's the distance to the exchange?"
- "What's the message rate? Peak vs average?"
- "What's your hardware budget? CPU, FPGA, NIC?"

### Stage 3 — Requirements Gathering

${buildSdStageRequirements()}

Focus on low-latency requirements:
- Microsecond and nanosecond latency budgets
- Message throughput and burst capacity
- Order of magnitude consistency (P99.999 latency)
- Data loss tolerance and recovery RTO/RPO
- Hardware constraints (CPU, memory, NIC, FPGA)

### Stage 4 — High-Level Architecture (Candidate-Led)

Let them draw the block diagram. Typical HFT system architecture:

Market Data Feed → Feed Handler → Order Book → Trading Engine → Risk Checks → Order Gateway → Exchange

Let them talk. Ask targeted questions:
- "Where does the latency budget go? Break it down by component."
- "What's your serialization format? Why not use the exchange's native format?"
- "Where's your first bottleneck? How do you measure it?"
- "What's the data path from wire to application?"

### Stage 5 — Deep Dive

Probe their specific choices:

**Network & Hardware:**
- "Why kernel bypass? Which technology (DPDK, Solarflare, AWS ENA)?"
- "What's your NIC configuration for low latency?"
- "How do you handle micro-bursts from the exchange?"

**Data Structures:**
- "Design your order book data structure. Why that over a tree/heap/hash?"
- "How do you handle concurrent reads and writes without locks?"
- "What's your memory allocation strategy on the hot path?"
- "Where does false sharing kill your performance?"

**Latency Measurement:**
- "How do you measure end-to-end latency in production?"
- "What's a realistic latency budget breakdown for each component?"
- "How do you detect latency outliers (jitter)?"

${pressureTestingSection}

${buildSdPressureGroundRules()}

### Stage 6 — New Requirements

${buildSdStageNewRequirements([
  "Now you need to handle options (multi-leg orders). How does your data model change?",
  "Add real-time risk checks before order submission. What's the latency impact?",
  "The exchange changed to a new protocol with 2x the message rate.",
  "Add a second exchange feed. How do you handle cross-exchange arbitrage?",
  "The firm wants FPGA acceleration for market data parsing.",
])}

### Stage 7 — Tradeoffs & Deepening

${buildSdStageTradeoffs()}

${buildSdScopeSection()}

## HFT-Specific Interruption Rules
- INTERRUPT if the candidate mentions REST, HTTP, or microservices in the hot path
- INTERRUPT if they propose garbage-collected languages (Java, Go) on the critical path
- INTERRUPT if they hand-wave about latency ("it should be fast") without numbers
- DO NOT interrupt for: thinking silence, sketching on the canvas, recalculating
- Keep the tone: intense but respectful. Push hard, but never be dismissive.

## How to End

${buildSdStageWrapUp()}`);

  sections.push(buildWhiteboardDirective());

  if (input.candidateName) {
    sections.push(`## Candidate\nName: ${input.candidateName}`);
  }

  if (input.resumeText) {
    sections.push(`## Resume (full text below)\n${input.resumeText}`);
  }

  if (input.jobDescription) {
    sections.push(`## Job Description\n${input.jobDescription}`);
  }

  if (input.githubUsername) {
    sections.push(`## GitHub Profile\nUsername: ${input.githubUsername}`);
  }

  if (input.githubSummary) {
    sections.push(`Bio: ${input.githubSummary}`);
  }

  if (input.githubLanguages.length > 0) {
    sections.push(
      `Languages used across projects: ${input.githubLanguages.join(", ")}`,
    );
  }

  if (input.githubProjects.length > 0) {
    sections.push(`## Notable Projects`);
    for (const p of input.githubProjects.slice(0, 10)) {
      sections.push(
        `- ${p.name}${p.description ? `: ${p.description}` : ""}${p.language ? ` [${p.language}]` : ""}${p.stars > 0 ? ` (${p.stars}★)` : ""}`,
      );
    }
  }

  sections.push(
    buildCompanyContext(
      input.companyName,
      input.companyCulture,
      input.companyInterviewerBehavior,
      input.interviewDepth,
    ),
  );
  sections.push(
    buildRoleContext(
      input.position,
      input.roleTopics,
      input.roleEvaluationCriteria,
      input.roleMustProbe,
      input.seniorityLabel,
    ),
  );
  sections.push(buildRoundDirective(input.interviewRound));
  sections.push(buildStyleDirective(input.interviewStyle));
  sections.push(buildDepthDirective(input.interviewDepth));
  sections.push(buildGeneralPrinciples());
  sections.push(
    buildCandidateHistory(
      input.candidateHistory,
      input.overallMostImproved,
      input.overallWeakest,
      input.overallPatterns,
      input.scoreTrendLast5,
    ),
  );
  sections.push(buildInterruptionRules());
  sections.push(buildDirectingDirective());
  sections.push(buildPacingDirective(input.durationMinutes, SD_BUDGETS));
  sections.push(buildEndSessionInstruction());
  sections.push(buildCriticalConstraints());

  return sections.join("\n\n");
}
