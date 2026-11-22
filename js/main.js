// 除夜の鐘 — ゲーム進行
import { World, TEMPLE_DEFS } from './world.js';
import { BellAudio } from './audio.js';
import { BONNOU } from './bonnou.js';
import { SWING } from './shoro.js';

const $ = (id) => document.getElementById(id);

const PULL_TIME = 1.4;    // 最大まで引くのにかかる秒数
const COMBO_WIN = 0.35;   // 遠くの鐘と「同時」とみなす時間差（秒）
const YOIN_TAU = 2.4;     // 余韻の減衰時定数（秒）
// 振り子が最大角から鐘に届くまでのおおよその時間
const SWING_TIME = (Math.PI / 2) / Math.sqrt(SWING.omega2) * (1 + SWING.maxAngle ** 2 / 16);

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

// ---- 遠くの寺のスケジュール ----
const temples = TEMPLE_DEFS.map((d, i) => ({
  def: d,
  idx: i,
  next: 4 + i * 2.7,
  period: d.period,
  lastRing: -99,
  released: false,
}));

function scheduleTemple(t, from) {
  t.next = from + t.period * (0.93 + Math.random() * 0.14);
  t.released = false;
}

function updateTemples(dt) {
  for (const t of temples) {
    const wt = world.temples[t.idx];
    const releaseAt = t.next - SWING_TIME;
    const pullStart = releaseAt - PULL_TIME;
    if (wt.shumoku.state === 'idle' || wt.shumoku.state === 'pull') {
      if (time >= pullStart && time < releaseAt) {
        const p = Math.min(1, (time - pullStart) / PULL_TIME);
        wt.shumoku.setPull(0.85 * (1 - Math.pow(1 - p, 2)), dt);
      } else if (time >= releaseAt && !t.released) {
        t.released = true;
        if (wt.shumoku.state === 'pull') wt.shumoku.release(0.85);
      }
    }
    const hit = wt.shumoku.update(dt);
    if (hit > 0) onTempleRing(t, hit);
  }
}

function onTempleRing(t, power) {
  t.lastRing = time;
  scheduleTemple(t, time);
  world.ringTemple(t.idx, power);
  // 距離に応じた遅れはごく僅かなので省略
  audio.distantBell(power, t.def.pitch, t.def.pan, t.def.vol);
  const el = templeEls[t.idx];
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  if (game.state === 'play' || game.state === 'final') {
    for (const s of game.pending) {
      if (!s.resolved && time - s.t <= COMBO_WIN) s.temples.add(t.idx);
    }
  }
}

// ---- HUD ----
const templeEls = TEMPLE_DEFS.map((d) => {
  const el = document.createElement('div');
  el.className = 'temple';
  el.innerHTML = `<div class="ring"><div class="dot"></div></div><div class="name">${d.name}</div>`;
  $('temples').appendChild(el);
  return el;
});

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

function setBonnou() {
  const el = $('bonnou');
  const w = game.words[game.count];
  el.textContent = w || '';
  el.classList.remove('vanish');
  $('bonnouCaption').textContent = w ? `払う煩悩　其の${game.count + 1}` : '';
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
  $('combo').textContent = game.combo >= 1 ? `共鳴 ${game.combo} 連` : '';
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
  vanishBonnou();

  // 強さ
  let ratingText, rk;
  if (power >= 0.92) { ratingText = '見事'; rk = 'great'; }
  else if (power >= 0.65) { ratingText = '良し'; rk = 'good'; }
  else if (power >= 0.35) { ratingText = 'やや弱い'; rk = 'ok'; }
  else { ratingText = 'かすか'; rk = 'bad'; }
  game.stats[rk]++;
  const powerPts = Math.round(60 * power);
  // 余韻
  let yoinPts, yoinText;
  if (game.count === 1 || yoin < 0.15) { yoinPts = 20; yoinText = '余韻を聴いた'; }
  else if (yoin > 0.55) { yoinPts = 0; yoinText = 'せっかち'; }
  else { yoinPts = Math.round(20 * (1 - (yoin - 0.15) / 0.4)); yoinText = '余韻が残る'; }
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
    banner('まもなく年が明けます', '最後の一打は新年に');
  } else if (game.count >= game.total) {
    game.state = 'end';
    setTimeout(() => {
      banner('謹賀新年', `${newYear()}年`);
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
      const names = [...s.temples].map((i) => TEMPLE_DEFS[i].name).join('・');
      const title = s.temples.size >= 2 ? '大共鳴' : '共鳴';
      popup(`${title}！ ${game.combo}連`, `${names}と響き合う　+${bonus}`, 'reso');
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
  if (game.state === 'title' && !$('title').classList.contains('hidden')) return;
  pressStart();
});
window.addEventListener('pointerup', pressEnd);
window.addEventListener('pointercancel', pressEnd);
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (e.target.closest && e.target.closest('button')) return;
  e.preventDefault();
  if (e.repeat) return;
  if (game.state === 'title' && !$('title').classList.contains('hidden')) return;
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
  const b108 = loadBest(108), b12 = loadBest(12);
  $('best').textContent = b108 || b12 ? `最高得点　百八打: ${b108}　十二打: ${b12}` : '';
}

function startGame(total) {
  audio.init();
  game.total = total;
  game.count = 0;
  game.score = 0;
  game.combo = 0;
  game.maxCombo = 0;
  game.stats = { great: 0, good: 0, ok: 0, bad: 0, reso: 0 };
  game.words = shuffle(BONNOU).slice(0, total);
  game.lastStrikeT = -99;
  game.lastPower = 0;
  game.pending = [];
  game.state = 'play';
  world.dawn = 0;
  $('title').classList.add('hidden');
  $('result').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hint').classList.remove('fade');
  hideBanner();
  setBonnou();
  updateHud();
}

function rankFor(avg) {
  if (avg >= 115) return ['解脱', '鐘の声に、迷いはひとつも残っていない。'];
  if (avg >= 95) return ['悟りの境地', '遠くの寺と心を通わせ、見事に年を越した。'];
  if (avg >= 75) return ['心清らか', '澄んだ響きで新しい年を迎えた。'];
  if (avg >= 55) return ['修行中', 'まだ少し煩悩が残っている。来年もまた。'];
  return ['煩悩まみれ', '焦らず、余韻に耳を澄ませてみよう。'];
}

function showResult() {
  hideBanner();
  const avg = game.score / game.total;
  const [rank, msg] = rankFor(avg);
  const prev = loadBest(game.total);
  const isBest = game.score > prev;
  if (isBest) saveBest(game.score);
  $('resYear').textContent = `${newYear()}年`;
  $('resRank').textContent = rank;
  $('resScore').textContent = game.score;
  $('resGreat').textContent = game.stats.great;
  $('resGood').textContent = game.stats.good;
  $('resOk').textContent = game.stats.ok;
  $('resBad').textContent = game.stats.bad;
  $('resReso').textContent = game.stats.reso;
  $('resMaxCombo').textContent = game.maxCombo;
  $('resMsg').textContent = msg;
  $('resBest').textContent = isBest ? '最高得点を更新しました' : `最高得点 ${prev}`;
  $('result').classList.remove('hidden');
  $('hud').classList.add('hidden');
}

document.querySelectorAll('[data-mode]').forEach((b) => {
  b.addEventListener('click', () => startGame(Number(b.dataset.mode)));
});
$('retry').addEventListener('click', () => startGame(game.total));
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
      banner('年が明けました', '最後の一打を');
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
  for (const t of temples) {
    const p = 1 - Math.max(0, t.next - time) / t.period;
    templeEls[t.idx].style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(3));
  }

  world.update(dt, time);
  requestAnimationFrame(frame);
}

// ---- 起動 ----
try {
  world = new World($('scene'));
  window.__joya = { world, game };
  $('loading').classList.add('hidden');
  showTitle();
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  $('loading').querySelector('.loading-text').textContent = 'WebGL を利用できないため表示できません。';
}
