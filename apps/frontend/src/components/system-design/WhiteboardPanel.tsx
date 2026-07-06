import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { motion } from "motion/react";
import { useTheme } from "../../lib/use-theme";
import { useCanvasSerializer } from "./useCanvasSerializer";
import { applyCanvasDiff } from "./ApplyCanvasActions";
import type { CanvasDiffAction, CanvasSnapshot } from "@evalio/shared";

interface WhiteboardPanelProps {
  visible: boolean;
  topicTitle: string;
  topicDescription: string;
  fullProblemText: string;
  onCanvasSnapshot: (snapshot: CanvasSnapshot) => void;
  canvasDiff: CanvasDiffAction[] | null;
  onClearCanvasDiff: () => void;
  canvasFocus?: {
    nodeIds: string[];
    label: string | null;
  } | null;
  onClearCanvasFocus?: () => void;
}

type Tab = "whiteboard" | "problem";

const tabs: { key: Tab; label: string }[] = [
  { key: "problem", label: "Problem" },
  { key: "whiteboard", label: "Whiteboard" },
];

export function WhiteboardPanel({
  visible,
  topicTitle,
  topicDescription,
  fullProblemText,
  onCanvasSnapshot,
  canvasDiff,
  onClearCanvasDiff,
  canvasFocus,
  onClearCanvasFocus,
}: WhiteboardPanelProps) {
  const [tab, setTab] = useState<Tab>("problem");
  const [canvasReady, setCanvasReady] = useState(false);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // Dynamic theme synchronization
  const { theme } = useTheme();

  const serializer = useCanvasSerializer(
    useCallback(
      (snapshot: CanvasSnapshot) => {
        onCanvasSnapshot(snapshot);
      },
      [onCanvasSnapshot],
    ),
  );

  const handleExcalidrawChange = useCallback(
    (elements: readonly Record<string, unknown>[]) => {
      if (!canvasReady) return;
      serializer.onChange(elements);
    },
    [serializer, canvasReady],
  );

  useEffect(() => {
    if (canvasDiff && canvasDiff.length > 0 && apiRef.current) {
      applyCanvasDiff(apiRef.current, canvasDiff);
      onClearCanvasDiff();
    }
  }, [canvasDiff, onClearCanvasDiff]);

  useEffect(() => {
    if (!canvasFocus || !apiRef.current) return;
    const api = apiRef.current;
    const elements = api.getSceneElements();
    const target = elements.find((el) => canvasFocus.nodeIds.includes(el.id));
    if (target) api.scrollToContent(target);
    if (canvasFocus.label) {
      console.log(`[canvas:focus] ${canvasFocus.label}`);
    }
    if (onClearCanvasFocus) onClearCanvasFocus();
  }, [canvasFocus, onClearCanvasFocus]);

  useEffect(() => {
    if (document.querySelector('link[href*="excalidraw"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/excalidraw.css";
    document.head.appendChild(link);
  }, []);

  const problemHtml = useMemo(() => {
    if (!fullProblemText) return "";
    const raw = marked.parse(fullProblemText, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [fullProblemText]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 right-0 bottom-0 w-[60vw] z-50 flex flex-col border-l backdrop-blur-2xl shadow-2xl transition-all duration-300"
      style={{
        borderColor: "var(--landing-line, rgba(255, 255, 255, 0.08))",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.01) 0%, rgba(255, 255, 255, 0.03) 100%), var(--color-bg-card, rgba(18, 18, 18, 0.8))",
      }}
    >
      {/* ── Topic Question Bar ── */}
      <div
        className="px-6 py-4 border-b bg-black/[0.01] dark:bg-white/[0.01]"
        style={{
          borderColor: "var(--landing-line, rgba(255, 255, 255, 0.08))",
        }}
      >
        <h3 className="m-0 text-sm font-semibold tracking-tight text-[var(--color-text)]">
          {topicTitle}
        </h3>
        <p className="m-0 mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {topicDescription}
        </p>
      </div>

      {/* ── Tab Bar ── */}
      <div
        className="flex border-b p-1.5 gap-1.5 bg-black/[0.02] dark:bg-white/[0.02]"
        style={{
          borderColor: "var(--landing-line, rgba(255, 255, 255, 0.08))",
        }}
      >
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-grow py-2 px-4 text-xs font-semibold rounded-lg transition-all duration-300 relative outline-none border-0 cursor-pointer ${
                isActive
                  ? "text-[var(--app-accent, #b8a88a)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
              }`}
              style={{ background: "transparent" }}
            >
              {isActive && (
                <motion.div
                  layoutId="whiteboard-tab-active"
                  className="absolute inset-0 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.02] dark:border-white/[0.02]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {tab === "problem" ? (
        <div className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-[var(--color-text-secondary)] prose dark:prose-invert max-w-none sd-problem-text">
          {problemHtml ? (
            <div dangerouslySetInnerHTML={{ __html: problemHtml }} />
          ) : (
            <p className="text-[var(--color-text-muted)] font-mono text-xs">
              Waiting for the interviewer to present the problem...
            </p>
          )}
        </div>
      ) : (
        /* ── Excalidraw Canvas ── */
        <div className="flex-grow relative overflow-hidden bg-[var(--color-bg)]">
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api;
              setCanvasReady(true);
            }}
            onChange={handleExcalidrawChange}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveToActiveFile: false,
                toggleTheme: false,
                saveAsImage: false,
              },
              tools: {
                image: false,
              },
            }}
            theme={theme}
            viewModeEnabled={false}
            name="System Design Whiteboard"
          />
        </div>
      )}
    </div>
  );
}
