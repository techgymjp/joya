// キャンバスで手続き的に生成するテクスチャ群（外部画像に依存しない）
import * as THREE from 'three';

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { repeat = [1, 1], color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(ctx, w, h, n, r, colors, rnd, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rnd();
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const rr = r * (0.3 + rnd());
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// 古びた木材（木目は縦方向 = v）
export function woodTexture(base = '#4a2a1a', seed = 1) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 256;
    const wv = 1 + rnd() * 3;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,220,180,0.06)';
    ctx.lineWidth = wv;
    ctx.beginPath();
    for (let y = 0; y <= 512; y += 16) {
      const xx = x + Math.sin(y * 0.02 + i) * 3 + (rnd() - 0.5) * 1.5;
      if (y === 0) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  speckle(ctx, 256, 512, 300, 2, ['#000', '#2a160c'], rnd, 0.25);
  return toTex(c);
}

export function stoneTexture(seed = 2, repeat = [2, 2]) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#6f6d68';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 2500, 3, ['#4d4b47', '#8b8983', '#5c5a55', '#9a988f'], rnd, 0.45);
  speckle(ctx, 256, 256, 60, 14, ['#3f4a3a', '#55524b'], rnd, 0.18);
  return toTex(c, { repeat });
}

// 瓦屋根（u: 軒方向、v: 棟方向）
export function roofTexture(seed = 3) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#2d3036';
  ctx.fillRect(0, 0, 256, 256);
  const cols = 8;
  for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * (256 / cols);
    const g = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.5, 'rgba(160,170,185,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 16, 0, 32, 256);
  }
  for (let j = 0; j < 8; j++) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, j * 32, 256, 3);
  }
  speckle(ctx, 256, 256, 400, 2, ['#000', '#555'], rnd, 0.2);
  return toTex(c);
}

export function snowTexture(seed = 4, repeat = [30, 30]) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#e9eef5';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1800, 2.5, ['#ffffff', '#cfd8e6', '#dfe6f0'], rnd, 0.5);
  speckle(ctx, 256, 256, 40, 20, ['#c7d1e0'], rnd, 0.15);
  return toTex(c, { repeat });
}

// 青銅（緑青の斑）
export function bronzeTexture(seed = 5) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#6b5636';
  ctx.fillRect(0, 0, 512, 256);
  speckle(ctx, 512, 256, 600, 10, ['#3f4f3c', '#4e6a55', '#2f3a2c'], rnd, 0.35);
  speckle(ctx, 512, 256, 3000, 2, ['#2a2015', '#8a7048', '#1d1a12'], rnd, 0.35);
  // 縦の雨垂れ
  for (let i = 0; i < 70; i++) {
    const x = rnd() * 512;
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(70,110,90,0.0)');
    g.addColorStop(0.4, 'rgba(70,110,90,0.25)');
    g.addColorStop(1, 'rgba(70,110,90,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rnd() * 5, 256);
  }
  return toTex(c, { repeat: [2, 1] });
}

// 柔らかい円（雪、火の粉、光）
export function softDot(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 64) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.6)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTex(c);
}

export function glowTexture(color = '255,190,110') {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${color},1)`);
  g.addColorStop(0.2, `rgba(${color},0.55)`);
  g.addColorStop(0.5, `rgba(${color},0.12)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTex(c);
}

export function moonTexture() {
  const rnd = rand(9);
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,250,235,1)');
  g.addColorStop(0.33, 'rgba(250,245,225,1)');
  g.addColorStop(0.36, 'rgba(200,210,240,0.35)');
  g.addColorStop(0.6, 'rgba(150,170,230,0.08)');
  g.addColorStop(1, 'rgba(150,170,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 32;
    ctx.fillStyle = `rgba(200,195,185,${0.3 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 4 + rnd() * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTex(c);
}

export function ringTexture() {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 90, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,230,180,0)');
  g.addColorStop(0.7, 'rgba(255,230,180,0.9)');
  g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return toTex(c);
}

// 障子（暖かい灯り）
export function shojiTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#ffcf8a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#3a2214';
  for (let i = 0; i <= 4; i++) ctx.fillRect(i * 62, 0, 6, 256);
  for (let j = 0; j <= 6; j++) ctx.fillRect(0, j * 42, 256, 5);
  return toTex(c);
}

// 燃えさしの薪
export function emberTexture(seed = 7) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, 400, 5, ['#ff6a10', '#ffb040', '#a02800'], rnd, 0.6);
  return toTex(c);
}

// 松の樹皮（赤茶の亀甲状の割れ）
export function pineBarkTexture(seed = 31) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = '#4a2c1e';
  ctx.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 512; y += 22 + rnd() * 10) {
    for (let x = -20; x < 256; x += 30 + rnd() * 20) {
      const w = 26 + rnd() * 18, h = 18 + rnd() * 12;
      ctx.fillStyle = `hsl(${14 + rnd() * 10}, ${30 + rnd() * 20}%, ${18 + rnd() * 14}%)`;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, y);
      ctx.lineTo(x + w * 0.85, y + rnd() * 3);
      ctx.lineTo(x + w, y + h * 0.6);
      ctx.lineTo(x + w * 0.7, y + h);
      ctx.lineTo(x + w * 0.1, y + h * 0.9);
      ctx.lineTo(x, y + h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,4,2,0.8)';
      ctx.lineWidth = 2 + rnd() * 2;
      ctx.stroke();
    }
  }
  speckle(ctx, 256, 512, 500, 2, ['#1a0d06', '#7a5038'], rnd, 0.3);
  return toTex(c);
}

// 松葉（細かい針状の葉）
export function needleTexture(seed = 32) {
  const rnd = rand(seed);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#1b3020';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256;
    const a = rnd() * Math.PI * 2, l = 5 + rnd() * 9;
    ctx.strokeStyle = `hsla(${120 + rnd() * 30}, ${30 + rnd() * 25}%, ${12 + rnd() * 22}%, 0.9)`;
    ctx.lineWidth = 0.8 + rnd() * 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return toTex(c, { repeat: [2, 2] });
}

// 松葉の房（透過付き・灰色）：中心から針葉が放射状に伸びる。色は頂点カラーで付ける
export function needleTuftTexture(seed = 33) {
  const rnd = rand(seed);
  const S = 256;
  const [c, ctx] = canvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.lineCap = 'round';
  // 枝先から扇状に伸びる房（全方向のウニ形にしない）
  const ox = S / 2, oy = S * 0.78;
  for (let i = 0; i < 150; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6 * (0.6 + rnd() * 0.4);
    const len = S * (0.3 + rnd() * 0.38) * (1 - Math.abs(a + Math.PI / 2) * 0.18);
    const bend = (rnd() - 0.5) * 0.4;
    const sx = ox + (rnd() - 0.5) * 30, sy = oy + rnd() * 20; // 小枝に沿って根元を散らす
    const x0 = sx, y0 = sy;
    const xm = sx + Math.cos(a + bend * 0.5) * len * 0.55, ym = sy + Math.sin(a + bend * 0.5) * len * 0.55;
    const x1 = sx + Math.cos(a + bend) * len, y1 = sy + Math.sin(a + bend) * len;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    // 色は頂点カラーで付けるので、ここでは明暗だけ（灰色）
    const l = 55 + rnd() * 30;
    g.addColorStop(0, `hsl(0, 0%, ${l * 0.55}%)`);
    g.addColorStop(1, `hsl(0, 0%, ${Math.min(100, l + 12)}%)`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(xm, ym, x1, y1);
    ctx.stroke();
  }
  ctx.strokeStyle = '#4a3020';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(ox - 18, oy + 22);
  ctx.lineTo(ox + 14, oy - 6);
  ctx.stroke();
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
