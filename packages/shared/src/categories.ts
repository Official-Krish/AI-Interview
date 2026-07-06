import type { InterviewMode } from ".";

export const ROLE_CATEGORIES = [
  {
    id: "engineering",
    label: "Software Engineering",
    icon: "code",
    description: "Algorithms, system design, coding, and technical depth",
  },
  {
    id: "devops",
    label: "DevOps / Infrastructure",
    icon: "server",
    description: "Cloud, CI/CD, reliability, observability, and automation",
  },
  {
    id: "data",
    label: "Data / Analytics",
    icon: "chart",
    description: "ML, analytics, SQL, experimentation, and data architecture",
  },
  {
    id: "product",
    label: "Product / Design",
    icon: "palette",
    description: "Product sense, design critique, UX, and creative technology",
  },
  {
    id: "consulting",
    label: "Consulting / Business",
    icon: "briefcase",
    description:
      "Case studies, client strategy, frameworks, and stakeholder management",
  },
  {
    id: "management",
    label: "Engineering Management",
    icon: "users",
    description:
      "Leadership, people management, technical strategy, and org design",
  },
  {
    id: "security",
    label: "Security",
    icon: "shield",
    description:
      "Application security, threat modeling, and infrastructure security",
  },
  {
    id: "mobile",
    label: "Mobile",
    icon: "smartphone",
    description: "iOS, Android, and cross-platform mobile engineering",
  },
  {
    id: "research",
    label: "Research",
    icon: "flask",
    description: "ML research, applied science, and paper discussion",
  },
  {
    id: "finance",
    label: "Finance",
    icon: "dollar-sign",
    description: "Quantitative finance, trading, and risk analysis",
  },
  {
    id: "hardware",
    label: "Hardware",
    icon: "cpu",
    description: "Embedded systems, hardware engineering, and manufacturing",
  },
  {
    id: "sales_gtm",
    label: "Sales / GTM",
    icon: "trending-up",
    description:
      "Sales engineering, go-to-market strategy, and customer success",
  },
  {
    id: "hft",
    label: "HFT / Quantitative Finance",
    icon: "activity",
    description:
      "Quantitative trading, low-latency systems, probability and risk",
  },
  {
    id: "other",
    label: "Other",
    icon: "more-horizontal",
    description: "Custom roles and interdisciplinary fields",
  },
] as const;

export type RoleCategory = (typeof ROLE_CATEGORIES)[number]["id"];

export const CATEGORY_ROUNDS: Record<
  RoleCategory,
  { label: string; mode: InterviewMode }[]
> = {
  engineering: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Coding Round (DSA)", mode: "LIVE_CODE" },
    { label: "System Design", mode: "LIVE_CANVAS" },
    { label: "Technical Deep Dive", mode: "VOICE" },
  ],
  devops: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Infrastructure Design", mode: "LIVE_CANVAS" },
    { label: "Incident Response", mode: "VOICE" },
    { label: "CI/CD & Automation", mode: "VOICE" },
  ],
  data: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Data Architecture", mode: "LIVE_CANVAS" },
    { label: "SQL & Analytics", mode: "LIVE_CODE" },
    { label: "ML System Design", mode: "LIVE_CANVAS" },
  ],
  consulting: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Case Study", mode: "DISCUSSION" },
    { label: "Client Presentation", mode: "VOICE" },
    { label: "Quantitative Analysis", mode: "LIVE_CODE" },
  ],
  product: [
    { label: "Product Sense", mode: "LIVE_CANVAS" },
    { label: "Design Critique", mode: "LIVE_CANVAS" },
    { label: "Technical Deep Dive", mode: "VOICE" },
  ],
  management: [
    { label: "Leadership / Behavioral", mode: "VOICE" },
    { label: "System Design", mode: "LIVE_CANVAS" },
    { label: "Strategy & Vision", mode: "LIVE_CANVAS" },
  ],
  other: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Technical Deep Dive", mode: "VOICE" },
  ],
  security: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Threat Modeling", mode: "DISCUSSION" },
    { label: "Vulnerability Analysis", mode: "VOICE" },
    { label: "Incident Response", mode: "VOICE" },
  ],
  mobile: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Mobile Architecture", mode: "LIVE_CANVAS" },
    { label: "Coding Round (DSA)", mode: "LIVE_CODE" },
    { label: "Technical Deep Dive", mode: "VOICE" },
  ],
  research: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Paper Critique", mode: "DISCUSSION" },
    { label: "Research Deep Dive", mode: "VOICE" },
    { label: "ML System Design", mode: "LIVE_CANVAS" },
  ],
  finance: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Quantitative Case", mode: "DISCUSSION" },
    { label: "Market & Risk Scenario", mode: "VOICE" },
  ],
  hardware: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Hardware Design", mode: "LIVE_CANVAS" },
    { label: "Debugging Scenario", mode: "VOICE" },
  ],
  sales_gtm: [
    { label: "Behavioral / Experience", mode: "VOICE" },
    { label: "Mock Pitch", mode: "DISCUSSION" },
    { label: "Discovery Call Simulation", mode: "VOICE" },
  ],
  hft: [
    { label: "Quantitative & Probability", mode: "VOICE" },
    { label: "Low-Latency C++ Coding", mode: "LIVE_CODE" },
    { label: "Low-Latency System Design", mode: "LIVE_CANVAS" },
    { label: "Behavioral / HFT Fit", mode: "VOICE" },
  ],
};

export const FALLBACK_ROUNDS: { label: string; mode: InterviewMode }[] = [
  { label: "Behavioral / Experience", mode: "VOICE" },
  { label: "Technical Deep Dive", mode: "VOICE" },
];

export function getRoundPill(roundName: string): string | null {
  const liveCode = new Set([
    "Coding Round (DSA)",
    "SQL & Analytics",
    "Quantitative Analysis",
    "Low-Latency C++ Coding",
  ]);
  const liveCanvas = new Set([
    "System Design",
    "Infrastructure Design",
    "Data Architecture",
    "ML System Design",
    "Product Sense",
    "Design Critique",
    "Strategy & Vision",
    "Case Study",
    "System Design & Architecture",
    "System Design & Integration",
    "System Design & Risk",
    "Real-time Systems Design",
    "Observability & System Design",
    "Product Design & Architecture",
    "Architecture & Strategy",
    "Rendering & Collaboration",
    "Blocks & Architecture",
    "Data Integration & Ontology",
    "Mobile Architecture",
    "Hardware Design",
    "Low-Latency System Design",
  ]);
  if (liveCode.has(roundName)) return "Live Code";
  if (liveCanvas.has(roundName)) return "Live Design";
  return null;
}
