import { useRef, useState, useCallback } from "react";

function resampleTo16kHz(
  float32: Float32Array,
  fromRate: number,
): Float32Array {
  if (fromRate === 16000) return float32;
  const ratio = 16000 / fromRate;
  const outLen = Math.round(float32.length * ratio);
  const output = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = float32[idx] ?? 0;
    const b = float32[Math.min(idx + 1, float32.length - 1)] ?? 0;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

export function useMicrophone() {
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sampleRateRef = useRef(48000);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onChunkRef = useRef<((base64: string) => void) | null>(null);

  const start = useCallback(async (onChunk: (base64: string) => void) => {
    setError(null);
    onChunkRef.current = onChunk;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      sampleRateRef.current = audioCtx.sampleRate;
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
      source.connect(analyser);

      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const resampled = resampleTo16kHz(input, sampleRateRef.current);
        const len = resampled.length;
        const pcm16 = new Int16Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.max(-1, Math.min(1, resampled[i]!));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(pcm16.buffer);
        const blen = bytes.length;
        let binary = "";
        for (let i = 0; i < blen; i++) {
          binary += String.fromCharCode(bytes[i]!);
        }
        onChunkRef.current?.(btoa(binary));
      };

      setIsRecording(true);
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? "Microphone access denied."
          : "Failed to access microphone";
      setError(msg);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    processorRef.current = null;
    sourceRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  return { start, stop, isRecording, error, analyserRef };
}
