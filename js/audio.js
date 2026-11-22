// 梵鐘の音を Web Audio で合成する（録音素材なし）
// 日本の梵鐘らしさ:
//   ・低い基音と、教会の鐘とは違う非整数倍の倍音（短三度を持たない）
//   ・近い周波数の対（縮退モード）がつくる「おーん、おーん」という深いうなり
//   ・木の撞木による鈍い打撃音と、一瞬だけの金属音
//   ・低い倍音ほど長く残る余韻（最大20秒以上）
import { LOW } from './quality.js';

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

// 全体の音量（スマホは鳴らない低音をカットする分、聞こえる帯域を大きくできる）
const MASTER = LOW ? 2.6 : 2.1;

// ---- 梵鐘の合成（ロード中の「録音」と、録音が使えないときの予備で共用） ----
// ctx: AudioContext か OfflineAudioContext、master / reverb: つなぎ先、t: 鳴らす時刻
const noiseCache = new WeakMap();
function noiseOf(ctx) {
  if (!noiseCache.has(ctx)) {
    const len = Math.floor(ctx.sampleRate * 0.3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return noiseCache.get(ctx);
}
function synthBell(ctx, master, reverb, t, power, opts = {}) {
  {
    const { pitch = 1, gain = 1, cutoff = 7000, pan = 0, wet = 0.35, dry = 1 } = opts;
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
    tail.connect(dryG).connect(master);
    const wetG = ctx.createGain();
    wetG.gain.value = wet;
    tail.connect(wetG).connect(reverb);

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
      for (const [pi, [df, w]] of pair.entries()) {
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
        // うなりの対を左右に少し振り分け、「おーん、おーん」を広がりのある響きに
        if (ctx.createStereoPanner) {
          const sp = ctx.createStereoPanner();
          sp.pan.value = (pi ? 0.35 : -0.35) * (ratio > 1.5 ? 1 : 0.5);
          o.connect(g).connect(sp).connect(out);
        } else {
          o.connect(g).connect(out);
        }
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
    n.buffer = noiseOf(ctx);
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

    return { out, end };
  }
}


// 録音しておく自分の鐘の強さ
const MAIN_POWERS = [0.35, 0.65, 1.0];
function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export class BellAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      // 意図して止めている（ポーズ・広告など）ときは再開しない
      if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // スマホは音の計算に余裕を持たせる（描画が重いときの音切れ・ビリつきを防ぐ）
    let ctx;
    try { ctx = new AC(LOW ? { latencyHint: 'playback' } : undefined); } catch { ctx = new AC(); }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = MASTER;
    // 全体を大きくしても割れないよう、最後に強めのコンプレッサー（リミッター代わり）
    // 穏やかに効かせる（速く強いコンプは低音を歪ませ、ビリつきの原因になる）
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.02;
    comp.release.value = 0.45;
    // スマホのスピーカーで鳴らない重低音はカット（震えて濁るのを防ぐ）
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = LOW ? 100 : 70; // 「ゴーン」の芯（約160Hz）は残す
    hp.Q.value = 0.6;
    // 最後にピークだけを抑えるリミッター（重なっても割れない）
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.12;
    const out = ctx.createGain();
    out.gain.value = 1.0;
    this.master.connect(hp).connect(comp).connect(lim).connect(out).connect(ctx.destination);

    // 残響：常に動く重い畳み込みはやめ、軽いエコー（遅延の帰還）にする（BGM・共鳴音・予備の合成用）
    // 鐘の音の残響は、ロード中の「録音」に含めてある
    this.reverb = ctx.createGain();
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.35;
    for (const [dt, fb] of [[0.137, 0.55], [0.211, 0.5], [0.293, 0.45]]) {
      const d = ctx.createDelay(1);
      d.delayTime.value = dt;
      const f = ctx.createGain();
      f.gain.value = fb;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      this.reverb.connect(d);
      d.connect(lp).connect(f).connect(d);
      lp.connect(wetOut);
    }
    wetOut.connect(this.master);

    this.startWind();
    this.startBgm();
  }

  // ---- 幻想的な BGM（陰旋法・その場で合成） ----
  // E♭ の陰旋法（E♭・E・A♭・B♭・B）。鐘の基音（約78Hz = E♭2）と同じ調で濁らない。
  startBgm() {
    const ctx = this.ctx;
    this.bgm = ctx.createGain();
    this.bgm.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.bgm.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 8); // 鐘の音が主役になるよう控えめに
    this.bgm.connect(this.master);
    // 残響への送りも BGM の音量つまみの後ろから取る
    this.bgmVerb = ctx.createGain();
    this.bgmVerb.gain.value = 1.4;
    this.bgm.connect(this.bgmVerb).connect(this.reverb);
    const root = 77.78;
    const steps = [0, 1, 5, 7, 8]; // 半音
    this.scale = (degree, octave) => {
      const n = steps.length;
      const o = Math.floor(degree / n) + octave;
      const st = steps[((degree % n) + n) % n];
      return root * Math.pow(2, o + st / 12);
    };
    // 低い持続音（E♭ と B♭）
    for (const [f, v] of [[root, 0.05], [root * 1.5, 0.03], [root * 2, 0.025]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = v;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.05;
      const lg = ctx.createGain();
      lg.gain.value = v * 0.6;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(this.bgm);
      o.start(); lfo.start();
    }
    const padLoop = () => {
      this.bgmPad();
      this.padTimer = setTimeout(padLoop, 7000 + Math.random() * 5000);
    };
    const sparkleLoop = () => {
      this.bgmSparkle();
      this.sparkleTimer = setTimeout(sparkleLoop, 1800 + Math.random() * 4200);
    };
    padLoop();
    this.sparkleTimer = setTimeout(sparkleLoop, 3000);
  }

  // ゆっくり膨らんで消える和音
  bgmPad() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const dur = 13;
    const start = Math.floor(Math.random() * 5);
    const notes = [start, start + 2, start + (Math.random() < 0.5 ? 4 : 3)];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1100, t + dur * 0.45);
    lp.frequency.linearRampToValueAtTime(450, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 4.5);
    g.gain.linearRampToValueAtTime(0.04, t + dur - 5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g);
    g.connect(this.bgm);
    for (const d of notes) {
      const f = this.scale(d, 2);
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  // 遠くの風鈴・琴の余韻のような高い音
  bgmSparkle() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const count = Math.random() < 0.3 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const t = ctx.currentTime + 0.05 + k * (0.18 + Math.random() * 0.25);
      const f = this.scale(Math.floor(Math.random() * 8), 4);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const g = ctx.createGain();
      const v = 0.012 + Math.random() * 0.014;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      let tail = g;
      if (pan) { pan.pan.value = (Math.random() - 0.5) * 1.4; g.connect(pan); tail = pan; }
      tail.connect(this.bgm);
      for (const [mul, amp] of [[1, 1], [2.76, 0.25], [5.4, 0.08]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mul;
        const og = ctx.createGain();
        og.gain.value = amp;
        o.connect(og).connect(g);
        o.start(t);
        o.stop(t + 3.6);
      }
    }
  }

  // 音の準備ができるまで待つ（再開直後のプツッという音や途切れを避けるため少し余裕を置く）
  async ready() {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') {
      // 広告のあとなど、操作の直後でないと再開できないことがあるので待ちすぎない（次の操作で再開される）
      const resumed = this.ctx.resume().catch(() => {});
      await Promise.race([resumed, new Promise((r) => setTimeout(r, 600))]);
    }
    await new Promise((r) => setTimeout(r, 200));
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
    g.gain.value = 0.007;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.004;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    lfo.start();
    this.crackleTimer = setInterval(() => this.crackle(), 180);
  }

  // 篝火のはぜる音：低めで柔らかい「パチッ」。立ち上がりにわずかな傾斜を付けてクリック音を防ぐ
  crackle() {
    if (!this.ctx || this.muted || Math.random() > 0.14) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = this.crackBuf || (this.crackBuf = this.noiseBuffer(0.12));
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700 + Math.random() * 1300;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const v = 0.004 + Math.random() * 0.008;
    const len = 0.04 + Math.random() * 0.06;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + len + 0.02);
  }

  // ---- ロード中に鐘の音を「録音」しておく ----
  // 鐘を撞くたびに数十個の発振器を20秒以上鳴らすと、スマホでは音の計算が追いつかず
  // ビリつきや音切れの原因になる。同じ合成をあらかじめ一度だけ行い、撞くときは再生するだけにする
  // （OfflineAudioContext はタップ前でも使える）
  async prepare(distantPitches = [], onProgress = () => {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return;
    const SR = 22050; // 鐘の音は 1.5kHz 程度までが中心なので十分
    const render = async (secs, power, opts) => {
      const off = new OAC(2, Math.floor(SR * secs), SR);
      const master = off.createGain();
      master.connect(off.destination);
      const reverb = off.createConvolver();
      reverb.buffer = makeImpulse(off, 5.0, 2.2);
      const rg = off.createGain();
      rg.gain.value = 0.5;
      reverb.connect(rg).connect(master);
      synthBell(off, master, reverb, 0.01, power, opts);
      const buf = await off.startRendering();
      // 終わりの1秒で静かに消す
      const fade = Math.floor(SR * 1);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < fade; i++) d[d.length - fade + i] *= 1 - i / fade;
      }
      return buf;
    };
    try {
      // 並行して録音する
      const jobs = MAIN_POWERS.length + distantPitches.length;
      let done = 0;
      const tick = (x) => { onProgress(++done / jobs); return x; };
      const [main, dist] = await Promise.all([
        Promise.all(MAIN_POWERS.map((p) => render(14, p, {}).then((buf) => tick({ power: p, buf })))),
        Promise.all(distantPitches.map((pitch) => render(11, 0.85, { pitch, cutoff: 2600, wet: 0.9, dry: 0.75 }).then(tick))),
      ]);
      const distant = new Map(distantPitches.map((pitch, i) => [pitch, dist[i]]));
      this.samples = { main, distant };
    } catch (e) {
      console.warn('bell pre-render failed', e);
    }
  }

  playSample(buf, gainValue, pan = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.008; // 毎回わずかに音程を揺らす
    const g = ctx.createGain();
    g.gain.value = gainValue;
    let tail = src.connect(g);
    if (pan && ctx.createStereoPanner) {
      const sp = ctx.createStereoPanner();
      sp.pan.value = pan;
      tail = tail.connect(sp);
    }
    tail.connect(this.master);
    src.start(t);
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch { /* 既に切断済み */ } };
  }

  // 自分の鐘（power: 0..1）
  bell(power) {
    if (!this.ctx || this.muted) return;
    if (this.samples) {
      // いちばん近い強さの録音を選び、音量で差を埋める
      let best = this.samples.main[0];
      for (const m of this.samples.main) if (Math.abs(m.power - power) < Math.abs(best.power - power)) best = m;
      const vol = (p) => 0.15 + 0.85 * Math.pow(p, 1.1);
      this.playSample(best.buf, vol(power) / vol(best.power));
      return;
    }
    const r = synthBell(this.ctx, this.master, this.reverb, this.ctx.currentTime + 0.01, power, {});
    setTimeout(() => { try { r.out.disconnect(); } catch { /* 既に切断済み */ } }, (r.end - this.ctx.currentTime + 1) * 1000);
  }

  // 遠くの寺の鐘：高音が少しこもり、残響多め
  distantBell(power, pitch, pan, distanceGain = 0.55) {
    if (!this.ctx || this.muted) return;
    const buf = this.samples && this.samples.distant.get(pitch);
    if (buf) {
      this.playSample(buf, distanceGain * 0.8 * (0.15 + 0.85 * Math.pow(power, 1.1)) / (0.15 + 0.85 * Math.pow(0.85, 1.1)), pan);
      return;
    }
    const r = synthBell(this.ctx, this.master, this.reverb, this.ctx.currentTime + 0.01, power, { pitch, gain: distanceGain * 0.8, cutoff: 2600, pan, wet: 0.9, dry: 0.75 });
    setTimeout(() => { try { r.out.disconnect(); } catch { /* 既に切断済み */ } }, (r.end - this.ctx.currentTime + 1) * 1000);
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

  // ポーズ・広告表示中・別アプリに切り替えたときに音を止める
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : MASTER;
  }
}
