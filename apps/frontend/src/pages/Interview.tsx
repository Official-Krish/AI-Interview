import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "../lib/auth";
import { useMicrophone } from "../hooks/useMicrophone";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { InterviewSocket } from "../lib/ws";
import { api } from "../lib/api";
import { DsaPanel } from "../components/interview/DsaPanel";
import { WhiteboardPanel } from "@/components/system-design/WhiteboardPanel";
import { CaseStudyPanel } from "@/components/interview/CaseStudyPanel";
import type { CanvasDiffAction } from "@evalio/shared";
import { SEO } from "@/components/SEO";
import { Ambient } from "@/components/landing/Ambient";
import { PresenceOrb } from "@/components/interview/PresenceOrb";
import { SessionControls } from "@/components/interview/SessionControls";
import { SessionHeader } from "@/components/interview/SessionHeader";
import { LiveCaption } from "@/components/interview/LiveCaption";
import { InterviewConnecting } from "@/components/interview/InterviewConnecting";
import { InterviewClosing } from "@/components/interview/InterviewClosing";
import { InterviewQueue } from "@/components/interview/InterviewQueue";
import { ConfirmDialog } from "@/components/interview/ConfirmDialog";
import toast from "react-hot-toast";

type Phase =
  | "connecting"
  | "queued"
  | "ready"
  | "ai_speaking"
  | "user_speaking"
  | "ended";

export function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user;

  const { data: interviewData } = useQuery({
    queryKey: ["interview-meta", id],
    queryFn: () => api.getInterview(id!),
    enabled: !!id,
  });
  const interviewMeta = interviewData?.interview;
  const position = interviewMeta?.position ?? null;
  const companyName = interviewMeta?.companyName ?? null;
  const interviewStyle = interviewMeta?.interviewStyle ?? null;
  const interviewDepth = interviewMeta?.interviewDepth ?? null;

  const {
    start: startMic,
    stop: stopMic,
    isRecording: micActive,
    analyserRef: userAnalyserRef,
  } = useMicrophone();
  const {
    playPcm,
    stop: stopAudio,
    interrupt: interruptAudio,
    prewarm: prewarmAudio,
    isPlaying: aiPlaying,
    analyserRef: aiAnalyserRef,
  } = useAudioPlayer();
  const socketRef = useRef<InterviewSocket | null>(null);
  const endedRef = useRef(false);
  const dsaLastTransitionRef = useRef(-1);
  const dsaPendingRef = useRef<{ index?: number | null } | null>(null);

  const [isConnecting, setIsConnecting] = useState(true);
  const [closing, setClosing] = useState(false);
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [aiTurnActive, setAiTurnActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string; id: string }>
  >([]);
  const [queuedPosition, setQueuedPosition] = useState<number | null>(null);

  // DSA state
  const [dsaCode, setDsaCode] = useState("");
  const [dsaSessionData, setDsaSessionData] = useState<{
    problems: Array<{
      id: string;
      index: number;
      title: string;
      slug: string;
      difficulty: string;
      description: string;
      code: string | null;
      codeSnapshots: Record<string, string> | null;
      currentPhase: string;
      phasesCompleted: string[];
    }>;
    currentIndex: number;
    language: string;
  } | null>(null);
  const [dsaLoading, setDsaLoading] = useState(false);
  const isDsa = interviewMeta?.mode === "LIVE_CODE";
  const isSql = interviewMeta?.interviewRound === "SQL & Analytics";
  const isQuant = interviewMeta?.interviewRound === "Quantitative Analysis";
  const isHftCoding =
    interviewMeta?.interviewRound === "Low-Latency C++ Coding";
  const isSystemDesign = interviewMeta?.mode === "LIVE_CANVAS";
  const isDiscussion = interviewMeta?.mode === "DISCUSSION";
  const roundLabel = interviewMeta?.interviewRound;
  const isSdRound =
    isSystemDesign &&
    roundLabel &&
    !["Product Sense", "Design Critique", "Strategy & Vision"].includes(
      roundLabel,
    );
  const isCanvasRound =
    isSystemDesign &&
    roundLabel &&
    ["Product Sense", "Design Critique", "Strategy & Vision"].includes(
      roundLabel,
    );
  const sdConnectedRef = useRef(false);

  const dsaPanelVisible = useMemo(() => {
    return isDsa && !!dsaSessionData;
  }, [isDsa, dsaSessionData]);

  // Reaction state (from showReaction tool)
  const [interviewerReaction, setInterviewerReaction] = useState<string | null>(
    null,
  );
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Canvas focus state (from requestCanvasFocus tool)
  const [canvasFocus, setCanvasFocus] = useState<{
    nodeIds: string[];
    label: string | null;
  } | null>(null);
  const canvasFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // System Design state
  const [sdTopic, setSdTopic] = useState({
    title: "System Design",
    description: "Designing the system...",
  });
  const [canvasDiff, setCanvasDiff] = useState<CanvasDiffAction[] | null>(null);
  const [sdFullProblemText, setSdFullProblemText] = useState("");
  const [canvasQuestions, setCanvasQuestions] = useState<Array<{
    title: string;
    description: string;
    fullBreakdown: string;
  }> | null>(null);
  const canvasQuestionsRef = useRef(canvasQuestions);
  useEffect(() => {
    canvasQuestionsRef.current = canvasQuestions;
  }, [canvasQuestions]);
  const canvasCurrentQuestionIndexRef = useRef(0);
  const setCanvasCurrentQuestionIndex = (val: number) => {
    canvasCurrentQuestionIndexRef.current = val;
  };
  const sdPanelVisible = isSystemDesign || isDiscussion;

  // Load DSA / SD session on mount
  const { mutate: loadSqlSession } = useMutation({
    mutationFn: () => {
      setDsaLoading(true);
      return api.startSqlSession(id!);
    },
    onSuccess: (data) => {
      setDsaLoading(false);
      const session = data.session as Record<string, unknown>;
      if (!session) return;
      const currentIndex = (session.currentIndex as number) ?? 0;
      const problems =
        (session.problems as Array<{
          id: string;
          index: number;
          title: string;
          slug: string;
          difficulty: string;
          description: string;
          code: string | null;
          codeSnapshots: Record<string, string> | null;
          currentPhase: string;
          phasesCompleted: string[];
        }>) ?? [];
      setDsaSessionData({
        problems,
        currentIndex,
        language: (session.language as string) ?? "sql",
      });
    },
    onError: () => setDsaLoading(false),
  });

  const { mutate: loadHftSession } = useMutation({
    mutationFn: () => {
      setDsaLoading(true);
      return api.startHftSession(id!);
    },
    onSuccess: (data) => {
      setDsaLoading(false);
      const session = data.session as Record<string, unknown>;
      if (!session) return;
      const currentIndex = (session.currentIndex as number) ?? 0;
      const problems =
        (session.problems as Array<{
          id: string;
          index: number;
          title: string;
          slug: string;
          difficulty: string;
          description: string;
          code: string | null;
          codeSnapshots: Record<string, string> | null;
          currentPhase: string;
          phasesCompleted: string[];
        }>) ?? [];
      setDsaSessionData({
        problems,
        currentIndex,
        language: (session.language as string) ?? "cpp",
      });
      const firstProblem = problems[0];
      if (firstProblem) {
        setDsaCode((firstProblem.code as string) ?? "");
      }
    },
    onError: () => setDsaLoading(false),
  });

  const { mutate: loadDsaSession } = useMutation({
    mutationFn: () => {
      setDsaLoading(true);
      return api.startDsaSession(id!);
    },
    onSuccess: (data) => {
      setDsaLoading(false);
      const session = data.session as Record<string, unknown>;
      if (!session) return;
      const currentIndex = (session.currentIndex as number) ?? 0;
      const problems =
        (session.problems as Array<{
          id: string;
          index: number;
          title: string;
          slug: string;
          difficulty: string;
          description: string;
          code: string | null;
          codeSnapshots: Record<string, string> | null;
          currentPhase: string;
          phasesCompleted: string[];
        }>) ?? [];
      setDsaSessionData({
        problems,
        currentIndex,
        language: (session.language as string) ?? "javascript",
      });
      const firstProblem = problems[0];
      if (firstProblem) {
        setDsaCode((firstProblem.code as string) ?? "");
      }
      const pending = dsaPendingRef.current;
      if (pending) {
        dsaPendingRef.current = null;
        const nextIdx = pending.index ?? currentIndex + 1;
        if (
          nextIdx < problems.length &&
          nextIdx > dsaLastTransitionRef.current
        ) {
          dsaLastTransitionRef.current = nextIdx;
          setDsaSessionData((prev) =>
            prev
              ? {
                  ...prev,
                  currentIndex: nextIdx,
                  problems: prev.problems.map((p, i) =>
                    i === nextIdx
                      ? {
                          ...p,
                          currentPhase: "understanding",
                          phasesCompleted: [],
                        }
                      : p,
                  ),
                }
              : prev,
          );
          const nextProblem = problems[nextIdx];
          if (nextProblem) {
            setDsaCode((nextProblem.code as string) ?? "");
          }
        }
      }
    },
    onError: () => setDsaLoading(false),
  });

  const { mutate: loadSdSession } = useMutation({
    mutationFn: () => {
      setSdStarting(true);
      return api.startSdSession(id!);
    },
    onSuccess: (data) => {
      setSdStarting(false);
      if (data.title && data.description) {
        setSdTopic({ title: data.title, description: data.description });
        setSdFullProblemText(data.fullBreakdown);
      }
      if (!sdConnectedRef.current) {
        sdConnectedRef.current = true;
        connectSocket().catch((err: Error) => {
          if (mountedRef.current && !endedRef.current) {
            setError(err.message);
            toast.error(err.message);
          }
        });
      }
    },
    onError: () => {
      setSdStarting(false);
    },
  });

  const { mutate: loadCanvasSession } = useMutation({
    mutationFn: () => {
      setSdStarting(true);
      return api.startCanvasSession(id!);
    },
    onSuccess: (data) => {
      setSdStarting(false);
      const d = data as Record<string, unknown>;
      const questions = d.questions as
        | Array<{ title: string; description: string; fullBreakdown: string }>
        | undefined;
      if (questions && questions.length > 0) {
        setCanvasQuestions(questions);
        setCanvasCurrentQuestionIndex(0);
        const first = questions[0]!;
        setSdTopic({ title: first.title, description: first.description });
        setSdFullProblemText(first.fullBreakdown);
      }
      if (!sdConnectedRef.current) {
        sdConnectedRef.current = true;
        connectSocket().catch((err: Error) => {
          if (mountedRef.current && !endedRef.current) {
            setError(err.message);
            toast.error(err.message);
          }
        });
      }
    },
    onError: () => {
      setSdStarting(false);
    },
  });

  const { mutate: loadDiscussionSession } = useMutation({
    mutationFn: () => {
      setSdStarting(true);
      return api.startDiscussionSession(id!);
    },
    onSuccess: (data) => {
      setSdStarting(false);
      const d = data as Record<string, unknown>;
      const questions = d.questions as
        | Array<{ title: string; description: string; fullBreakdown: string }>
        | undefined;
      if (questions && questions.length > 0) {
        setCanvasQuestions(questions);
        setCanvasCurrentQuestionIndex(0);
        const first = questions[0]!;
        setSdTopic({ title: first.title, description: first.description });
        setSdFullProblemText(first.fullBreakdown);
      }
      if (!sdConnectedRef.current) {
        sdConnectedRef.current = true;
        connectSocket().catch((err: Error) => {
          if (mountedRef.current && !endedRef.current) {
            setError(err.message);
            toast.error(err.message);
          }
        });
      }
    },
    onError: () => {
      setSdStarting(false);
    },
  });

  const { mutate: loadQuantSession } = useMutation({
    mutationFn: () => {
      setDsaLoading(true);
      return api.startQuantSession(id!);
    },
    onSuccess: (data) => {
      setDsaLoading(false);
      const session = data.session as Record<string, unknown>;
      if (!session) return;
      const currentIndex = (session.currentIndex as number) ?? 0;
      const problems =
        (session.problems as Array<{
          id: string;
          index: number;
          title: string;
          slug: string;
          difficulty: string;
          description: string;
          code: string | null;
          codeSnapshots: Record<string, string> | null;
          currentPhase: string;
          phasesCompleted: string[];
        }>) ?? [];
      setDsaSessionData({
        problems,
        currentIndex,
        language: (session.language as string) ?? "text",
      });
    },
    onError: () => setDsaLoading(false),
  });

  useEffect(() => {
    if (!id) return;
    if (isQuant) loadQuantSession();
    else if (isSql) loadSqlSession();
    else if (isHftCoding) loadHftSession();
    else if (isDsa) loadDsaSession();
  }, [
    isQuant,
    isSql,
    isHftCoding,
    isDsa,
    id,
    loadQuantSession,
    loadSqlSession,
    loadHftSession,
    loadDsaSession,
  ]);

  useEffect(() => {
    if (!id) return;
    if (isCanvasRound) loadCanvasSession();
    else if (isDiscussion) loadDiscussionSession();
    else if (isSdRound) loadSdSession();
  }, [
    isCanvasRound,
    isDiscussion,
    isSdRound,
    id,
    loadCanvasSession,
    loadDiscussionSession,
    loadSdSession,
  ]);

  const [sdStarting, setSdStarting] = useState(false);
  const latestCodeRef = useRef(dsaCode);
  const sessionDataRef = useRef(dsaSessionData);
  useEffect(() => {
    latestCodeRef.current = dsaCode;
  }, [dsaCode]);
  useEffect(() => {
    sessionDataRef.current = dsaSessionData;
  }, [dsaSessionData]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dedup refs — never updated from inside an effect dep array
  const lastPreviewedCodeRef = useRef("");
  const lastSavedCodeRef = useRef("");

  // Stable interval: reads latest code from refs, not affected by keystrokes
  useEffect(() => {
    if (!isDsa || !socketRef.current) return;
    const interval = setInterval(() => {
      const code = latestCodeRef.current;
      if (!code || code === lastPreviewedCodeRef.current) return;
      const sd = sessionDataRef.current;
      if (!sd) return;
      lastPreviewedCodeRef.current = code;
      socketRef.current?.sendCodePreview(
        code,
        sd.language,
        sd.currentIndex,
        sd.problems[sd.currentIndex]?.currentPhase ?? "implementation",
      );
    }, 20000);
    return () => clearInterval(interval);
  }, [isDsa]);

  // Debounced save: fires 25s after last code change; skip if unchanged since last save
  useEffect(() => {
    if (!isDsa || !socketRef.current || !dsaSessionData) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!dsaCode || dsaCode === lastSavedCodeRef.current) return;
      lastSavedCodeRef.current = dsaCode;
      const sd = sessionDataRef.current;
      if (!sd) return;
      socketRef.current?.sendCodeSnapshot(
        dsaCode,
        sd.language,
        sd.currentIndex,
        sd.problems[sd.currentIndex]?.currentPhase ?? "implementation",
      );
    }, 30000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dsaCode, isDsa, dsaSessionData]);

  const phase = useMemo((): Phase => {
    if (feedbackReady) return "ended";
    if (isConnecting && queuedPosition !== null) return "queued";
    if (isConnecting) return "connecting";
    if (aiPlaying || aiTurnActive) return "ai_speaking";
    if (micActive) return "user_speaking";
    return "ready";
  }, [
    feedbackReady,
    isConnecting,
    queuedPosition,
    aiPlaying,
    aiTurnActive,
    micActive,
  ]);

  const remainingMs = useMemo(() => {
    if (!timeLimit) return null;
    return Math.max(0, timeLimit - duration * 1000);
  }, [timeLimit, duration]);

  const aiSpeakingRef = useRef(false);
  const phaseRef = useRef(phase);
  const autoEndPendingRef = useRef(false);
  const turnCompletedRef = useRef(false);
  const isUserSpeakingRef = useRef(false);
  const closingRef = useRef(false);
  const feedbackReadyRef = useRef(false);
  const mountedRef = useRef(true);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    const wasSpeaking = aiSpeakingRef.current;
    aiSpeakingRef.current = aiPlaying;
    if (!aiPlaying && wasSpeaking && !endedRef.current && !micActive) {
      setAiTurnActive(false);
    }
  }, [aiPlaying, micActive]);

  useEffect(() => {
    closingRef.current = closing;
  }, [closing]);
  useEffect(() => {
    feedbackReadyRef.current = feedbackReady;
  }, [feedbackReady]);

  useEffect(() => {
    document.documentElement.classList.add("landing-active");
    return () => document.documentElement.classList.remove("landing-active");
  }, []);

  const teardown = useCallback(() => {
    endedRef.current = true;
    setAiTurnActive(false);
    stopMic();
    stopAudio();
    socketRef.current?.forceClose();
    socketRef.current = null;
  }, [stopMic, stopAudio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const connectSocket = useCallback(async () => {
    if (
      !user ||
      !id ||
      endedRef.current ||
      connectedRef.current ||
      connectingRef.current
    ) {
      return;
    }

    connectingRef.current = true;

    let wsToken: string;
    try {
      const res = await api.getWsToken();
      wsToken = res.token;
    } catch {
      toast.error("Authentication failed");
      connectingRef.current = false;
      return;
    }

    const socket = new InterviewSocket(wsToken);
    socketRef.current = socket;

    socket.on("ready", () => {
      if (endedRef.current) return;
      setQueuedPosition(null);
      setIsConnecting(false);
      setAiTurnActive(true);
    });

    socket.on("queued", (data: unknown) => {
      if (endedRef.current) return;
      const msg = data as Record<string, unknown>;
      if (typeof msg.position === "number") {
        setQueuedPosition(msg.position);
      }
    });

    socket.on("position_update", (data: unknown) => {
      if (endedRef.current) return;
      const msg = data as Record<string, unknown>;
      if (typeof msg.position === "number") {
        setQueuedPosition(msg.position);
      }
    });

    socket.on("transcript:assistant", () => {
      if (endedRef.current) return;
      if (!turnCompletedRef.current) {
        turnCompletedRef.current = true;
        setAiTurnActive(true);
      }
    });

    socket.on("transcript:user", () => {
      if (endedRef.current) return;
      setAiTurnActive(false);
    });

    socket.on("message", (raw: unknown) => {
      if (endedRef.current) return;

      const data = raw as Record<string, unknown>;
      const sc = data?.serverContent as Record<string, unknown> | undefined;
      if (!sc) return;

      const inputText = (
        sc.inputTranscription as Record<string, unknown> | undefined
      )?.text as string | undefined;
      const outputText = (
        sc.outputTranscription as Record<string, unknown> | undefined
      )?.text as string | undefined;
      const turnComplete = sc.turnComplete === true;
      const modelTurn = sc.modelTurn as Record<string, unknown> | undefined;
      const parts =
        (modelTurn?.parts as Array<Record<string, unknown>> | undefined) ?? [];

      let audioBase64: string | null = null;
      for (const part of parts) {
        const inlineData = part.inlineData as
          | Record<string, unknown>
          | undefined;
        if (inlineData && (inlineData.mimeType as string)?.includes("audio")) {
          audioBase64 = inlineData.data as string;
        }
      }

      // AI interrupting — stop mic immediately if user is speaking
      if (audioBase64 && isUserSpeakingRef.current && !endedRef.current) {
        isUserSpeakingRef.current = false;
        stopMic();
        socketRef.current?.sendInterruptedStreamEnd();
      }

      if (audioBase64 && !endedRef.current) {
        aiSpeakingRef.current = true;
        playPcm(audioBase64);
        if (!turnCompletedRef.current) {
          setAiTurnActive(true);
        }
      }

      if (sc.interrupted && !endedRef.current) {
        aiSpeakingRef.current = false;
        interruptAudio();
        setAiTurnActive(false);
        turnCompletedRef.current = false;
      }

      if (turnComplete && outputText) {
        turnCompletedRef.current = true;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: outputText, id: `ai-${Date.now()}` },
        ]);

        // Detect AI signaling end-of-interview — auto-trigger closing
        if (outputText.includes("Thank you for interviewing with Evalio")) {
          autoEndPendingRef.current = true;
          setTimeout(() => {
            if (autoEndPendingRef.current && !endedRef.current) {
              autoEndPendingRef.current = false;
              socketRef.current?.sendEndInterview();
            }
          }, 800);
        }
        setAiTurnActive(false);
      }

      if (turnComplete && inputText) {
        setMessages((prev) => [
          ...prev,
          { role: "user", text: inputText, id: `user-${Date.now()}` },
        ]);
        setAiTurnActive(true);
      }
    });

    socket.on("error", (err: unknown) => {
      if (!mountedRef.current || endedRef.current) return;
      const msg = (err as Record<string, unknown>)?.error as string | undefined;
      setError(msg || "Connection failed");
      toast.error(msg || "Connection failed");
    });

    socket.on("close", () => {
      if (!endedRef.current && phaseRef.current !== "ended") {
        teardown();
      }
    });

    // Graceful end-flow events
    socket.on("closing_started", () => {
      setClosing(true);
      stopMic();
    });

    socket.on("feedback_ready", () => {
      setFeedbackReady(true);
      stopAudio();
      endedRef.current = true;
      socketRef.current?.forceClose();
      socketRef.current = null;
      navigate(`/results/${id}`, { replace: true });
    });

    socket.on("dsa_ready_next", (data) => {
      const msg = data as { index?: number | null };
      if (!sessionDataRef.current) {
        dsaPendingRef.current = msg;
        return;
      }
      flushSync(() => {
        setDsaSessionData((prev) => {
          if (!prev) return prev;
          const nextIdx = msg.index ?? prev.currentIndex + 1;
          if (
            nextIdx >= prev.problems.length ||
            nextIdx <= dsaLastTransitionRef.current
          ) {
            return prev;
          }
          dsaLastTransitionRef.current = nextIdx;
          return {
            ...prev,
            currentIndex: nextIdx,
            problems: prev.problems.map((p, i) =>
              i === nextIdx
                ? { ...p, currentPhase: "understanding", phasesCompleted: [] }
                : p,
            ),
          };
        });
        setDsaCode("");
      });
    });

    socket.on("dsa_all_done", () => {
      if (!closingRef.current && !endedRef.current) {
        setClosing(true);
        stopMic();
        socketRef.current?.sendEndInterview();
      }
    });

    socket.on("dsa_code_update", (data) => {
      const msg = data as { code?: string };
      const newCode = msg.code;
      if (newCode != null) {
        flushSync(() => {
          setDsaCode(newCode);
        });
      }
    });

    // System Design WS events
    socket.on("canvas:next", (data: unknown) => {
      const msg = data as { questionIndex: number };
      setCanvasCurrentQuestionIndex(msg.questionIndex);
      const questions = canvasQuestionsRef.current;
      if (questions && msg.questionIndex < questions.length) {
        const q = questions[msg.questionIndex]!;
        setSdTopic({ title: q.title, description: q.description });
        setSdFullProblemText(q.fullBreakdown);
        setCanvasDiff(null);
        toast(`Moving to question ${msg.questionIndex + 1}`, {
          duration: 3000,
        });
      }
    });

    socket.on("canvas_diff", (data: unknown) => {
      const msg = data as { diff: CanvasDiffAction[]; thumbnail?: string };
      if (msg.diff) {
        setCanvasDiff(msg.diff);
      }
    });

    socket.on("canvas_example", (data: unknown) => {
      const msg = data as {
        title?: string;
        nodes?: unknown[];
        edges?: unknown[];
      };
      toast(`AI shared a reference architecture: ${msg.title ?? "example"}`, {
        duration: 5000,
      });
    });

    socket.on("interviewer_reaction", (data: unknown) => {
      if (endedRef.current) return;
      const msg = data as { reaction?: string };
      if (!msg.reaction) return;
      setInterviewerReaction(msg.reaction);
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
      reactionTimerRef.current = setTimeout(
        () => setInterviewerReaction(null),
        3000,
      );
    });

    socket.on("canvas:focus", (data: unknown) => {
      if (endedRef.current) return;
      const msg = data as { nodeIds?: string[]; label?: string | null };
      if (!msg.nodeIds?.length) return;
      setCanvasFocus({
        nodeIds: msg.nodeIds,
        label: msg.label ?? null,
      });
      if (canvasFocusTimerRef.current)
        clearTimeout(canvasFocusTimerRef.current);
      canvasFocusTimerRef.current = setTimeout(
        () => setCanvasFocus(null),
        4000,
      );
    });

    // Time cap events
    socket.on("time_limit", (data: unknown) => {
      const msg = data as Record<string, unknown>;
      if (typeof msg.limitMs === "number") {
        setTimeLimit(msg.limitMs);
      }
    });

    socket.on("time_warning", () => {
      toast("One minute remaining", {
        icon: "\u23F0",
        duration: 5000,
      });
    });

    socket.on("time_limit_reached", () => {
      if (!closingRef.current && !endedRef.current) {
        setClosing(true);
        stopMic();
        socketRef.current?.sendEndInterview();
      }
    });

    try {
      await socket.connect(id);
      connectedRef.current = true;
    } finally {
      connectingRef.current = false;
    }
  }, [user, id, playPcm, stopAudio, teardown, navigate, stopMic]);

  useEffect(() => {
    if (!interviewMeta) return;
    if (isSystemDesign || isDiscussion) return;
    // Unlock the AudioContext before the socket connects so the browser
    // autoplay policy doesn't block the AI greeting (which arrives immediately).
    prewarmAudio().finally(() => {
      connectSocket().catch((err: Error) => {
        if (mountedRef.current && !endedRef.current) {
          setError(err.message);
          toast.error(err.message);
        }
      });
    });
    return () => {
      // Only close if connection never succeeded — real unmount is handled
      // by the mountedRef effect which calls teardown().
      if (!connectedRef.current) {
        socketRef.current?.forceClose();
        socketRef.current = null;
      }
    };
  }, [
    connectSocket,
    prewarmAudio,
    !!interviewMeta,
    isSystemDesign,
    isDiscussion,
  ]);

  useEffect(() => {
    if (phase === "ended" || phase === "connecting" || phase === "queued")
      return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Safety timeout: if closing takes >2min, force-navigate to results
  useEffect(() => {
    if (!closing || feedbackReady) return;
    const timer = setTimeout(() => {
      if (!feedbackReady) {
        toast.error("Closing timed out — redirecting to results");
        teardown();
        navigate(`/results/${id}`, { replace: true });
      }
    }, 120_000);
    return () => clearTimeout(timer);
  }, [closing, feedbackReady, id, navigate, teardown]);

  useEffect(() => {
    if (endedRef.current || closing || feedbackReady) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [closing, feedbackReady]);

  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const handleEnd = useCallback(() => {
    if (endedRef.current || closing || feedbackReady) return;
    setShowEndConfirm(true);
  }, [closing, feedbackReady]);

  const confirmEnd = useCallback(() => {
    setShowEndConfirm(false);
    setClosing(true);
    stopMic();
    socketRef.current?.sendEndInterview();
  }, [stopMic]);

  const handleMicToggle = async () => {
    if (endedRef.current || closing || feedbackReady) return;

    if (micActive) {
      isUserSpeakingRef.current = false;
      stopMic();
      socketRef.current?.sendAudioStreamEnd();
      return;
    }

    if (aiPlaying || aiTurnActive) {
      // AI is speaking — user cannot interrupt
      return;
    }

    try {
      isUserSpeakingRef.current = true;
      const vadTimeoutMs =
        isDsa || isSystemDesign ? 60000 : isDiscussion ? 30000 : 20000;
      await startMic(
        (base64) => {
          if (!endedRef.current) {
            socketRef.current?.sendAudio(base64);
          }
        },
        {
          timeoutMs: vadTimeoutMs,
          onSilenceEnd: () => {
            if (
              endedRef.current ||
              closingRef.current ||
              feedbackReadyRef.current
            )
              return;
            isUserSpeakingRef.current = false;
            stopMic();
            socketRef.current?.sendAudioStreamEnd();
          },
        },
      );
    } catch {
      isUserSpeakingRef.current = false;
      toast.error("Microphone access denied");
    }
  };

  const activeSide = phase === "ai_speaking" ? "ai" : "user";
  const activeAnalyser = activeSide === "ai" ? aiAnalyserRef : userAnalyserRef;

  const handleLeaveQueue = useCallback(() => {
    teardown();
    navigate("/dashboard");
  }, [teardown, navigate]);

  if (error) {
    return (
      <div className="interview-room flex flex-col items-center justify-center min-h-[100dvh] gap-6 px-6">
        <p className="text-[14px] text-[var(--landing-fg-muted)] text-center max-w-sm">
          {error}
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="landing-cta-primary landing-cta-sharp text-[13px]"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (phase === "connecting") {
    return <InterviewConnecting sdStarting={sdStarting} />;
  }

  if (phase === "queued") {
    return (
      <InterviewQueue
        position={queuedPosition ?? 1}
        onLeave={handleLeaveQueue}
      />
    );
  }

  if (closing && !feedbackReady) {
    return <InterviewClosing />;
  }

  return (
    <div className="interview-room landing-page min-h-[100dvh] flex flex-col relative overflow-hidden">
      <SEO title="Interview" noindex />
      <Ambient />

      <div
        className="relative z-10 flex flex-col min-h-[100dvh]"
        style={(() => {
          if (isDsa && dsaPanelVisible)
            return { marginRight: "min(520px, 45vw)" };
          if (isDiscussion) return { marginRight: "55vw" };
          if (isSystemDesign && sdPanelVisible) return { marginRight: "60vw" };
          return undefined;
        })()}
      >
        <div className="landing-container pt-6">
          <SessionHeader
            position={position}
            duration={duration}
            phase={phase}
            timeLimit={timeLimit}
            remainingMs={remainingMs}
            companyName={companyName}
            interviewStyle={interviewStyle}
            interviewDepth={interviewDepth}
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
          <div className="interview-orb-stage">
            <PresenceOrb
              analyserRef={activeAnalyser}
              phase={phase}
              side={activeSide}
            />
          </div>
        </div>

        <div className="landing-container pb-4">
          <LiveCaption
            messages={messages}
            phase={phase}
            thinking={aiTurnActive && !aiPlaying}
            reaction={interviewerReaction}
          />
        </div>

        <div className="landing-container pb-10 pt-2">
          <SessionControls
            micActive={micActive}
            phase={phase}
            onMicToggle={handleMicToggle}
            onEnd={handleEnd}
            ending={closing}
            userAnalyserRef={userAnalyserRef}
          />
        </div>
      </div>

      {isDsa && (
        <>
          {/* Loading skeleton */}
          {dsaLoading && !dsaSessionData && (
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: "min(520px, 45vw)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                background: "var(--db-card-bg)",
                borderLeft: "1px solid var(--app-accent-border)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: "var(--db-card-shadow)",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: "3px solid var(--color-border)",
                  borderTopColor: "var(--color-text)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                }}
              >
                Loading coding session...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {dsaSessionData && (
            <DsaPanel
              problems={dsaSessionData.problems}
              currentIndex={dsaSessionData.currentIndex}
              language={dsaSessionData.language}
              code={dsaCode}
              onCodeChange={setDsaCode}
              visible={dsaPanelVisible}
              onRequestHint={() =>
                socketRef.current?.sendRequestHint(dsaSessionData.currentIndex)
              }
              {...(isSql || isHftCoding
                ? {}
                : {
                    onLanguageChange: (lang: string) => {
                      setDsaSessionData((prev) =>
                        prev ? { ...prev, language: lang } : prev,
                      );
                      socketRef.current?.sendLanguageChange(lang);
                    },
                  })}
            />
          )}
        </>
      )}

      {isSystemDesign && (
        <WhiteboardPanel
          visible={sdPanelVisible}
          topicTitle={sdTopic.title}
          topicDescription={sdTopic.description}
          fullProblemText={sdFullProblemText}
          onCanvasSnapshot={(snapshot) => {
            socketRef.current?.sendCanvasSnapshot(snapshot);
          }}
          canvasDiff={canvasDiff}
          onClearCanvasDiff={() => setCanvasDiff(null)}
          canvasFocus={canvasFocus}
          onClearCanvasFocus={() => setCanvasFocus(null)}
        />
      )}

      {isDiscussion && (
        <CaseStudyPanel
          visible={true}
          topicTitle={sdTopic.title}
          topicDescription={sdTopic.description}
          fullProblemText={sdFullProblemText}
        />
      )}

      <ConfirmDialog
        open={showEndConfirm}
        title="End interview?"
        message="You'll receive a closing summary and feedback."
        confirmLabel="End interview"
        cancelLabel="Cancel"
        onConfirm={confirmEnd}
        onCancel={() => setShowEndConfirm(false)}
      />
    </div>
  );
}
