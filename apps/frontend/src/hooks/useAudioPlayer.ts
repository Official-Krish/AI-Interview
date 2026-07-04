import { useRef, useState, useCallback } from "react";

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const len = int16.length;
  const float32 = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    float32[i] = int16[i]! / 32768;
  }
  return float32;
}

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);
  const queueSizeRef = useRef(0);

  const updateIsPlaying = useCallback(() => {
    const stillPlaying = queueSizeRef.current > 0;
    if (stillPlaying !== isPlayingRef.current) {
      isPlayingRef.current = stillPlaying;
      setIsPlaying(stillPlaying);
    }
  }, []);

  const ensureContext = useCallback(async () => {
    if (stoppedRef.current) return null;
    if (!audioContextRef.current) {
      const ctx = new AudioContext({ sampleRate: 24000 });
      try {
        await ctx.audioWorklet.addModule(
          "/audio-processors/playback.worklet.js",
        );
      } catch (e) {
        console.error("[audio] worklet load failed:", e);
        return null;
      }
      audioContextRef.current = ctx;

      analyserRef.current = ctx.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.8;

      gainRef.current = ctx.createGain();
      gainRef.current.gain.value = 1.0;

      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      workletRef.current = worklet;

      worklet.connect(analyserRef.current!);
      analyserRef.current!.connect(gainRef.current!);
      gainRef.current!.connect(ctx.destination);

      queueSizeRef.current = 0;
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playPcm = useCallback(
    async (base64Pcm: string) => {
      if (stoppedRef.current) return;
      const ctx = await ensureContext();
      if (!ctx) return;

      const float32 = base64ToFloat32(base64Pcm);
      workletRef.current?.port.postMessage(float32);

      queueSizeRef.current++;
      isPlayingRef.current = true;
      setIsPlaying(true);

      // Estimate when playback finishes to update isPlaying
      const durationMs = (float32.length / 24000) * 1000 + 50;
      setTimeout(() => {
        queueSizeRef.current = Math.max(0, queueSizeRef.current - 1);
        updateIsPlaying();
      }, durationMs);
    },
    [ensureContext, updateIsPlaying],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    workletRef.current?.port.postMessage("interrupt");
    workletRef.current?.disconnect();
    gainRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioContextRef.current?.close();
    audioContextRef.current = null;
    workletRef.current = null;
    gainRef.current = null;
    analyserRef.current = null;
    queueSizeRef.current = 0;
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  return { playPcm, stop, isPlaying, analyserRef };
}
