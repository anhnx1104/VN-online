// Âm thanh môi trường tạo bằng WebAudio (bản v1 chưa có bản thu thực địa):
// tiếng sông, tiếng phố xa, côn trùng ban đêm, mưa, tiếng lửa phụt.
export class Ambience {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private river!: GainNode;
  private city!: GainNode;
  private crickets!: GainNode;
  private rain!: GainNode;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem('vno.mute') === '1'; } catch { /* */ }
  }

  private noiseBuffer(ctx: AudioContext, brown: boolean) {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  private loop(buf: AudioBuffer, filter: BiquadFilterType, freq: number, q = 0.7) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start(0, Math.random() * 3);
    return g;
  }

  /** Phải gọi sau một thao tác của người dùng (chính sách tự phát âm thanh của trình duyệt) */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    const brown = this.noiseBuffer(ctx, true), white = this.noiseBuffer(ctx, false);
    this.river = this.loop(brown, 'lowpass', 520);
    this.city = this.loop(brown, 'lowpass', 140);
    this.rain = this.loop(white, 'highpass', 1800);
    // côn trùng: dao động tần số cao điều biến
    const osc = ctx.createOscillator(); osc.frequency.value = 4300; osc.type = 'sine';
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23; lfo.type = 'square';
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(am.gain);
    this.crickets = ctx.createGain(); this.crickets.gain.value = 0;
    osc.connect(am).connect(this.crickets).connect(this.master);
    osc.start(); lfo.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem('vno.mute', m ? '1' : '0'); } catch { /* */ }
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.2);
  }

  update(nearRiver: number, night: number, rain: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.river.gain.setTargetAtTime(0.1 + nearRiver * 0.35, t, 0.5);
    this.city.gain.setTargetAtTime(0.35 - night * 0.12, t, 1);
    this.crickets.gain.setTargetAtTime(night * (1 - rain) * 0.012, t, 2);
    this.rain.gain.setTargetAtTime(rain * 0.25, t, 1);
  }

  /** Tiếng máy xe máy: speed 0..1 (0 = tắt máy) */
  engine(level: number | null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (level === null) {
      this.engineGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      return;
    }
    if (!this.engineOsc) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420;
      const g = ctx.createGain(); g.gain.value = 0;
      osc.connect(f).connect(g).connect(this.master);
      osc.start();
      this.engineOsc = osc; this.engineGain = g;
    }
    this.engineOsc.frequency.setTargetAtTime(48 + level * 95, ctx.currentTime, 0.15);
    this.engineGain!.gain.setTargetAtTime(0.035 + level * 0.05, ctx.currentTime, 0.15);
  }

  /** Còi xe máy: hai nốt "bíp bíp", âm lượng theo khoảng cách */
  horn(distance = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const vol = Math.max(0, Math.min(0.22, 6 / Math.max(6, distance) * 0.22));
    if (vol < 0.01) return;
    for (const [at, f] of [[0, 520], [0.18, 520]] as [number, number][]) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f * 1.26;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setValueAtTime(vol, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.15);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2200;
      o.connect(flt); o2.connect(flt); flt.connect(g).connect(this.master);
      o.start(t); o2.start(t); o.stop(t + 0.16); o2.stop(t + 0.16);
    }
  }

  /** Tiếng lửa phụt / nước phun, âm lượng theo khoảng cách */
  burst(kind: 'fire' | 'water', distance: number) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const vol = Math.max(0.05, Math.min(1, 40 / Math.max(10, distance)));
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx, kind === 'fire');
    const f = ctx.createBiquadFilter();
    f.type = kind === 'fire' ? 'lowpass' : 'bandpass';
    f.frequency.value = kind === 'fire' ? 700 : 2400;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * (kind === 'fire' ? 1.2 : 0.4), t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'fire' ? 2.6 : 4));
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 4.2);
  }
}
