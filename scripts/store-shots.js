// Google Play 用の画像を撮る（Web 版をローカルで配信した状態で実行）
//   python3 -m http.server 8123  → node scripts/store-shots.js
// 出力：docs/store/images/（スクリーンショット 1920x1080 日英各5枚、フィーチャーグラフィック 1024x500 日英、アイコン 512）
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'docs', 'store', 'images');
const URL = process.env.URL || 'http://localhost:8123/index.html?q=high';

const TEXT = {
  ja: {
    reso: ['大共鳴！ 5連', '西の寺・北の寺と響き合う　+160'],
    soon: ['まもなく年が明けます', '最後の一打は新年に'],
    fg: ['除夜の鐘', '大晦日、百八の煩悩を払う'],
    result: { rank: '悟りの境地', score: 11254, great: 71, good: 29, ok: 6, bad: 2, reso: 64, combo: 18, msg: '遠くの寺と心を通わせ、見事に年を越した。' },
  },
  en: {
    reso: ['Great Resonance! ×5', 'In tune with the West Temple & North Temple  +160'],
    soon: ['The new year is near', 'Save the last strike for the new year'],
    fg: ['Joya no Kane', 'Ring the temple bell 108 times on New Year\'s Eve'],
    result: { rank: 'Enlightenment', score: 11254, great: 71, good: 29, ok: 6, bad: 2, reso: 64, combo: 18, msg: 'In harmony with the distant temples, you saw the year out beautifully.' },
  },
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const shot = async (p, file) => p.screenshot({ path: path.join(OUT, file), timeout: 240000 });

  for (const lang of ['ja', 'en']) {
    const T = TEXT[lang];
    const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2, locale: lang === 'ja' ? 'ja-JP' : 'en-US' });
    await ctx.addInitScript((l) => { try { localStorage.setItem('joya-lang', l); localStorage.setItem('joya-best-108', '11254'); } catch {} }, lang);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERR', e.message));
    await p.goto(URL);
    await p.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 300000 });
    await p.waitForTimeout(1500);

    // 5. タイトル
    await shot(p, `${lang}-5-title.png`);

    // ゲーム開始 → 3つの寺が鳴る段階へ
    await p.evaluate(() => document.getElementById('start').click());
    await p.waitForFunction(() => window.__joya.game.state === 'play', null, { timeout: 60000 });
    await p.evaluate(() => { const g = window.__joya.game; g.count = 60; g.score = 6120; g.combo = 4; });
    await p.mouse.move(480, 300); await p.mouse.down(); await p.waitForTimeout(200); await p.mouse.up();
    await p.waitForFunction(() => window.__joya.game.count >= 61, null, { timeout: 200000 });
    await p.evaluate(() => { document.getElementById('hint').classList.add('fade'); document.getElementById('popups').innerHTML = ''; });
    await p.waitForFunction(() => window.__joya.world.shumoku.ready, null, { timeout: 200000 });

    // 1. 和尚が撞木を引く
    await p.mouse.down();
    await p.waitForFunction(() => document.getElementById('gaugeMarker').style.height === '100%', null, { timeout: 300000 });
    await shot(p, `${lang}-1-pull.png`);
    await p.mouse.up();
    await p.waitForFunction(() => window.__joya.game.count >= 62, null, { timeout: 200000 });

    // 2. 共鳴：遠くの寺と同時に鳴る
    await p.evaluate((reso) => {
      const w = window.__joya.world;
      w.ringTemple(0, 0.9); w.ringTemple(1, 0.9); w.strike(1); w.glowBell(1);
      const el = document.getElementById('popups');
      el.innerHTML = `<div class="popup reso" style="animation:none;opacity:1"><div class="p-main">${reso[0]}</div><div class="p-sub">${reso[1]}</div></div>`;
      document.getElementById('combo').textContent = el.dataset.c || '';
    }, T.reso);
    await p.waitForTimeout(600);
    await shot(p, `${lang}-2-resonance.png`);
    await p.evaluate(() => { document.getElementById('popups').innerHTML = ''; });

    // 3. 年越しのカウントダウン
    await p.evaluate((soon) => {
      const g = window.__joya.game;
      g.count = 107;
      document.getElementById('count').textContent = '107';
      document.getElementById('clock').textContent = '23:59:57';
      document.getElementById('bonnou').textContent = '';
      document.getElementById('bonnouCaption').textContent = '';
      const bn = document.getElementById('banner');
      bn.innerHTML = `<div class="b-main">${soon[0]}</div><div class="b-sub">${soon[1]}</div>`;
      bn.classList.remove('hidden');
      bn.style.animation = 'none';
    }, T.soon);
    await p.waitForTimeout(600);
    await shot(p, `${lang}-3-countdown.png`);

    // 4. 結果（謹賀新年）
    await p.evaluate((r) => {
      const $ = (id) => document.getElementById(id);
      $('banner').classList.add('hidden');
      $('hud').classList.add('hidden');
      window.__joya.world.dawn = 0.6;
      $('resYear').textContent = document.documentElement.lang === 'ja' ? `${new Date().getFullYear() + 1}年` : `${new Date().getFullYear() + 1}`;
      $('resRank').textContent = r.rank; $('resScore').textContent = r.score;
      $('resGreat').textContent = r.great; $('resGood').textContent = r.good; $('resOk').textContent = r.ok; $('resBad').textContent = r.bad;
      $('resReso').textContent = r.reso; $('resMaxCombo').textContent = r.combo; $('resMsg').textContent = r.msg;
      $('resBest').textContent = ''; $('resRedoRow').classList.add('hidden');
      $('result').classList.remove('hidden');
    }, T.result);
    await p.waitForTimeout(1500);
    await shot(p, `${lang}-4-result.png`);
    await ctx.close();

    // フィーチャーグラフィック（1024x500）：景色にタイトルを重ねる
    const fctx = await b.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1, locale: lang === 'ja' ? 'ja-JP' : 'en-US' });
    await fctx.addInitScript((l) => { try { localStorage.setItem('joya-lang', l); } catch {} }, lang);
    const f = await fctx.newPage();
    await f.goto(URL);
    await f.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 300000 });
    await f.evaluate((fg) => {
      document.getElementById('title').classList.add('hidden');
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;right:0;top:26px;text-align:center;font-family:var(--font);color:#f4ead8;text-shadow:0 0 24px rgba(0,0,0,.9),0 0 4px #000;z-index:50';
      const ja = document.documentElement.lang === 'ja';
      d.innerHTML = `<div style="font-size:${ja ? 64 : 54}px;letter-spacing:${ja ? '0.3em' : '0.06em'};padding-left:${ja ? '0.3em' : '0'};font-weight:600">${fg[0]}</div><div style="font-size:22px;color:#e8c27a;letter-spacing:.12em;margin-top:4px">${fg[1]}</div>`;
      document.body.appendChild(d);
    }, T.fg);
    await f.waitForTimeout(1500);
    await f.screenshot({ path: path.join(OUT, `${lang}-feature-graphic.png`), timeout: 240000 });
    await fctx.close();
  }

  // アイコン 512x512
  const ip = await b.newPage({ viewport: { width: 512, height: 512 } });
  await ip.goto('file://' + path.join(__dirname, '..', 'assets', 'icon-only.png'));
  await ip.evaluate(() => { const i = document.querySelector('img'); i.style.width = '512px'; i.style.height = '512px'; document.body.style.margin = '0'; });
  await ip.screenshot({ path: path.join(OUT, 'icon-512.png') });
  await b.close();
  console.log('done');
})();
