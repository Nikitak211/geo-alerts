export class CentcomSiren {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  constructor() {
    const AudioCtx = (window.AudioContext ||
      (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();

    // Low-pass filter to remove digital "crispness" and simulate distance
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 2200;

    this.master.gain.value = 0.3;
    this.master.connect(this.filter);
    this.filter.connect(this.ctx.destination);
  }

  private createWail(
    baseHz: number,
    peakHz: number,
    duration: number,
    startTime: number,
  ) {
    if (!this.ctx || !this.master) return;

    // Dual oscillators for that "Mechanical Rotor" dissonance
    // Interval of 1.25 (Major Third) or 1.33 (Perfect Fourth)
    const oscs = [1, 1.335].map((multiplier) => {
      const osc = this.ctx!.createOscillator();
      osc.type = "sawtooth";
      return { osc, mult: multiplier };
    });

    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    // Tremolo (The spinning rotor effect)
    lfo.frequency.value = 7;
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    oscs.forEach(({ osc, mult }) => {
      osc.connect(gain);
      // Frequency Sweep logic
      osc.frequency.setValueAtTime(baseHz * mult, startTime);
      // Exponential ramp feels more like a heavy motor winding up
      osc.frequency.exponentialRampToValueAtTime(
        peakHz * mult,
        startTime + duration * 0.45,
      );
      osc.frequency.exponentialRampToValueAtTime(
        baseHz * mult,
        startTime + duration,
      );

      osc.start(startTime);
      osc.stop(startTime + duration);
    });

    gain.connect(this.master);

    // Smooth volume envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    lfo.start(startTime);
    lfo.stop(startTime + duration);
  }

  public playAttackSignal() {
    if (this.ctx?.state === "suspended") this.ctx.resume();

    const now = this.ctx!.currentTime;
    const cycleLen = 4.0; // Standard 4-second wail cycle

    // Play 3 cycles of the "Attack" signal
    for (let i = 0; i < 3; i++) {
      this.createWail(400, 850, cycleLen, now + i * cycleLen);
    }
  }

  public stop() {
    this.ctx?.close();
  }
}

// Usage:
// const siren = new CentcomSiren();
// siren.playAttackSignal();
