import { useRef, useState, useCallback } from "react";

function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isPlayingRef = useRef(false);
  const stoppedRef = useRef(false);

  const updateIsPlaying = useCallback(() => {
    const stillPlaying = activeSourcesRef.current.size > 0;
    if (stillPlaying !== isPlayingRef.current) {
      isPlayingRef.current = stillPlaying;
      setIsPlaying(stillPlaying);
    }
  }, []);

  const ensureContext = useCallback(() => {
    if (stoppedRef.current) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.8;
      gainRef.current = audioContextRef.current.createGain();
      gainRef.current.gain.value = 1.0;
      analyserRef.current.connect(gainRef.current);
      gainRef.current.connect(audioContextRef.current.destination);
      nextPlayTimeRef.current = 0;
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playPcm = useCallback(
    (base64Pcm: string) => {
      if (stoppedRef.current) return;
      const ctx = ensureContext();
      if (!ctx) return;

      const int16 = base64ToInt16(base64Pcm);
      const len = int16.length;
      const float32 = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const s = int16[i]!;
        float32[i] = s / (s < 0 ? 0x8000 : 0x7fff);
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;

      activeSourcesRef.current.add(source);
      isPlayingRef.current = true;
      setIsPlaying(true);

      source.onended = () => {
        activeSourcesRef.current.delete(source);
        updateIsPlaying();
      };
    },
    [ensureContext, updateIsPlaying],
  );

  const interrupt = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop(0);
        source.disconnect();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;

    const ctx = audioContextRef.current;
    if (gainRef.current && ctx) {
      try {
        gainRef.current.gain.setValueAtTime(0, ctx.currentTime);
      } catch {
        // context may be closing
      }
    }

    for (const source of activeSourcesRef.current) {
      try {
        source.stop(0);
        source.disconnect();
      } catch {
        // already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;

    try {
      analyserRef.current?.disconnect();
      gainRef.current?.disconnect();
      void ctx?.close();
    } catch {
      // ignore close errors
    }

    audioContextRef.current = null;
    analyserRef.current = null;
    gainRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
  }, []);

  const prewarm = useCallback(() => {
    return ensureContext();
  }, [ensureContext]);

  return { playPcm, stop, interrupt, prewarm, isPlaying, analyserRef };
}
