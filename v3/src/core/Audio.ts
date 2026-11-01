// Audio 100 % synthétisé en Web Audio : aucun fichier, aucune licence à gérer.
// Chaque son transmet une information de gameplay (préparation, danger, réussite).

import { Save } from './Save';

type Wave = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private music: MusicPlayer | null = null;
  private lastPlay: Record<string, number> = {};

  /** À appeler depuis un geste utilisateur (clic, touche). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.noiseBuf = this.makeNoise();
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  applySettings(): void {
    if (!this.ctx) return;
    const s = Save.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx * 0.9, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, t, 0.05);
  }

  toggleMute(): boolean {
    Save.updateSettings({ muted: !Save.settings.muted });
    this.applySettings();
    return Save.settings.muted;
  }

  playMusic(theme: 'greenhouse' | 'menu'): void {
    if (!this.ctx) return;
    if (this.music?.theme === theme) return;
    this.music?.stop();
    this.music = new MusicPlayer(this.ctx, this.musicBus, theme);
    this.music.start();
  }

  stopMusic(): void {
    this.music?.stop();
    this.music = null;
  }

  /** Atténue la musique (pause, mort) sans la couper. */
  duckMusic(amount: number): void {
    this.music?.duck(amount);
  }

  // ---------- Effets sonores ----------

  sfx(name: SfxName, opts: { pan?: number; intensity?: number } = {}): void {
    if (!this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    // anti-spam : un même son ne se répète pas à moins de 40 ms
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.04) return;
    this.lastPlay[name] = now;
    const pan = Math.max(-1, Math.min(1, opts.pan ?? 0));
    const k = opts.intensity ?? 1;
    const out = this.ctx.createStereoPanner();
    out.pan.value = pan;
    out.connect(this.sfxBus);
    const t = now + 0.005;

    switch (name) {
      case 'jump':
        this.tone(out, t, 'triangle', 330, 620, 0.13, 0.22);
        this.tone(out, t, 'sine', 660, 1100, 0.08, 0.06);
        break;
      case 'land':
        this.noise(out, t, 0.09, 600 + 600 * k, 0.18 * k, 'lowpass');
        this.tone(out, t, 'sine', 140, 70, 0.08, 0.2 * k);
        break;
      case 'step':
        this.noise(out, t, 0.03, 2200, 0.035, 'bandpass');
        break;
      case 'tileWarn':
        // craquement + petite vibration
        for (let i = 0; i < 4; i++) this.noise(out, t + i * 0.07, 0.025, 1800 - i * 200, 0.14, 'bandpass');
        this.tone(out, t, 'square', 92, 84, 0.3, 0.05, 18);
        break;
      case 'tileSink':
        this.tone(out, t, 'triangle', 300, 120, 0.45, 0.16);
        this.noise(out, t, 0.4, 500, 0.08, 'lowpass');
        break;
      case 'tileRise':
        this.tone(out, t, 'triangle', 150, 260, 0.35, 0.08);
        break;
      case 'snapWake':
        this.noise(out, t, 0.5, 3000, 0.07, 'highpass', 0.5);
        this.tone(out, t, 'sawtooth', 120, 180, 0.5, 0.04);
        break;
      case 'chomp':
        this.noise(out, t, 0.08, 1200, 0.35, 'lowpass');
        this.tone(out, t, 'square', 180, 60, 0.12, 0.16);
        break;
      case 'deathPrick':
        this.tone(out, t, 'square', 1200, 1400, 0.05, 0.1);
        this.tone(out, t + 0.06, 'triangle', 900, 180, 0.45, 0.22, 9);
        break;
      case 'deathChomp':
        this.noise(out, t, 0.06, 1000, 0.3, 'lowpass');
        this.noise(out, t + 0.16, 0.06, 900, 0.25, 'lowpass');
        this.noise(out, t + 0.32, 0.06, 800, 0.2, 'lowpass');
        this.tone(out, t + 0.5, 'sine', 500, 900, 0.12, 0.12); // "ptou"
        break;
      case 'respawn':
        this.tone(out, t, 'sine', 420, 840, 0.14, 0.14);
        this.tone(out, t + 0.05, 'triangle', 630, 1260, 0.12, 0.06);
        break;
      case 'checkpoint':
        [784, 988, 1175, 1568].forEach((f, i) => this.bell(out, t + i * 0.07, f, 0.1));
        break;
      case 'doorScoot':
        this.tone(out, t, 'square', 900, 1300, 0.08, 0.06, 30);
        this.tone(out, t + 0.1, 'square', 1000, 1500, 0.08, 0.06, 30);
        this.noise(out, t, 0.25, 900, 0.08, 'bandpass');
        break;
      case 'doorOpen':
        this.tone(out, t, 'triangle', 220, 330, 0.4, 0.1);
        [523, 659, 784].forEach((f, i) => this.bell(out, t + 0.1 + i * 0.06, f, 0.07));
        break;
      case 'victory':
        [523, 659, 784, 1047, 988, 1047].forEach((f, i) => this.bell(out, t + i * 0.11, f, 0.12));
        this.tone(out, t + 0.66, 'triangle', 262, 262, 0.6, 0.1);
        break;
      case 'uiHover':
        this.tone(out, t, 'sine', 880, 990, 0.05, 0.04);
        break;
      case 'uiClick':
        this.tone(out, t, 'triangle', 660, 520, 0.08, 0.12);
        break;
      case 'bubble':
        this.tone(out, t, 'sine', 600, 1200, 0.1, 0.08);
        break;
      // --- écran d'accueil (volontairement discrets)
      case 'whoosh':
        this.noise(out, t, 0.32, 900 + 900 * k, 0.07, 'bandpass', 0.12);
        break;
      case 'logoThud':
        this.tone(out, t, 'sine', 120, 52, 0.22, 0.2);
        this.noise(out, t, 0.12, 420, 0.1, 'lowpass');
        break;
      case 'sneezeIn':
        this.tone(out, t, 'triangle', 380, 760, 0.7, 0.05, 6);
        this.noise(out, t, 0.7, 2600, 0.025, 'bandpass', 0.5);
        break;
      case 'sneeze':
        this.noise(out, t, 0.28, 1800, 0.2, 'bandpass');
        this.tone(out, t, 'square', 520, 220, 0.16, 0.05);
        this.noise(out, t + 0.05, 0.45, 600, 0.08, 'lowpass', 0.02);
        break;
      case 'giggle':
        [880, 990, 880, 1046].forEach((f, i) => this.tone(out, t + i * 0.07, 'sine', f, f * 1.08, 0.06, 0.05));
        break;
      case 'boing':
        this.tone(out, t, 'sine', 260, 520, 0.22, 0.07, 14);
        break;
    }
  }

  private tone(out: AudioNode, t: number, type: Wave, f0: number, f1: number, dur: number, vol: number, vibrato = 0): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vibrato > 0) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = vibrato;
      lg.gain.value = f0 * 0.08;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private bell(out: AudioNode, t: number, f: number, vol: number): void {
    this.tone(out, t, 'sine', f, f, 0.6, vol);
    this.tone(out, t, 'sine', f * 2.01, f * 2.01, 0.25, vol * 0.3);
  }

  private noise(out: AudioNode, t: number, dur: number, freq: number, vol: number, type: BiquadFilterType, attack = 0.005): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
  }

  private makeNoise(): AudioBuffer {
    const c = this.ctx!;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
}

export type SfxName =
  | 'jump' | 'land' | 'step' | 'tileWarn' | 'tileSink' | 'tileRise'
  | 'snapWake' | 'chomp' | 'deathPrick' | 'deathChomp' | 'respawn'
  | 'checkpoint' | 'doorScoot' | 'doorOpen' | 'victory' | 'uiHover' | 'uiClick' | 'bubble'
  | 'whoosh' | 'logoThud' | 'sneezeIn' | 'sneeze' | 'giggle' | 'boing';

// ---------- Musique générative douce ----------
// Serre : pentatonique de Fa, marimba + nappe + basse pizzicato, ~88 BPM.

class MusicPlayer {
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bus: GainNode;
  private rngState = 7;

  constructor(private ctx: AudioContext, out: AudioNode, readonly theme: 'greenhouse' | 'menu') {
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(out);
  }

  start(): void {
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(1, t, 0.8);
    this.nextTime = t + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const t = this.ctx.currentTime;
    this.bus.gain.setTargetAtTime(0, t, 0.25);
    const bus = this.bus;
    window.setTimeout(() => bus.disconnect(), 1500);
  }

  duck(amount: number): void {
    this.bus.gain.setTargetAtTime(1 - amount, this.ctx.currentTime, 0.15);
  }

  private rand(): number {
    // déterministe : la musique reste identique d'une partie à l'autre
    this.rngState = (this.rngState * 16807) % 2147483647;
    return this.rngState / 2147483647;
  }

  private schedule(): void {
    const bpm = this.theme === 'menu' ? 80 : 88;
    const stepDur = 60 / bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private playStep(step: number, t: number, sd: number): void {
    // Fa maj7 / Ré m7 / Si♭ maj7 / Do sus
    const chords = [
      [53, 57, 60, 64],
      [50, 53, 57, 60],
      [46, 50, 53, 57],
      [48, 53, 55, 60]
    ];
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = chords[bar % 4];
    const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

    if (s === 0) {
      // nappe
      chord.forEach((n) => this.pad(t, midi(n), sd * 16));
    }
    if (s === 0 || s === 8 || (s === 14 && bar % 2 === 1)) {
      this.pluck(t, midi(chord[0] - 12), 0.11, 0.5);
    }
    // marimba : motif semi-génératif sur la pentatonique
    const penta = [65, 67, 69, 72, 74, 77, 79, 81];
    const pattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0];
    if (pattern[s] && (bar % 8 !== 7 || s < 8)) {
      const n = penta[Math.floor(this.rand() * penta.length)];
      this.marimba(t, midi(n), 0.055);
    }
    if (s === 6 && bar % 4 === 2) this.marimba(t, midi(84), 0.03);
  }

  private marimba(t: number, f: number, vol: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o2.type = 'sine';
    o.frequency.value = f;
    o2.frequency.value = f * 4;
    const g2 = c.createGain();
    g2.gain.value = 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.bus);
    o.start(t);
    o2.start(t);
    o.stop(t + 0.75);
    o2.stop(t + 0.75);
  }

  private pluck(t: number, f: number, vol: number, dur: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(t: number, f: number, dur: number): void {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (this.rand() - 0.5) * 12;
    const flt = c.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 900;
    flt.Q.value = 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.012, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    o.connect(flt).connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + dur * 1.1);
  }
}

export const Audio = new AudioEngine();
