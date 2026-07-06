type MessageHandler = (data: unknown) => void;
declare const __WS_HOST__: string;

export class InterviewSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, MessageHandler[]>();
  private token: string;
  private closed = false;

  constructor(token: string) {
    this.token = token;
  }

  connect(interviewId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host =
        typeof __WS_HOST__ !== "undefined" ? __WS_HOST__ : "localhost:8080";
      this.ws = new WebSocket(`${protocol}//${host}`);

      this.ws.onopen = () => {
        this.send({ type: "init", interviewId, token: this.token });
      };

      this.ws.onmessage = (event) => {
        if (this.closed) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ready") {
            this.emit("ready", data);
            resolve();
            return;
          }
          if (data.type === "queued") {
            this.emit("queued", data);
            return;
          }
          if (data.error) {
            this.emit("error", data);
            reject(new Error(data.error));
            return;
          }

          const controlTypes = [
            "closing_started",
            "feedback_ready",
            "time_limit",
            "time_warning",
            "time_limit_reached",
            "position_update",
            "dsa_ready_next",
            "dsa_all_done",
            "dsa_code_update",
            "canvas_diff",
            "canvas_example",
            "canvas:next",
            "interviewer_reaction",
            "canvas:focus",
          ];
          if (
            typeof data.type === "string" &&
            controlTypes.includes(data.type)
          ) {
            this.emit(data.type, data);
          }

          this.emit("message", data);
          if (data.serverContent?.inputTranscription) {
            this.emit("transcript:user", data.serverContent.inputTranscription);
          }
          if (data.serverContent?.outputTranscription) {
            this.emit(
              "transcript:assistant",
              data.serverContent.outputTranscription,
            );
          }
        } catch {
          this.emit("raw", event.data);
        }
      };

      this.ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = () => {
        this.emit("close", null);
      };
    });
  }

  sendAudio(base64Pcm: string) {
    this.send({ type: "audio_chunk", data: base64Pcm });
  }

  sendAudioStreamEnd() {
    this.send({ type: "audio_stream_end" });
  }

  sendInterruptedStreamEnd() {
    this.send({ type: "audio_stream_end", interrupted: true });
  }

  sendEndInterview() {
    this.send({ type: "end_interview" });
  }

  sendCodeSnapshot(
    code: string,
    language: string,
    questionIndex: number,
    phase = "implementation",
  ) {
    this.send({
      type: "code_snapshot",
      code,
      language,
      questionIndex,
      phase,
    });
  }

  sendCodePreview(
    code: string,
    language: string,
    questionIndex: number,
    phase = "implementation",
  ) {
    this.send({
      type: "code_preview",
      code,
      language,
      questionIndex,
      phase,
    });
  }

  sendRequestHint(questionIndex: number) {
    this.send({ type: "request_hint", questionIndex });
  }

  sendLanguageChange(language: string) {
    this.send({ type: "language_change", language });
  }

  sendCanvasSnapshot(state: unknown) {
    this.send({ type: "canvas_snapshot", state });
  }

  forceClose() {
    this.closed = true;
    this.handlers.clear();
    this.ws?.close();
    this.ws = null;
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
    return () => {
      const handlers = this.handlers.get(event);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  private send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
