export function buildRoundDirective(round: string | null): string {
  if (!round) return "";

  const directives: Record<string, string> = {
    "Phone Screen":
      "This is a phone screen. Assess fundamental competence, communication clarity, and whether the candidate's experience matches the role. Keep questions broad but probing. Screen for red flags.",
    "Technical & Coding":
      "This is a technical coding round. Focus on algorithms, data structures, and clean code. Push on complexity analysis and edge cases. Evaluate problem-solving process over speed.",
    "Technical Coding":
      "This is a technical coding round. Focus on algorithms, data structures, and clean code. Push on complexity analysis and edge cases.",
    "Technical Deep Dive":
      "This is a deep technical round. Demand specificity — push the candidate to the limits of their domain expertise. Probe for depth, not breadth.",
    "Coding & Algorithms":
      "This is an algorithms-focused round. Evaluate algorithmic thinking, complexity analysis, and the candidate's ability to write clean, correct code under pressure.",
    "Coding & Problem Solving":
      "This is a problem-solving round. Present ambiguous problems and evaluate how the candidate structures their approach. Coding skill is part of the evaluation but process matters more.",
    "System Design":
      "This is a system design round. Focus on architecture, tradeoffs, and high-level design thinking. Evaluate how the candidate breaks down complex systems and makes design decisions.",
    "System Design & Architecture":
      "This is a system design round. Focus on scalable architecture, design tradeoffs, and the candidate's ability to reason about complex systems at scale.",
    "System Design & Integration":
      "This is a system design round with focus on cross-system integration. Evaluate how the candidate approaches integration patterns, APIs, and system boundaries.",
    "System Design & Risk":
      "This is a system design round for high-stakes financial systems. Focus on low-latency architecture, fault tolerance, correctness, and regulatory considerations.",
    "Real-time Systems Design":
      "This is a real-time systems design round. Focus on latency optimization, geo-distributed architecture, and operational reliability at global scale.",
    "Observability & System Design":
      "This is an observability-focused design round. Evaluate monitoring-first architecture, distributed tracing, and reliability engineering mindset.",
    "Product Design & Architecture":
      "This is a product-aware design round. Evaluate how the candidate balances technical architecture with product impact and user experience.",
    "Architecture & Strategy":
      "This is an architecture and strategy round. Evaluate technical vision, architectural decision-making, and ability to balance short-term execution with long-term strategy.",
    "Rendering & Collaboration":
      "This is a rendering and collaboration round. Focus on canvas performance, real-time sync architecture, WebAssembly, and creative technical problem-solving.",
    "Blocks & Architecture":
      "This is a platform architecture round. Focus on composable extensibility, block protocol design, real-time sync, and data architecture for collaborative tools.",
    "Data Integration & Ontology":
      "This is a data integration round. Focus on complex data pipelines, ontology design, data quality, and the ability to make sense of messy, large-scale data.",
    "Behavioral & PMA":
      "This is a behavioral round. Evaluate leadership, collaboration, conflict resolution, and how the candidate operates within a team. Use STAR-style probing.",
    "Leadership Principles & Behavior":
      "This is a leadership and behavioral round. Use STAR methodology. Probe for ownership, customer obsession, bias for action, and leadership principles.",
    "Leadership & Behavior":
      "This is a leadership and behavioral round. Evaluate ownership, decision-making, conflict resolution, and cultural contribution.",
    "Leadership & Culture":
      "This is a culture and leadership round. Evaluate freedom-responsibility fit, candor, and the candidate's ability to operate in a high-autonomy environment.",
    "Behavioral & Growth":
      "This is a behavioral round with focus on growth mindset. Evaluate cross-team collaboration, learning from failure, and adaptability.",
    "Craftsmanship & Behavior":
      "This is a craftsmanship and behavioral round. Evaluate attention to detail, privacy-first thinking, and how the candidate approaches quality vs. speed.",
    "Operational & Behavior":
      "This is an operational and behavioral round. Focus on incident response, operational excellence, and how the candidate handles production pressure.",
    "Host-centric & Behavior":
      "This is a host-centric behavioral round. Evaluate community-focused thinking, full-stack ownership, and how the candidate builds for diverse users.",
    "SRE & Reliability":
      "This is an SRE and reliability round. Focus on observability, incident response, chaos engineering, and the candidate's philosophy on building reliable systems.",
    "Client & Behavior":
      "This is a client-focused behavioral round. Evaluate stakeholder management, structured communication, and client delivery experience.",
    "Compliance & Behavior":
      "This is a compliance and behavioral round. Focus on regulatory thinking, precision under pressure, and how the candidate handles high-stakes environments.",
    "Mission & Behavior":
      "This is a mission-focused round. Evaluate how the candidate approaches complex problems in sensitive environments, customer-facing engineering, and security awareness.",
    "Design & Culture":
      "This is a design and culture round. Evaluate design-meets-engineering thinking, creative collaboration, and the candidate's fit for a design-driven culture.",
    "Product & Behavior":
      "This is a product-focused behavioral round. Evaluate product craftsmanship, tool-for-thought mindset, and how the candidate thinks about building for power users.",
    "Founder & Culture Fit":
      "This is a founder and culture fit round. Evaluate generalist mindset, resourcefulness, decision-making under ambiguity, and high-velocity execution.",
    "Case Study & Analysis":
      "This is a case study round. Present a business problem and evaluate structured problem-solving, analytical frameworks, and communication of recommendations.",
    "Product Sense":
      "This is a product sense round. Focus on user empathy, product thinking, goal definition, and solution exploration. Evaluate how the candidate identifies user needs, defines success metrics, prioritizes features, and makes product tradeoffs. Use the canvas for user flows and wireframes.",
    "Design Critique":
      "This is a design critique round. Focus on UX analysis, design principles, and constructive feedback. Evaluate first impressions, what works, what could improve, and how the candidate articulates design rationale. Use the canvas for annotated mockups and before/after flows.",
    "Strategy & Vision":
      "This is a strategy and vision round. Focus on strategic thinking, org design, roadmap planning, and execution. Evaluate how the candidate assesses current state, defines a vision, builds a roadmap, and thinks about org structure and risk. Use the canvas for org charts and timelines.",
    "Quantitative Analysis":
      "This is a quantitative analysis round. Present business or analytical problems involving calculations, formulas, and data reasoning. Focus on structured problem-solving, mathematical accuracy, assumption quality, and business logic. Evaluate how the candidate frameworks the problem, performs calculations, verifies results, and draws conclusions.",
  };

  const directive = directives[round];
  if (directive) return `## Interview Round\n${directive}`;
  return `## Interview Round\nThis round is described as: "${round}". Evaluate the candidate across breadth and depth appropriate to the round type. If the round sounds technical, prioritize depth over breadth. If behavioral, prioritize decision-making and interpersonal skills. Adapt your evaluation intent to match the round's focus.`;
}
