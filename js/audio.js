// 梵鐘の音を Web Audio で合成する（録音素材なし）
// 日本の梵鐘らしさ:
//   ・低い基音と、教会の鐘とは違う非整数倍の倍音（短三度を持たない）
//   ・近い周波数の対（縮退モード）がつくる「おーん、おーん」という深いうなり
//   ・木の撞木による鈍い打撃音と、一瞬だけの金属音
//   ・低い倍音ほど長く残る余韻（最大20秒以上）

// [周波数比, 振幅, 減衰秒, うなり幅Hz, うなりの深さ0..1]
const PARTIALS = [
  [1.0, 0.65, 26, 0.45, 0.5],   // 基音（腹に響くうなり）
  [2.06, 1.0, 20, 1.6, 0.85],   // 「ゴーン」の芯
  [2.81, 0.85, 14, 2.3, 0.8],
  [3.6, 0.55, 9, 1.2, 0.6],
  [4.43, 0.42, 6.5, 2.8, 0.6],
  [5.36, 0.3, 4.5, 3.4, 0.5],
  [6.37, 0.2, 3.2, 2.2, 0.5],
  [7.62, 0.12, 2.2, 4.0, 0.4],
];
// 打った瞬間だけ鳴る高い金属音（すぐ消える）
const CLANG = [[9.1, 0.12, 0.5], [11.7, 0.08, 0.35], [14.3, 0.05, 0.25], [17.9, 0.03, 0.18]];

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
    this.reverbGain.gain.value = 0.5;
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
    g.gain.value = 0.03;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
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

  // power: 0..1、opts: {pitch, gain, cutoff, pan, wet, dry}
  bell(power, opts = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const { pitch = 1, gain = 1, cutoff = 7000, pan = 0, wet = 0.35, dry = 1 } = opts;
    const t = ctx.currentTime + 0.01;
    const base = 78 * pitch;
    const vol = (0.15 + 0.85 * Math.pow(power, 1.1)) * gain;
    const durMul = 0.5 + 0.55 * power;

    const out = ctx.createGain();
    out.gain.value = vol * 0.16;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff * (0.55 + 0.45 * power);
    lp.Q.value = 0.5;
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
    for (const [ratio, amp, decay, beat, depth] of PARTIALS) {
      const f = base * ratio * (1 + (Math.random() - 0.5) * 0.003);
      // 強く撞くほど高い倍音まで鳴る
      const bright = ratio > 3 ? 0.3 + 0.7 * power : 1;
      const d = decay * durMul;
      end = Math.max(end, t + d);
      // 低い倍音はやや遅れて膨らむ（「ゴッ…ォーーン」）
      const attack = ratio < 2.5 ? 0.06 : 0.012;
      const pair = [[-beat / 2, 1], [beat / 2, depth]];
      for (const [df, w] of pair) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f + df;
        const g = ctx.createGain();
        const peak = amp * bright * w * 0.6;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + attack);
        // 最初の1秒で少し落ち、その後ゆっくり長く消える
        g.gain.exponentialRampToValueAtTime(peak * 0.55, t + attack + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + d + 0.05);
      }
    }
    // 金属の「ガン」
    for (const [ratio, amp, decay] of CLANG) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * ratio * (1 + (Math.random() - 0.5) * 0.01);
      const g = ctx.createGain();
      const peak = amp * (0.2 + 0.8 * power);
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay * (0.6 + 0.4 * power));
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
    // 木の撞木が当たる鈍い「ゴッ」
    const n = ctx.createBufferSource();
    n.buffer = this.thumpBuf || (this.thumpBuf = this.noiseBuffer(0.3));
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 220 + 180 * power;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1.4 * (0.3 + 0.7 * power), t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(nf).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.3);
    const thud = ctx.createOscillator();
    thud.frequency.setValueAtTime(base * 1.3, t);
    thud.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.12);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.9 * (0.3 + 0.7 * power), t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    thud.connect(tg).connect(out);
    thud.start(t);
    thud.stop(t + 0.25);

    setTimeout(() => { try { out.disconnect(); } catch { /* 既に切断済み */ } }, (end - t + 1) * 1000);
  }

  // 遠くの寺の鐘：高音が少しこもり、残響多め。小さなスピーカーでも聞こえる音量にする
  distantBell(power, pitch, pan, distanceGain = 0.55) {
    this.bell(power, { pitch, gain: distanceGain, cutoff: 2600, pan, wet: 0.9, dry: 0.75 });
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
