import { useRef, useState, useCallback } from "react";

interface VadOptions {
  timeoutMs?: number;
  onSilenceEnd?: () => void;
}

interface VadState {
  noiseFloor: number;
  speaking: boolean;
  silenceStart: number;
  lastSpeechEnd: number;
  samplesSinceSpeech: number;
}

export function useMicrophone() {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onChunkRef = useRef<((base64: string) => void) | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSilenceEndRef = useRef<(() => void) | null>(null);
  const vadStateRef = useRef<VadState>({
    noiseFloor: 0.02,
    speaking: false,
    silenceStart: 0,
    lastSpeechEnd: 0,
    samplesSinceSpeech: 0,
  });

  const ADAPT_RATE_UP = 0.01;
  const ADAPT_RATE_DOWN = 0.05;
  const THRESHOLD_MULTIPLIER = 1.8;
  const ABSOLUTE_MIN = 0.015;
  const HANGOVER_MS = 1500;

  const stopVad = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    const vs = vadStateRef.current;
    vs.silenceStart = 0;
    vs.speaking = false;
    vs.lastSpeechEnd = 0;
    vs.samplesSinceSpeech = 0;
  }, []);

  const start = useCallback(
    async (onChunk: (base64: string) => void, vadOptions?: VadOptions) => {
      setError(null);
      onChunkRef.current = onChunk;
      onSilenceEndRef.current = vadOptions?.onSilenceEnd ?? null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        sourceRef.current = source;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;
        source.connect(analyser);

        await audioCtx.audioWorklet.addModule(
          "/audio-processors/capture.worklet.js",
        );

        const worklet = new AudioWorkletNode(
          audioCtx,
          "audio-capture-processor",
        );
        workletRef.current = worklet;

        worklet.port.onmessage = (event) => {
          if (event.data.type === "audio") {
            const inputData = event.data.data as Float32Array;
            const len = inputData.length;
            if (len === 0) return;

            const bytes = new Uint8Array(len * 2);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < len; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]!));
              view.setInt16(i * 2, s * 0x7fff, true);
            }

            const blen = bytes.length;
            let binary = "";
            for (let i = 0; i < blen; i++) {
              binary += String.fromCharCode(bytes[i]!);
            }
            onChunkRef.current?.(btoa(binary));
          }
        };

        source.connect(worklet);

        if (vadOptions?.onSilenceEnd) {
          const timeoutMs = vadOptions.timeoutMs ?? 30000;
          stopVad();
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const vs = vadStateRef.current;

          vadTimerRef.current = setInterval(() => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const val = (dataArray[i]! - 128) / 128;
              sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            const dynamicThreshold = Math.max(
              vs.noiseFloor * THRESHOLD_MULTIPLIER,
              ABSOLUTE_MIN,
            );

            if (rms >= dynamicThreshold) {
              vs.speaking = true;
              vs.silenceStart = 0;
              vs.samplesSinceSpeech = 0;
              vs.noiseFloor = Math.max(
                ABSOLUTE_MIN * 0.5,
                vs.noiseFloor * (1 - ADAPT_RATE_DOWN),
              );
            } else {
              vs.samplesSinceSpeech++;
              if (vs.speaking) {
                vs.speaking = false;
                vs.lastSpeechEnd = Date.now();
              }

              const hangoverElapsed = Date.now() - vs.lastSpeechEnd;
              if (hangoverElapsed >= HANGOVER_MS) {
                if (vs.silenceStart === 0) {
                  vs.silenceStart = Date.now();
                }

                if (vs.samplesSinceSpeech > 20) {
                  vs.noiseFloor += (rms - vs.noiseFloor) * ADAPT_RATE_UP;
                  vs.noiseFloor = Math.max(ABSOLUTE_MIN, vs.noiseFloor);
                }

                if (Date.now() - vs.silenceStart >= timeoutMs) {
                  stopVad();
                  onSilenceEndRef.current?.();
                }
              }
            }
          }, 300);
        }

        setIsRecording(true);
      } catch (err) {
        const msg =
          err instanceof DOMException
            ? "Microphone access denied."
            : "Failed to access microphone";
        setError(msg);
        throw err;
      }
    },
    [stopVad],
  );

  const stop = useCallback(() => {
    stopVad();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workletRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setIsRecording(false);
  }, [stopVad]);

  return { start, stop, isRecording, error, analyserRef };
}
