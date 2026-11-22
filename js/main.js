// 除夜の鐘 — ゲーム進行
import { World, TEMPLE_DEFS } from './world.js';
import { BellAudio } from './audio.js';
import { BONNOU, BONNOU_EN } from './bonnou.js';
import { t as tr, getLang, setLang, applyStatic } from './i18n.js';

const $ = (id) => document.getElementById(id);

const PULL_TIME = 1.4;    // 最大まで引くのにかかる秒数
const COMBO_WIN = 0.35;   // 遠くの鐘と「同時」とみなす時間差（秒）
const YOIN_TAU = 2.4;     // 余韻の減衰時定数（秒）

const audio = new BellAudio();
let world;

const game = {
  state: 'title', // title | play | countdown | final | end
  total: 108,
  count: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  stats: { great: 0, good: 0, ok: 0, bad: 0, reso: 0 },
  words: [],
  lastStrikeT: -99,
  lastPower: 0,
  pending: [],     // 共鳴判定待ちの打撃
  countdownT: 0,
};

const input = { holding: false, pull: 0 };
let time = 0;

// ---- 遠くの寺：和尚の動き ----
// 和尚は本番の前に撞木を小さく引いて戻す「ためし引き」を0〜2回入れ、
// 引く速さも毎回変わる。プレイヤーは和尚の引き方を見て、鳴る瞬間を読む。
const temples = TEMPLE_DEFS.map((d, i) => ({
  def: d,
  idx: i,
  active: true, // 起動時は 3D 側も全寺が有効。最初の updateActiveTemples で整える
  plan: null,
  lastRing: -99,
}));

function planTemple(t, start) {
  const segs = [];
  let at = start;
  const feints = Math.floor(Math.random() * 3);
  for (let k = 0; k < feints; k++) {
    const dur = 0.9 + Math.random() * 0.6;
    segs.push({ type: 'feint', start: at, dur, amp: 0.22 + Math.random() * 0.25 });
    at += dur + 0.15 + Math.random() * 0.5;
  }
  const dur = 1.0 + Math.random() * 0.9;
  segs.push({ type: 'pull', start: at, dur, amp: 0.75 + Math.random() * 0.2 });
  t.plan = { segs, released: false };
}

function activeTempleCount() {
  if (game.state === 'title' || game.state === 'end') return 1;
  const every = 30;
  return Math.min(TEMPLE_DEFS.length, 1 + Math.floor(game.count / every));
}

function updateActiveTemples(announce) {
  const n = activeTempleCount();
  for (const t of temples) {
    const on = t.def.join < n;
    if (on !== t.active) {
      t.active = on;
      world.setTempleActive(t.idx, on);
      if (on && announce) popup(tr('joined', templeName(t.idx)), tr('joinedSub'), 'reso');
    }
    if (!on) t.plan = null;
    else if (!t.plan) planTemple(t, time + 2 + Math.random() * 2);
  }
}

function updateTemples(dt) {
  for (const t of temples) {
    if (!t.active) continue;
    const wt = world.temples[t.idx];
    const sh = wt.shumoku;
    const plan = t.plan;
    if (plan && (sh.state === 'idle' || sh.state === 'pull')) {
      let target = 0;
      for (const seg of plan.segs) {
        const u = (time - seg.start) / seg.dur;
        if (u < 0) break;
        if (seg.type === 'feint' && u <= 1) target = seg.amp * Math.sin(Math.PI * u);
        if (seg.type === 'pull') {
          if (u < 1) target = seg.amp * (1 - Math.pow(1 - u, 2));
          else if (!plan.released) {
            plan.released = true;
            sh.release(seg.amp);
          }
        }
      }
      if (!plan.released && (target > 0.001 || sh.state === 'pull')) sh.setPull(target, dt);
      if (!plan.released && target <= 0.001 && sh.state === 'pull' && Math.abs(sh.theta) < 0.003) {
        sh.theta = 0;
        sh.state = 'idle';
      }
    }
    const hit = sh.update(dt);
    if (hit > 0) onTempleRing(t, hit);
  }
}

function onTempleRing(t, power) {
  t.lastRing = time;
  planTemple(t, time + t.def.period - 3.2 + (Math.random() - 0.5) * 2.4);
  world.ringTemple(t.idx, power);
  // 距離に応じた遅れはごく僅かなので省略
  audio.distantBell(power, t.def.pitch, t.def.pan, t.def.vol);
  if (game.state === 'play' || game.state === 'final') {
    for (const s of game.pending) {
      if (!s.resolved && time - s.t <= COMBO_WIN) s.temples.add(t.idx);
    }
  }
}

// ---- HUD ----

function popup(text, sub = '', cls = '') {
  const el = document.createElement('div');
  el.className = 'popup ' + cls;
  el.innerHTML = `<div class="p-main">${text}</div>${sub ? `<div class="p-sub">${sub}</div>` : ''}`;
  $('popups').appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function banner(text, sub = '') {
  const el = $('banner');
  el.innerHTML = `<div class="b-main">${text}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
  el.classList.remove('hidden');
}
function hideBanner() { $('banner').classList.add('hidden'); }

function templeName(i) { return tr('temples')[i]; }

function wordAt(n) {
  const i = game.words[n];
  if (i === undefined) return '';
  return (getLang() === 'en' ? BONNOU_EN : BONNOU)[i];
}

function setBonnou() {
  const el = $('bonnou');
  const w = game.state === 'countdown' ? '' : wordAt(game.count);
  el.textContent = w;
  el.classList.remove('vanish');
  $('bonnouCaption').textContent = w ? tr('caption', game.count + 1) : '';
}

function applyLang() {
  applyStatic();
  if (game.state !== 'title') { setBonnou(); updateHud(); }
  const best = loadBest(108);
  $('best').textContent = best ? tr('best', best) : '';
}

function vanishBonnou() {
  const el = $('bonnou');
  const ghost = el.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.add('vanish');
  el.parentNode.appendChild(ghost);
  setTimeout(() => ghost.remove(), 1600);
}

function pad(n) { return String(n).padStart(2, '0'); }

function updateClock() {
  const el = $('clock');
  if (game.state === 'countdown') {
    const s = Math.max(55, Math.min(59, 55 + Math.floor(game.countdownT)));
    el.textContent = `23:59:${pad(s)}`;
  } else if (game.state === 'final' || game.state === 'end') {
    el.textContent = game.state === 'end' ? '0:01' : '0:00';
  } else {
    const m = Math.min(59, Math.floor((game.count / Math.max(1, game.total - 1)) * 59));
    el.textContent = `23:${pad(m)}`;
  }
}

function updateHud() {
  $('count').textContent = game.count;
  $('total').textContent = game.total;
  $('score').textContent = game.score;
  $('combo').textContent = game.combo >= 1 ? tr('comboHud', game.combo) : '';
  updateClock();
}

// ---- 打撃 ----
function yoinNow() {
  return game.lastPower * Math.exp(-(time - game.lastStrikeT) / YOIN_TAU);
}

function onPlayerStrike(power) {
  audio.bell(power);
  world.strike(power);
  if (navigator.vibrate) navigator.vibrate(Math.round(30 + power * 70));
  if (game.state !== 'play' && game.state !== 'final') return;

  const yoin = yoinNow();
  game.count++;
  updateActiveTemples(true);
  vanishBonnou();

  // 強さ
  let ratingText, rk;
  if (power >= 0.92) rk = 'great';
  else if (power >= 0.65) rk = 'good';
  else if (power >= 0.35) rk = 'ok';
  else rk = 'bad';
  ratingText = tr(rk);
  game.stats[rk]++;
  const powerPts = Math.round(60 * power);
  // 余韻
  let yoinPts, yoinText;
  if (game.count === 1 || yoin < 0.15) { yoinPts = 20; yoinText = tr('yoinGood'); }
  else if (yoin > 0.55) { yoinPts = 0; yoinText = tr('yoinBad'); }
  else { yoinPts = Math.round(20 * (1 - (yoin - 0.15) / 0.4)); yoinText = tr('yoinMid'); }
  const pts = powerPts + yoinPts;
  game.score += pts;
  popup(ratingText, `${yoinText}　+${pts}`, rk);

  game.lastStrikeT = time;
  game.lastPower = power;

  // 共鳴判定（直前に鳴った遠くの鐘）
  const rec = { t: time, temples: new Set(), resolved: false };
  for (const t of temples) if (time - t.lastRing <= COMBO_WIN) rec.temples.add(t.idx);
  game.pending.push(rec);

  if (game.count <= 3) $('hint').classList.add('fade');

  if (game.count === game.total - 1) {
    game.state = 'countdown';
    game.countdownT = -2.5;
    $('bonnou').textContent = '';
    $('bonnouCaption').textContent = '';
    banner(tr('soon'), tr('soonSub'));
  } else if (game.count >= game.total) {
    game.state = 'end';
    setTimeout(() => {
      banner(tr('newYear'), tr('year', newYear()));
      world.dawn = 0.6;
    }, 900);
    setTimeout(showResult, 6000);
  } else {
    setBonnou();
  }
  updateHud();
}

function resolvePending() {
  for (const s of game.pending) {
    if (s.resolved || time - s.t < COMBO_WIN + 0.02) continue;
    s.resolved = true;
    if (s.temples.size > 0) {
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.stats.reso++;
      const bonus = Math.min(80, 30 + 10 * (game.combo - 1)) * s.temples.size;
      game.score += bonus;
      const names = [...s.temples].map((i) => templeName(i)).join(tr('joiner'));
      const title = s.temples.size >= 2 ? tr('resoBig') : tr('reso');
      popup(tr('resoPop', title, game.combo), tr('resoSub', names, bonus), 'reso');
      audio.chime(game.combo);
    } else if (game.combo > 0) {
      game.combo = 0;
    }
    updateHud();
  }
  game.pending = game.pending.filter((s) => !s.resolved);
}

// ---- 入力 ----
function canPull() {
  return (game.state === 'play' || game.state === 'final' || game.state === 'title') && world.shumoku.ready;
}

function pressStart() {
  if (input.holding) return;
  audio.init();
  if (!canPull()) return;
  input.holding = true;
  input.pull = 0;
}

function pressEnd() {
  if (!input.holding) return;
  input.holding = false;
  if (world.shumoku.state === 'pull') world.shumoku.release(input.pull);
}

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .overlay:not(.hidden) .panel')) return;
  if (game.state === 'title') return;
  pressStart();
});
window.addEventListener('pointerup', pressEnd);
window.addEventListener('pointercancel', pressEnd);
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (e.target.closest && e.target.closest('button')) return;
  e.preventDefault();
  if (e.repeat) return;
  if (game.state === 'title') return;
  pressStart();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') pressEnd();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- 画面遷移 ----
function newYear() {
  const d = new Date();
  return d.getMonth() === 0 ? d.getFullYear() : d.getFullYear() + 1;
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function bestKey() { return `joya-best-${game.total}`; }
function loadBest(total) {
  try { return Number(localStorage.getItem(`joya-best-${total}`)) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem(bestKey(), String(v)); } catch { /* 保存できない環境 */ }
}

function showTitle() {
  game.state = 'title';
  $('title').classList.remove('hidden');
  $('result').classList.add('hidden');
  $('hud').classList.add('hidden');
  world.dawn = 0;
  updateActiveTemples(false);
  applyLang();
}

function startGame(total) {
  audio.init();
  game.total = total;
  game.count = 0;
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.stats = { great: 0, good: 0, ok: 0, bad: 0, reso: 0 };
  game.words = shuffle(BONNOU.map((_, i) => i)).slice(0, total);
  game.lastStrikeT = -99;
  game.lastPower = 0;
  game.pending = [];
  game.state = 'play';
  world.dawn = 0;
  updateActiveTemples(false);
  $('title').classList.add('hidden');
  $('result').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.remove('fade');
  hideBanner();
  setBonnou();
  updateHud();
}

function rankFor(avg) {
  const r = tr('ranks');
  if (avg >= 115) return r[0];
  if (avg >= 95) return r[1];
  if (avg >= 75) return r[2];
  if (avg >= 55) return r[3];
  return r[4];
}

function showResult() {
  hideBanner();
  const avg = game.score / game.total;
  const [rank, msg] = rankFor(avg);
  const prev = loadBest(game.total);
  const isBest = game.score > prev;
  if (isBest) saveBest(game.score);
  $('resYear').textContent = tr('year', newYear());
  $('resRank').textContent = rank;
  $('resScore').textContent = game.score;
  $('resGreat').textContent = game.stats.great;
  $('resGood').textContent = game.stats.good;
  $('resOk').textContent = game.stats.ok;
  $('resBad').textContent = game.stats.bad;
  $('resReso').textContent = game.stats.reso;
  $('resMaxCombo').textContent = game.maxCombo;
  $('resMsg').textContent = msg;
  $('resBest').textContent = isBest ? tr('newBest') : tr('best', prev);
  $('result').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

// 音はブラウザの決まりで最初の操作まで準備できないので、タイトルで最初に触れた時点で準備する
window.addEventListener('pointerdown', () => audio.init(), { once: true });
// スマホ：全画面にして横向きに固定（対応端末のみ。iPhone などは案内表示で横向きにしてもらう）
async function goLandscape() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch { /* 非対応の環境 */ }
}
async function beginWhenReady() {
  goLandscape();
  audio.init();
  await audio.ready();
  startGame(108);
}
$('start').addEventListener('click', beginWhenReady);
document.querySelectorAll('[data-lang-toggle]').forEach((b) => {
  b.addEventListener('click', () => { setLang(getLang() === 'ja' ? 'en' : 'ja'); applyLang(); });
});
$('howtoStart').addEventListener('click', () => { $('howto').classList.add('hidden'); beginWhenReady(); });
$('openHowto').addEventListener('click', () => {
  $('title').classList.add('hidden');
  $('howto').classList.remove('hidden');
  $('howto').scrollTop = 0;
});
$('closeHowto').addEventListener('click', () => {
  $('howto').classList.add('hidden');
  $('title').classList.remove('hidden');
});
$('retry').addEventListener('click', () => startGame(108));
$('toTitle').addEventListener('click', showTitle);
$('mute').addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  $('mute').classList.toggle('off', audio.muted);
});

// ---- ループ ----
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;

  // 撞木を引く
  const sh = world.shumoku;
  if (input.holding && (sh.state === 'idle' || sh.state === 'pull')) {
    input.pull = Math.min(1, input.pull + dt / PULL_TIME);
    sh.setPull(1 - Math.pow(1 - input.pull, 1.6), dt);
  }
  world.pullAmount = input.holding ? input.pull : 0;
  const hit = sh.update(dt);
  if (hit > 0) onPlayerStrike(hit);

  updateTemples(dt);
  resolvePending();

  if (game.state === 'countdown') {
    game.countdownT += dt;
    if (game.countdownT >= 5) {
      game.state = 'final';
      banner(tr('dawn'), tr('dawnSub'));
      setBonnou();
      setTimeout(() => { if (game.state === 'final') hideBanner(); }, 3000);
    }
    updateClock();
  }

  // ゲージ
  const gauge = $('gauge');
  gauge.classList.toggle('active', input.holding);
  $('gaugeMarker').style.height = `${(input.holding ? input.pull : 0) * 100}%`;
  const y = Math.max(0, Math.min(1, yoinNow()));
  $('yoinRing').style.setProperty('--y', y.toFixed(3));

  world.update(dt, time);
  requestAnimationFrame(frame);
}

// ---- 起動：すべて読み込んで試し描きを済ませてからタイトルを出す ----
const setProgress = (v) => { $('loadFill').style.width = `${Math.round(v * 100)}%`; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
(async () => {
  try {
    applyStatic();
    setProgress(0.05);
    await nextFrame();
    await nextFrame();
    world = new World($('scene'));
    window.__joya = { world, game };
    setProgress(0.3);
    await world.warmup(setProgress);
    setProgress(1);
    showTitle();
    last = performance.now();
    requestAnimationFrame(frame);
    await new Promise((r) => setTimeout(r, 250));
    $('loading').classList.add('hidden');
  } catch (err) {
    console.error(err);
    $('loading').querySelector('.loading-text').textContent = tr('noWebgl');
  }
})();
