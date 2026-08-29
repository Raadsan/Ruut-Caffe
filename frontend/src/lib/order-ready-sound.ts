let audioCtx: AudioContext | null = null;

export function playOrderReadyChime() {
  if (typeof window === "undefined") return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const ctx = audioCtx;
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    playTone(880, now, 0.18);
    playTone(1174, now + 0.2, 0.22);
  } catch {
    /* ignore — autoplay may be blocked until user gesture */
  }
}
