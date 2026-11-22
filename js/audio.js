// 梵鐘の音を Web Audio で合成する（録音素材なし）
// 梵鐘らしさ = 低い基音 + 非整数倍の倍音 + 近い周波数どうしの「うなり」+ 長い余韻

// [周波数比, 振幅, 減衰秒, うなり幅Hz]
const PARTIALS = [
  [0.5, 0.55, 14, 0.35],  // ハム音
  [1.0, 1.0, 10, 0.9],    // 基音
  [1.19, 0.55, 7, 1.3],   // 短三度
  [1.5, 0.32, 5.5, 1.1],
  [2.0, 0.42, 4.5, 1.6],
  [2.51, 0.25, 3.2, 2.0],
  [2.66, 0.2, 2.8, 1.4],
  [3.01, 0.16, 2.2, 2.4],
  [4.07, 0.1, 1.4, 3.0],
  [5.18, 0.07, 0.9, 3.5],
  [6.4, 0.04, 0.6, 4.0],
];

export class BellAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // 残響（合成インパルス応答）
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(5.5, 2.2);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.45;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.startWind();
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // 冬の夜風と篝火のはぜる音
  startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.crackleTimer = setInterval(() => this.crackle(), 180);
  }

  crackle() {
    if (!this.ctx || this.muted || Math.random() > 0.35) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.crackBuf || (this.crackBuf = this.noiseBuffer(0.05));
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1500 + Math.random() * 2500;
    const g = ctx.createGain();
    const v = 0.02 + Math.random() * 0.05;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
    src.connect(hp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.1);
  }

  // power: 0..1、opts: {pitch, gain, cutoff, pan, wet}
  bell(power, opts = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const { pitch = 1, gain = 1, cutoff = 6000, pan = 0, wet = 0.5, dry = 1 } = opts;
    const t = ctx.currentTime + 0.01;
    const base = 128 * pitch;
    const vol = (0.12 + 0.88 * Math.pow(power, 1.1)) * gain;
    const durMul = 0.55 + 0.6 * power;

    const out = ctx.createGain();
    out.gain.value = vol * 0.22;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff * (0.5 + 0.5 * power);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.connect(lp);
    let tail = lp;
    if (panner) { panner.pan.value = pan; lp.connect(panner); tail = panner; }
    const dryG = ctx.createGain();
    dryG.gain.value = dry;
    tail.connect(dryG).connect(this.master);
    const wetG = ctx.createGain();
    wetG.gain.value = wet;
    tail.connect(wetG).connect(this.reverb);

    let end = t;
    for (const [ratio, amp, decay, beat] of PARTIALS) {
      const f = base * ratio * (1 + (Math.random() - 0.5) * 0.002);
      // 強く撞くほど高い倍音が出る
      const bright = ratio > 2 ? 0.35 + 0.65 * power : 1;
      const d = decay * durMul;
      end = Math.max(end, t + d);
      for (const df of [-beat / 2, beat / 2]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f + df;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(amp * bright * 0.5, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
      }
    }
    // 撞木が当たる「ゴッ」
    const n = ctx.createBufferSource();
    n.buffer = this.thumpBuf || (this.thumpBuf = this.noiseBuffer(0.3));
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 500 + 700 * power;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.9 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    n.connect(nf).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.3);
    const thud = ctx.createOscillator();
    thud.frequency.setValueAtTime(90, t);
    thud.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(1.2 * vol, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    thud.connect(tg).connect(out);
    thud.start(t);
    thud.stop(t + 0.3);

    setTimeout(() => { try { out.disconnect(); } catch { /* 既に切断済み */ } }, (end - t + 1) * 1000);
  }

  // 遠くの寺の鐘：こもった音、パン、残響多め
  distantBell(power, pitch, pan, distanceGain = 0.22) {
    this.bell(power, { pitch, gain: distanceGain, cutoff: 900, pan, wet: 1.2, dry: 0.5 });
  }

  // 共鳴コンボ時の澄んだ響き
  chime(level) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const notes = [1, 1.5, 2, 2.5, 3];
    for (let i = 0; i < Math.min(notes.length, 1 + level); i++) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 512 * notes[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.06);
      g.gain.linearRampToValueAtTime(0.035, t + i * 0.06 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 2.5);
      o.connect(g).connect(this.reverb);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.06);
      o.stop(t + i * 0.06 + 2.6);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }
}
