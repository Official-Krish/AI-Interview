import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "motion/react";
import {
  IconDeviceLaptop,
  IconCpu,
  IconDatabase,
  IconSparkles,
} from "@tabler/icons-react";

const interviews = [
  {
    id: "dsa",
    title: "Not just talking.",
    accent: "Real coding interviews.",
    description:
      "LeetCode-style problems sourced from 1,900+ companies. A 6-phase interview structure that mirrors real on-sites — understand, brute force, optimize, implement, test, review.",
    features: ["Monaco Editor", "Python · C++ · TypeScript", "30 min timer"],
    status: { label: "Live now", color: "var(--landing-accent)" },
  },
  {
    id: "system-design",
    title: "Whiteboard your",
    accent: "architecture.",
    description:
      "Draw system topology diagrams live on a sketching canvas. AI reviews your database choices, evaluates bottlenecks, and queries tradeoffs as you construct your system in real-time.",
    features: [
      "Sketch blocks & arrows",
      "Real-time AI co-pilot",
      "Tradeoff probing",
    ],
    status: { label: "Live now", color: "var(--landing-accent)" },
  },
  {
    id: "discussion",
    title: "Articulate and align.",
    accent: "Behavioral & Discussion.",
    description:
      "Interactive dialogue for behavioral rounds, system critiques, and product deep-dives. Get real-time audio coaching or chat feedback on your articulation and STAR response structure.",
    features: [
      "Voice Mode (low-latency)",
      "System Critiques",
      "Live Articulation Coach",
    ],
    status: { label: "Live now", color: "var(--landing-accent)" },
  },
  {
    id: "domain",
    title: "Targeted to your",
    accent: "dream role.",
    description:
      "Solve specialized domain problems. Debug low-latency HFT C++ memory pools, query SQL analytical schemas, or analyze product conversion funnels in custom-tailored environments.",
    features: [
      "SQL & Analytics",
      "HFT C++ & Low-Level",
      "FAANG & Quant tracks",
    ],
    status: { label: "Live now", color: "var(--landing-accent)" },
  },
];

const CODE_LINES = [
  { text: "def two_sum(nums: list[int], target: int):", type: "def" },
  { text: "    seen = {}", type: "code" },
  { text: "    for i, n in enumerate(nums):", type: "code" },
  { text: "        complement = target - n", type: "code" },
  { text: "        if complement in seen:", type: "code" },
  { text: "            return [seen[complement], i]", type: "return" },
  { text: "    seen[n] = i", type: "code" },
];

function tokenise(line: string, type: string) {
  if (type === "def") {
    const m = line.match(/^(def )(\w+)(\(.*\))(:)$/);
    if (m)
      return (
        <>
          <span className="dsa-kw">{m[1]}</span>
          <span className="dsa-fn">{m[2]}</span>
          <span className="dsa-param">{m[3]}</span>
          <span className="dsa-punct">{m[4]}</span>
        </>
      );
  }
  if (type === "return") {
    return (
      <>
        <span className="dsa-kw">{"            return "}</span>
        <span className="dsa-bracket">{"["}</span>
        <span className="dsa-name">{"seen[complement]"}</span>
        <span className="dsa-punct">{", "}</span>
        <span className="dsa-name">{"i"}</span>
        <span className="dsa-bracket">{"]"}</span>
      </>
    );
  }
  return <span className="dsa-plain">{line}</span>;
}

function CodeMockup() {
  return (
    <div className="custom-code-block">
      <div className="custom-code-header">
        <span className="custom-code-dot" style={{ background: "#ff5f56" }} />
        <span className="custom-code-dot" style={{ background: "#ffbd2e" }} />
        <span className="custom-code-dot" style={{ background: "#27c93f" }} />
        <span className="custom-code-filename">solution.py</span>
      </div>
      <pre className="custom-code-pre">
        {CODE_LINES.map((line, i) => (
          <code key={i} className="custom-code-line">
            {tokenise(line.text, line.type)}
          </code>
        ))}
      </pre>
      <div className="custom-code-footer">
        <span className="custom-code-pass">3/3 tests passing</span>
        <span className="custom-code-complexity">O(n) time · O(n) space</span>
      </div>
    </div>
  );
}

type NodeId = "client" | "gateway" | "auth" | "app" | "cache" | "database";

interface ArchNode {
  id: NodeId;
  label: string;
  type: string;
  x: number;
  y: number;
  color: string;
  aiFeedback: string;
  tradeoffQuestion: string;
}

const ARCH_NODES: ArchNode[] = [
  {
    id: "client",
    label: "Client App",
    type: "Client",
    x: 0,
    y: 100,
    color: "#b8a88a",
    aiFeedback: "Client latency is 45ms. Mobile and web endpoints split here.",
    tradeoffQuestion:
      "How do you handle client retries, rate-limiting failures, and exponential backoff?",
  },
  {
    id: "gateway",
    label: "API Gateway",
    type: "Routing",
    x: 100,
    y: 100,
    color: "#7F77DD",
    aiFeedback:
      "SSL termination, CORS checking, and global rate limiting enabled.",
    tradeoffQuestion:
      "If the gateway goes down, how do you prevent split-brain routing and catastrophic failover?",
  },
  {
    id: "auth",
    label: "Auth Service",
    type: "Security",
    x: 100,
    y: 15,
    color: "#ef4444",
    aiFeedback:
      "Validates JWTs. Connected to cache for session revocation list checks.",
    tradeoffQuestion:
      "How do you scale token validation under 100,000 requests per second?",
  },
  {
    id: "app",
    label: "App Cluster",
    type: "Server",
    x: 200,
    y: 100,
    color: "#5DCAA5",
    aiFeedback:
      "Stateless nodes running on Kubernetes. Dynamic auto-scaling is active.",
    tradeoffQuestion:
      "How do you prevent session sticky issues when horizontally scaling stateful sessions?",
  },
  {
    id: "cache",
    label: "Redis Cache",
    type: "Caching",
    x: 200,
    y: 15,
    color: "#EF9F27",
    aiFeedback: "Eviction: volatile-lru. Average cache hit-rate is 88%.",
    tradeoffQuestion:
      "If you face a cache stampede during a promo event, what caching patterns mitigate DB load?",
  },
  {
    id: "database",
    label: "Postgres Main",
    type: "Storage",
    x: 300,
    y: 105,
    color: "#10b981",
    aiFeedback: "Active master. Read replicas are setup across 3 regions.",
    tradeoffQuestion:
      "With write-heavy payloads, when would you transition from SQL read replicas to sharding?",
  },
];

const nodeIcon = (id: string, size: number = 16) => {
  switch (id) {
    case "client":
      return <IconDeviceLaptop size={size} />;
    case "gateway":
    case "app":
      return <IconCpu size={size} />;
    case "auth":
    case "cache":
    case "database":
      return <IconDatabase size={size} />;
    default:
      return null;
  }
};

function ArchDiagram() {
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const selectedNode = ARCH_NODES.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="custom-arch">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--landing-fg-muted)] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--landing-accent)] animate-pulse" />
          Demo Whiteboard
        </span>
        <span className="text-[10px] font-mono text-[var(--landing-fg-muted)]">
          Click nodes to test
        </span>
      </div>

      {/* Canvas */}
      <div className="custom-arch-canvas">
        <svg className="custom-arch-svg" viewBox="0 0 400 180">
          <defs>
            <marker
              id="arch-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path
                d="M0,0 L8,4 L0,8"
                fill="var(--landing-fg-muted)"
                stroke="var(--landing-fg-muted)"
                strokeWidth="1"
              />
            </marker>
          </defs>

          {/* Main row */}
          {[
            ["client", "gateway"],
            ["gateway", "app"],
            ["app", "database"],
          ].map(([from, to]) => {
            const a = ARCH_NODES.find((n) => n.id === from)!;
            const b = ARCH_NODES.find((n) => n.id === to)!;
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x + 74}
                y1={a.y + 26}
                x2={b.x}
                y2={b.y + 26}
                stroke="var(--landing-fg-muted)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arch-arrow)"
              />
            );
          })}

          {/* Vertical lines */}
          {["auth", "cache"].map((id) => {
            const above = ARCH_NODES.find((n) => n.id === id)!;
            const belowId = id === "auth" ? "gateway" : "app";
            const below = ARCH_NODES.find((n) => n.id === belowId)!;
            return (
              <line
                key={id}
                x1={above.x + 37}
                y1={above.y + 52}
                x2={below.x + 37}
                y2={below.y}
                stroke="var(--landing-fg-muted)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                markerEnd="url(#arch-arrow)"
              />
            );
          })}

          {/* Nodes */}
          {ARCH_NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <g
                key={node.id}
                className="custom-arch-node"
                onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow when selected */}
                {isSelected && (
                  <rect
                    x={node.x - 3}
                    y={node.y - 3}
                    width={80}
                    height={58}
                    rx={10}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="2"
                    strokeOpacity={0.4}
                  />
                )}
                <rect
                  x={node.x}
                  y={node.y}
                  width={74}
                  height={52}
                  rx={8}
                  fill={
                    isSelected
                      ? "color-mix(in srgb, var(--landing-surface) 85%, transparent)"
                      : "var(--landing-surface)"
                  }
                  stroke={isSelected ? node.color : `${node.color}60`}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                <foreignObject x={node.x} y={node.y} width={74} height={52}>
                  <div className="flex flex-col items-center justify-center w-full h-full gap-0.5">
                    <span style={{ color: node.color }}>
                      {nodeIcon(node.id)}
                    </span>
                    <span className="text-[7.5px] font-mono uppercase tracking-wider text-[var(--landing-fg-muted)]">
                      {node.type}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--landing-fg)] leading-tight text-center px-1">
                      {node.label}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom AI Review Panel */}
      <div className="custom-arch-panel">
        <div className="flex items-center gap-1.5 mb-1">
          <IconSparkles
            size={13}
            className="text-[var(--landing-accent)] animate-pulse"
          />
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--landing-fg-muted)]">
            Live AI Architecture Review
          </span>
        </div>
        <AnimatePresence mode="wait">
          {selectedNode ? (
            <motion.div
              key={selectedNode.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-1.5"
            >
              <p className="text-[11.5px] text-[var(--landing-fg-muted)] leading-relaxed m-0 italic">
                "{selectedNode.aiFeedback}"
              </p>
              <p className="text-[12px] text-[var(--landing-accent)] font-semibold leading-relaxed m-0">
                Q: {selectedNode.tradeoffQuestion}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[11.5px] text-[var(--landing-fg-muted)] leading-relaxed m-0 italic"
            >
              "Click on any node to test active tradeoffs and see how the AI
              probes your architecture."
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface ChatMessage {
  author: "interviewer" | "candidate";
  text: string;
}

const DISCUSSION_MESSAGES: ChatMessage[] = [
  {
    author: "interviewer",
    text: "Can you describe a time you disagreed with a Product Manager on technical scope, and how you resolved it?",
  },
  {
    author: "candidate",
    text: "We wanted to launch a real-time feed. The PM wanted full database transactions, but I proposed using Redis pub-sub for ephemeral events and only persisted critical milestones to optimize DB load. We resolved it by comparing latency mockups and user impact.",
  },
];

interface CoachFeedback {
  phase: string;
  feedback: string;
  action: string;
}

const COACH_FEEDBACKS: CoachFeedback[] = [
  {
    phase: "Structure",
    feedback:
      "You clearly outlined the Situation and Task. Good alignment of PM objectives with engineering challenges.",
    action:
      "Mention specific latency figures (e.g. 500ms saved) to prove your impact in the Action/Result phase.",
  },
  {
    phase: "Tone",
    feedback:
      "Collaboration-focused phrasing. Instead of saying 'PM was wrong', you focused on 'tradeoffs and data-backed options'.",
    action:
      "Excellent, this is what elite companies look for in team communication dynamics.",
  },
];

function DiscussionMockup() {
  const [activeFeedbackIdx, setActiveFeedbackIdx] = useState(0);

  return (
    <div className="custom-discussion-block">
      {/* Header */}
      <div className="custom-code-header">
        <span className="custom-code-dot" style={{ background: "#ff5f56" }} />
        <span className="custom-code-dot" style={{ background: "#ffbd2e" }} />
        <span className="custom-code-dot" style={{ background: "#27c93f" }} />
        <div className="flex items-center gap-1.5 ml-3">
          <div className="custom-discussion-waveform">
            {[1.2, 0.8, 1.4, 0.6, 1.1, 1.3, 0.7, 1.0].map((delay, idx) => (
              <span
                key={idx}
                className="waveform-bar"
                style={{
                  height: "14px",
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono text-[var(--landing-fg-muted)]">
            Voice Live
          </span>
        </div>
        <span className="custom-code-filename">behavioral_feedback.log</span>
      </div>

      {/* Transcript Chat */}
      <div className="custom-discussion-chat">
        {DISCUSSION_MESSAGES.map((msg, idx) => (
          <div key={idx} className={`custom-chat-msg ${msg.author}`}>
            <span className="custom-chat-author">
              {msg.author === "interviewer"
                ? "AI Lead Interviewer"
                : "You (Candidate)"}
            </span>
            <div className="custom-chat-bubble">{msg.text}</div>
          </div>
        ))}
      </div>

      {/* AI Coach Overlay */}
      <div className="custom-coach-card">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <IconSparkles
              size={13}
              className="text-[var(--landing-accent)] animate-pulse"
            />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              AI Coach Feedback
            </span>
          </div>
          <div className="flex gap-1">
            {COACH_FEEDBACKS.map((fb, idx) => (
              <button
                key={fb.phase}
                onClick={() => setActiveFeedbackIdx(idx)}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                  activeFeedbackIdx === idx
                    ? "bg-[var(--landing-accent)] text-[var(--landing-bg)]"
                    : "bg-transparent border border-neutral-700"
                }`}
              >
                {fb.phase}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-[11px] leading-relaxed">
          <span className="italic">
            "{COACH_FEEDBACKS[activeFeedbackIdx]?.feedback}"
          </span>
          <span className="font-semibold mt-1">
            💡 Recommendation: {COACH_FEEDBACKS[activeFeedbackIdx]?.action}
          </span>
        </div>
      </div>
    </div>
  );
}

function DomainMockup() {
  const [activeTab, setActiveTab] = useState<"hft" | "sql" | "product">("hft");

  return (
    <div className="custom-domain-block">
      {/* Tabs */}
      <div className="custom-domain-tabs">
        <button
          onClick={() => setActiveTab("hft")}
          className={`domain-tab-btn ${activeTab === "hft" ? "active" : ""}`}
        >
          HFT (C++)
        </button>
        <button
          onClick={() => setActiveTab("sql")}
          className={`domain-tab-btn ${activeTab === "sql" ? "active" : ""}`}
        >
          SQL & Analytics
        </button>
        <button
          onClick={() => setActiveTab("product")}
          className={`domain-tab-btn ${activeTab === "product" ? "active" : ""}`}
        >
          Product Sense
        </button>
      </div>

      <div className="custom-domain-content">
        <AnimatePresence mode="wait">
          {activeTab === "hft" && (
            <motion.div
              key="hft"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-between"
            >
              <pre className="domain-code-pre">
                <code className="text-blue-400">#include &lt;atomic&gt;</code>
                {"\n"}
                <code className="text-purple-400">
                  template &lt;typename T, size_t Cap&gt;
                </code>
                {"\n"}
                <code className="text-green-400">
                  class lock_free_queue &#123;
                </code>
                {"\n"}
                <code>
                  {" "}
                  alignas(64) std::atomic&lt;size_t&gt; tail_&#123;0&#125;;
                </code>
                {"\n"}
                <code>
                  {" "}
                  alignas(64) std::atomic&lt;size_t&gt; head_&#123;0&#125;;
                </code>
                {"\n"}
                <code> T buffer_[Cap];</code>
                {"\n"}
                <code className="text-yellow-400">
                  {" "}
                  bool enqueue(T item) noexcept &#123;
                </code>
                {"\n"}
                <code>
                  {" "}
                  size_t tail = tail_.load(std::memory_order_relaxed);
                </code>
                {"\n"}
                <code> // lock-free pointer validation</code>
                {"\n"}
                <code> return tail_.compare_exchange_weak(...);</code>
                {"\n"}
                <code> &#125;</code>
                {"\n"}
                <code className="text-green-400">&#125;;</code>
              </pre>
              <div className="domain-metrics-row">
                <span className="domain-metric-badge green">latency: 38ns</span>
                <span className="domain-metric-badge blue">
                  allocations: 0 (zero-copy)
                </span>
              </div>
            </motion.div>
          )}

          {activeTab === "sql" && (
            <motion.div
              key="sql"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-between"
            >
              <pre className="domain-code-pre">
                <code className="text-yellow-400">WITH</code>
                <code> user_cohort AS (</code>
                {"\n"}
                <code> SELECT user_id, </code>
                {"\n"}
                <code>
                  {" "}
                  MIN(created_at) OVER (PARTITION BY user_id) as start_date
                </code>
                {"\n"}
                <code> FROM user_actions</code>
                {"\n"}
                <code>)</code>
                {"\n"}
                <code className="text-purple-400">SELECT</code>
                <code> cohort_week, COUNT(DISTINCT user_id)</code>
                {"\n"}
                <code className="text-purple-400">FROM</code>
                <code> user_cohort</code>
                {"\n"}
                <code className="text-purple-400">WHERE</code>
                <code> start_date &gt;= '2026-01-01'</code>
                {"\n"}
                <code className="text-purple-400">GROUP BY</code>
                <code> 1 ORDER BY 1 ASC;</code>
              </pre>
              <div className="domain-metrics-row">
                <span className="domain-metric-badge green">
                  cost: 4.88 (index scan)
                </span>
                <span className="domain-metric-badge green">
                  execution: 12ms
                </span>
              </div>
            </motion.div>
          )}

          {activeTab === "product" && (
            <motion.div
              key="product"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-between"
            >
              <div className="product-funnel-container">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-mono text-[var(--landing-fg-muted)]">
                    Conversion Funnel
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    +4.2% W/W
                  </span>
                </div>
                {[
                  { label: "Onboard", val: "92%", width: "92%" },
                  { label: "Search", val: "74%", width: "74%" },
                  { label: "Checkout", val: "45%", width: "45%" },
                  { label: "Pay Success", val: "28%", width: "28%" },
                ].map((step, idx) => (
                  <div key={idx} className="funnel-step">
                    <span className="funnel-label">{step.label}</span>
                    <div className="funnel-bar-wrapper">
                      <div
                        className="funnel-bar"
                        style={{ width: step.width }}
                      />
                    </div>
                    <span className="funnel-value">{step.val}</span>
                  </div>
                ))}
              </div>
              <div className="domain-metrics-row">
                <span className="domain-metric-badge blue">
                  North Star: Purchase CR
                </span>
                <span className="domain-metric-badge red">
                  Dropoff: Checkout (-38%)
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function CustomInterviews() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Smooth springs for desktop scrolling
  // CARD 1: DSA
  const dsaOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.15, 0.25, 1], [1, 1, 0, 0]),
    { stiffness: 100, damping: 20 },
  );
  const dsaTextY = useSpring(
    useTransform(scrollYProgress, [0, 0.15, 0.25, 1], [0, 0, -200, -200]),
    { stiffness: 100, damping: 20 },
  );
  const dsaVisualY = useSpring(
    useTransform(scrollYProgress, [0, 0.15, 0.25, 1], [0, 0, -250, -250]),
    { stiffness: 100, damping: 20 },
  );
  const dsaScale = useSpring(
    useTransform(scrollYProgress, [0, 0.15, 0.25, 1], [1, 1, 0.95, 0.95]),
    { stiffness: 100, damping: 20 },
  );
  const dsaBlurVal = useSpring(
    useTransform(scrollYProgress, [0, 0.15, 0.25, 1], [0, 0, 8, 8]),
    { stiffness: 100, damping: 20 },
  );
  const dsaBlur = useMotionTemplate`blur(${dsaBlurVal}px)`;

  // CARD 2: System Design
  const sysOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.15, 0.25, 0.4, 0.5, 1],
      [0, 0, 1, 1, 0, 0],
    ),
    { stiffness: 100, damping: 20 },
  );
  const sysTextY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.15, 0.25, 0.4, 0.5, 1],
      [200, 200, 0, 0, -200, -200],
    ),
    { stiffness: 100, damping: 20 },
  );
  const sysVisualY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.15, 0.25, 0.4, 0.5, 1],
      [250, 250, 0, 0, -250, -250],
    ),
    { stiffness: 100, damping: 20 },
  );
  const sysScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.15, 0.25, 0.4, 0.5, 1],
      [0.95, 0.95, 1, 1, 0.95, 0.95],
    ),
    { stiffness: 100, damping: 20 },
  );
  const sysBlurVal = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.15, 0.25, 0.4, 0.5, 1],
      [8, 8, 0, 0, 8, 8],
    ),
    { stiffness: 100, damping: 20 },
  );
  const sysBlur = useMotionTemplate`blur(${sysBlurVal}px)`;

  // CARD 3: Behavioral & Discussion
  const discOpacity = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.5, 0.65, 0.75, 1],
      [0, 0, 1, 1, 0, 0],
    ),
    { stiffness: 100, damping: 20 },
  );
  const discTextY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.5, 0.65, 0.75, 1],
      [200, 200, 0, 0, -200, -200],
    ),
    { stiffness: 100, damping: 20 },
  );
  const discVisualY = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.5, 0.65, 0.75, 1],
      [250, 250, 0, 0, -250, -250],
    ),
    { stiffness: 100, damping: 20 },
  );
  const discScale = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.5, 0.65, 0.75, 1],
      [0.95, 0.95, 1, 1, 0.95, 0.95],
    ),
    { stiffness: 100, damping: 20 },
  );
  const discBlurVal = useSpring(
    useTransform(
      scrollYProgress,
      [0, 0.4, 0.5, 0.65, 0.75, 1],
      [8, 8, 0, 0, 8, 8],
    ),
    { stiffness: 100, damping: 20 },
  );
  const discBlur = useMotionTemplate`blur(${discBlurVal}px)`;

  // CARD 4: Domain & Company-Specific
  const domOpacity = useSpring(
    useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [0, 0, 1, 1]),
    { stiffness: 100, damping: 20 },
  );
  const domTextY = useSpring(
    useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [200, 200, 0, 0]),
    { stiffness: 100, damping: 20 },
  );
  const domVisualY = useSpring(
    useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [250, 250, 0, 0]),
    { stiffness: 100, damping: 20 },
  );
  const domScale = useSpring(
    useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [0.95, 0.95, 1, 1]),
    { stiffness: 100, damping: 20 },
  );
  const domBlurVal = useSpring(
    useTransform(scrollYProgress, [0, 0.65, 0.75, 1], [8, 8, 0, 0]),
    { stiffness: 100, damping: 20 },
  );
  const domBlur = useMotionTemplate`blur(${domBlurVal}px)`;

  // Interactivity pointerEvents management
  const dsaPointerEvents = useTransform(scrollYProgress, (v) =>
    v < 0.2 ? "auto" : "none",
  );
  const sysPointerEvents = useTransform(scrollYProgress, (v) =>
    v >= 0.2 && v < 0.45 ? "auto" : "none",
  );
  const discPointerEvents = useTransform(scrollYProgress, (v) =>
    v >= 0.45 && v < 0.7 ? "auto" : "none",
  );
  const domPointerEvents = useTransform(scrollYProgress, (v) =>
    v >= 0.7 ? "auto" : "none",
  );

  const dsa = interviews[0]!;
  const sys = interviews[1]!;
  const disc = interviews[2]!;
  const dom = interviews[3]!;

  if (isMobile) {
    return (
      <section className="landing-container relative py-[8vh] border-b overflow-hidden">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--landing-fg-faint)] font-mono mb-3">
            INTERVIEW TYPES
          </span>
          <h2 className="landing-display text-[clamp(2rem,5vw,4rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] max-w-2xl">
            Master the exact rounds they will{" "}
            <span className="landing-serif italic text-[var(--landing-accent)]">
              test you on.
            </span>
          </h2>
          <p className="text-[14px] leading-relaxed text-[var(--landing-fg-muted)] max-w-lg mt-3">
            From low-latency C++ systems to behavioral deep-dives — practice in
            environments tailored for elite technical roles.
          </p>
        </div>

        {/* Vertical list of cards for mobile */}
        <div className="flex flex-col gap-16 mt-12">
          {interviews.map((item) => (
            <div
              key={item.id}
              className="custom-card flex flex-col gap-8 items-center text-center"
            >
              <div className="flex flex-col gap-4 items-center">
                <span
                  className="custom-status"
                  style={{
                    color: item.status.color,
                    borderColor: `${item.status.color}40`,
                  }}
                >
                  <span
                    className="custom-status-dot"
                    style={{ background: item.status.color }}
                  />
                  {item.status.label}
                </span>

                <h2 className="landing-display text-[clamp(1.8rem,4vw,2.5rem)] leading-[1.1] tracking-[-0.02em] text-[var(--landing-fg)]">
                  {item.title}{" "}
                  <span className="block landing-serif italic text-[var(--landing-accent)]">
                    {item.accent}
                  </span>
                </h2>

                <p className="text-[13px] leading-[1.7] text-[var(--landing-fg-muted)] max-w-md">
                  {item.description}
                </p>

                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  {item.features.map((f) => (
                    <span key={f} className="custom-feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-center w-full">
                {item.id === "dsa" && <CodeMockup />}
                {item.id === "system-design" && <ArchDiagram />}
                {item.id === "discussion" && <DiscussionMockup />}
                {item.id === "domain" && <DomainMockup />}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="custom-interviews-section border-b">
      <div className="custom-interviews-sticky">
        <div className="landing-container w-full flex flex-col h-full py-[8vh] justify-between box-border">
          {/* Header (pinned at top) */}
          <div className="flex flex-col items-center text-center">
            <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--landing-fg-faint)] font-mono mb-2">
              INTERVIEW TYPES
            </span>
            <h2 className="landing-display text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] max-w-2xl m-0">
              Master the exact rounds they will{" "}
              <span className="landing-serif italic text-[var(--landing-accent)]">
                test you on.
              </span>
            </h2>
            <p className="text-[13.5px] leading-relaxed text-[var(--landing-fg-muted)] max-w-lg mt-2 mb-0">
              From low-latency C++ systems to behavioral deep-dives — practice
              in environments tailored for elite technical roles.
            </p>
          </div>

          {/* Cards Container with Overlapping Grid */}
          <div className="grid-overlap flex-1 flex items-center justify-center mt-6 relative min-h-[420px]">
            {/* Card 1: DSA */}
            <motion.div
              style={{
                opacity: dsaOpacity,
                scale: dsaScale,
                filter: dsaBlur,
                pointerEvents: dsaPointerEvents,
              }}
              className="grid-overlap-item grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center w-full"
            >
              {/* Text Side */}
              <motion.div
                className="flex flex-col gap-4"
                style={{ y: dsaTextY }}
              >
                <span
                  className="custom-status self-start"
                  style={{
                    color: dsa.status.color,
                    borderColor: `${dsa.status.color}40`,
                  }}
                >
                  <span
                    className="custom-status-dot"
                    style={{ background: dsa.status.color }}
                  />
                  {dsa.status.label}
                </span>

                <h2 className="landing-display text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] m-0">
                  {dsa.title}{" "}
                  <span className="block landing-serif italic text-[var(--landing-accent)]">
                    {dsa.accent}
                  </span>
                </h2>

                <p className="text-[13.5px] leading-[1.75] text-[var(--landing-fg-muted)] max-w-sm m-0">
                  {dsa.description}
                </p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {dsa.features.map((f) => (
                    <span key={f} className="custom-feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Visual Side */}
              <motion.div
                className="flex justify-center"
                style={{ y: dsaVisualY }}
              >
                <CodeMockup />
              </motion.div>
            </motion.div>

            {/* Card 2: System Design */}
            <motion.div
              style={{
                opacity: sysOpacity,
                scale: sysScale,
                filter: sysBlur,
                pointerEvents: sysPointerEvents,
              }}
              className="grid-overlap-item grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center w-full"
            >
              {/* Text Side */}
              <motion.div
                className="flex flex-col gap-4"
                style={{ y: sysTextY }}
              >
                <span
                  className="custom-status self-start"
                  style={{
                    color: sys.status.color,
                    borderColor: `${sys.status.color}40`,
                  }}
                >
                  <span
                    className="custom-status-dot"
                    style={{ background: sys.status.color }}
                  />
                  {sys.status.label}
                </span>

                <h2 className="landing-display text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] m-0">
                  {sys.title}{" "}
                  <span className="block landing-serif italic text-[var(--landing-accent)]">
                    {sys.accent}
                  </span>
                </h2>

                <p className="text-[13.5px] leading-[1.75] text-[var(--landing-fg-muted)] max-w-sm m-0">
                  {sys.description}
                </p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {sys.features.map((f) => (
                    <span key={f} className="custom-feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Visual Side */}
              <motion.div
                className="flex justify-center"
                style={{ y: sysVisualY }}
              >
                <ArchDiagram />
              </motion.div>
            </motion.div>

            {/* Card 3: Behavioral & Discussion */}
            <motion.div
              style={{
                opacity: discOpacity,
                scale: discScale,
                filter: discBlur,
                pointerEvents: discPointerEvents,
              }}
              className="grid-overlap-item grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center w-full"
            >
              {/* Text Side */}
              <motion.div
                className="flex flex-col gap-4"
                style={{ y: discTextY }}
              >
                <span
                  className="custom-status self-start"
                  style={{
                    color: disc.status.color,
                    borderColor: `${disc.status.color}40`,
                  }}
                >
                  <span
                    className="custom-status-dot"
                    style={{ background: disc.status.color }}
                  />
                  {disc.status.label}
                </span>

                <h2 className="landing-display text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] m-0">
                  {disc.title}{" "}
                  <span className="block landing-serif italic text-[var(--landing-accent)]">
                    {disc.accent}
                  </span>
                </h2>

                <p className="text-[13.5px] leading-[1.75] text-[var(--landing-fg-muted)] max-w-sm m-0">
                  {disc.description}
                </p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {disc.features.map((f) => (
                    <span key={f} className="custom-feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Visual Side */}
              <motion.div
                className="flex justify-center"
                style={{ y: discVisualY }}
              >
                <DiscussionMockup />
              </motion.div>
            </motion.div>

            {/* Card 4: Domain & Company-Specific */}
            <motion.div
              style={{
                opacity: domOpacity,
                scale: domScale,
                filter: domBlur,
                pointerEvents: domPointerEvents,
              }}
              className="grid-overlap-item grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center w-full"
            >
              {/* Text Side */}
              <motion.div
                className="flex flex-col gap-4"
                style={{ y: domTextY }}
              >
                <span
                  className="custom-status self-start"
                  style={{
                    color: dom.status.color,
                    borderColor: `${dom.status.color}40`,
                  }}
                >
                  <span
                    className="custom-status-dot"
                    style={{ background: dom.status.color }}
                  />
                  {dom.status.label}
                </span>

                <h2 className="landing-display text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.05] tracking-[-0.03em] text-[var(--landing-fg)] m-0">
                  {dom.title}{" "}
                  <span className="block landing-serif italic text-[var(--landing-accent)]">
                    {dom.accent}
                  </span>
                </h2>

                <p className="text-[13.5px] leading-[1.75] text-[var(--landing-fg-muted)] max-w-sm m-0">
                  {dom.description}
                </p>

                <div className="flex flex-wrap gap-2 mt-1">
                  {dom.features.map((f) => (
                    <span key={f} className="custom-feature-pill">
                      {f}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* Visual Side */}
              <motion.div
                className="flex justify-center"
                style={{ y: domVisualY }}
              >
                <DomainMockup />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
