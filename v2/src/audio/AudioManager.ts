// Sons et musiques synthétisés (Web Audio) : aucun fichier, aucune licence à gérer.
import { SaveManager } from '../save/SaveManager';

type Sfx = 'jump' | 'land' | 'coin' | 'hurt' | 'die' | 'click' | 'move' | 'trap' | 'crack' | 'spring' | 'checkpoint' | 'win' | 'fake' | 'heart' | 'stomp' | 'whoosh' | 'laugh' | 'thunder' | 'creak' | 'snap' | 'bell' | 'rumble';
type Track = 'menu' | 'prairie' | 'results' | null;

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musBus: GainNode | null = null;
  private track: Track = null;
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;

  // le navigateur n'autorise le son qu'après une action du joueur
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.musBus = this.ctx.createGain(); this.musBus.connect(this.master);
      this.applyVolumes();
      if (this.track) this.startLoop();
    } catch { this.ctx = null; }
  }
  applyVolumes(): void {
    const s = SaveManager.data.settings;
    if (!this.ctx || !this.master || !this.sfxBus || !this.musBus) return;
    this.master.gain.value = s.master; this.sfxBus.gain.value = s.sfx; this.musBus.gain.value = s.music * 0.35;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, bus = this.sfxBus): void {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, hp = 800, delay = 0): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime + delay, n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxBus); src.start(t);
  }

  play(s: Sfx): void {
    switch (s) {
      case 'jump': this.tone(330, 0.14, 'square', 0.09, 380); break;
      case 'land': this.noise(0.07, 0.12, 1800); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.08); this.tone(1319, 0.16, 'square', 0.08, 0, 0.07); break;
      case 'hurt': this.tone(420, 0.25, 'sawtooth', 0.12, -260); this.noise(0.12, 0.1, 600); break;
      case 'die': this.tone(520, 0.45, 'triangle', 0.14, -440); this.tone(260, 0.5, 'square', 0.06, -180, 0.08); break;
      case 'click': this.tone(660, 0.06, 'triangle', 0.08); break;
      case 'move': this.tone(520, 0.04, 'sine', 0.06); break;
      case 'trap': this.noise(0.18, 0.14, 300); this.tone(140, 0.2, 'square', 0.08, -60); break;
      case 'crack': this.noise(0.09, 0.12, 2500); this.noise(0.09, 0.1, 1800, 0.08); break;
      case 'spring': this.tone(220, 0.25, 'triangle', 0.14, 660); break;
      case 'checkpoint': [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, 0, i * 0.08)); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.26, 'square', 0.08, 0, i * 0.1)); break;
      case 'fake': [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.18, 'square', 0.08, 0, i * 0.12)); break;
      case 'heart': this.tone(784, 0.12, 'sine', 0.1); this.tone(1175, 0.2, 'sine', 0.1, 0, 0.08); break;
      case 'stomp': this.tone(180, 0.12, 'square', 0.12, -90); break;
      case 'whoosh': this.noise(0.3, 0.09, 1200); break;
      case 'thunder': this.noise(0.9, 0.22, 90); this.tone(60, 0.8, 'sawtooth', 0.05, -20); break;
      case 'creak': this.tone(190, 0.22, 'sawtooth', 0.035, 70); this.tone(240, 0.16, 'sawtooth', 0.025, -60, 0.12); break;
      case 'snap': this.tone(900, 0.05, 'square', 0.09, -500); this.noise(0.06, 0.1, 2000); break;
      case 'bell': [1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.08, 0, i * 0.07)); break;
      case 'rumble': this.noise(1.1, 0.2, 60); this.tone(48, 1.0, 'triangle', 0.12, 10); break;
      case 'laugh': [0, 0.11, 0.22].forEach((d) => this.tone(700, 0.08, 'square', 0.06, -120, d)); break;
    }
  }

  // ---- musique : petite boucle générée, 1 mesure = 8 croches ----
  music(t: Track): void {
    if (this.track === t) return;
    this.track = t; this.step = 0;
    if (this.timer != null) { window.clearInterval(this.timer); this.timer = null; }
    if (t && this.ctx) this.startLoop();
  }
  private startLoop(): void {
    if (!this.ctx || this.timer != null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }
  private schedule(): void {
    if (!this.ctx || !this.track) return;
    const bpm = this.track === 'menu' ? 112 : this.track === 'results' ? 100 : 132, e = 60 / bpm / 2;
    const prog = this.track === 'prairie' ? [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]] : [[262, 330, 392], [196, 247, 294], [220, 262, 330], [175, 220, 262]];
    const mel = this.track === 'prairie' ? [0, 2, 1, 2, 0, 2, 1, 4] : [0, -1, 1, -1, 2, -1, 1, 0];
    while (this.nextT < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % 4, k = this.step % 8, ch = prog[bar], delay = this.nextT - this.ctx.currentTime;
      if (k === 0 || k === 4) this.tone(ch[0] / 2, e * 3, 'triangle', 0.22, 0, delay, this.musBus);
      if (k % 2 === 1) this.tone(ch[1], e * 0.8, 'sine', 0.06, 0, delay, this.musBus);
      const m = mel[k];
      if (m >= 0) this.tone(ch[m % 3] * (m > 2 ? 2 : 2), e * 0.9, 'square', 0.035, 0, delay, this.musBus);
      if (this.track !== 'results' && k % 2 === 0) this.tone(90, 0.05, 'sine', 0.12, -40, delay, this.musBus);
      this.nextT += e; this.step++;
    }
  }
}

export const AudioManager = new Audio();
