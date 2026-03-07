/** One 880Hz beep ~180ms as WAV data URL for fallback when Web Audio is blocked */
function getBeepWavDataUrl(): string {
  const sampleRate = 44100;
  const freq = 880;
  const duration = 0.18;
  const numSamples = Math.round(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  const fadeSamples = Math.min(400, Math.floor(numSamples / 8));
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < fadeSamples) env = i / fadeSamples;
    else if (i >= numSamples - fadeSamples)
      env = (numSamples - i) / fadeSamples;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.22 * env * 32767;
    view.setInt16(44 + i * 2, sample, true);
  }
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...new Uint8Array(buffer)))}`;
}

const BEEP_WAV_URL = getBeepWavDataUrl();

let fallbackBeeps: HTMLAudioElement[] | null = null;

export function playSirenFallback(): void {
  try {
    if (!fallbackBeeps) {
      fallbackBeeps = [
        new Audio(BEEP_WAV_URL),
        new Audio(BEEP_WAV_URL),
        new Audio(BEEP_WAV_URL),
      ];
      fallbackBeeps.forEach((a) => {
        a.volume = 0.6;
        a.load();
      });
    }
    fallbackBeeps[0].currentTime = 0;
    fallbackBeeps[0].play().catch(() => {});
    setTimeout(() => {
      fallbackBeeps![1].currentTime = 0;
      fallbackBeeps![1].play().catch(() => {});
    }, 220);
    setTimeout(() => {
      fallbackBeeps![2].currentTime = 0;
      fallbackBeeps![2].play().catch(() => {});
    }, 440);
  } catch {
    // ignore
  }
}

export function createSirenPlayer(): {
  ctx: AudioContext | null;
  unlock: () => Promise<void>;
  playSiren: () => void;
  dispose: () => void;
} {
  const AudioCtx = (window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
    | typeof AudioContext
    | undefined;

  if (!AudioCtx) {
    return {
      ctx: null,
      unlock: async () => {},
      playSiren: playSirenFallback,
      dispose: () => {},
    };
  }

  const ctx = new AudioCtx();
  const freq = 880;
  const durSec = 0.18;
  const gainVal = 0.22;
  const attackSec = 0.008;
  const releaseSec = 0.02;

  const scheduleBeep = (startTime: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + attackSec);
    gain.gain.linearRampToValueAtTime(0, startTime + durSec - releaseSec);

    osc.start(startTime);
    osc.stop(startTime + durSec);
  };

  const playSirenWebAudio = () => {
    const t = ctx.currentTime;
    scheduleBeep(t);
    scheduleBeep(t + 0.22);
    scheduleBeep(t + 0.44);
  };

  const playSiren = () => {
    if (ctx.state === "running") {
      playSirenWebAudio();
    } else {
      ctx.resume().then(() => playSirenWebAudio()).catch(playSirenFallback);
    }
  };

  const unlockBeep = () => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1;
    osc.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0, t + 0.01);
    osc.start(t);
    osc.stop(t + 0.01);
  };

  return {
    ctx,
    unlock: async () => {
      if (ctx.state === "suspended") await ctx.resume();
      unlockBeep();
    },
    playSiren,
    dispose: () => ctx.close(),
  };
}
