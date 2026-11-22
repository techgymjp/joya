// 雪の松（日本の庭木の黒松）
// ・うねる幹から枝が下がり、先端が持ち上がって葉の塊を支える
// ・葉は松葉の房（透過テクスチャの板）を多数重ねたふさふさの塊
// ・塊の上にはふっくら丸い雪が厚く積もり、縁や下から松葉がのぞく
// ・枝の上にも雪の筋。雪吊りとこも巻き
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

let shared = null;
function sharedAssets() {
  if (shared) return shared;
  const v = new THREE.Vector3();
  // 雪の塊：下が平らで上が丸く膨らむ、少しいびつな形
  const snow = new THREE.SphereGeometry(1, 18, 10);
  const s = snow.attributes.position;
  for (let i = 0; i < s.count; i++) {
    v.fromBufferAttribute(s, i);
    const n = Math.sin(v.x * 5.3 + v.z * 2.1) * 0.5 + Math.sin(v.z * 6.1 - v.x * 3.7) * 0.5;
    v.multiplyScalar(0.92 + 0.1 * n);
    if (v.y < 0) v.y *= 0.25;
    s.setXYZ(i, v.x, v.y, v.z);
  }
  snow.computeVertexNormals();
  // 葉の塊の芯（隙間から向こうが透けないように暗い芯を入れる）
  const core = new THREE.SphereGeometry(1, 12, 7);
  const tuft = TX.needleTuftTexture();
  const bark = TX.pineBarkTexture();
  // 遠景用の軽い形
  const snowLow = new THREE.SphereGeometry(1, 7, 4);
  const sl = snowLow.attributes.position;
  for (let i = 0; i < sl.count; i++) { v.fromBufferAttribute(sl, i); if (v.y < 0) v.y *= 0.25; sl.setXYZ(i, v.x, v.y, v.z); }
  snowLow.computeVertexNormals();
  shared = {
    snow, core, snowLow,
    bark: new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 3, roughness: 0.95, color: 0x8a7a70 }),
    needles: new THREE.MeshStandardMaterial({
      map: tuft, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.85,
    }),
    needleDepth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tuft, alphaTest: 0.45 }),
    coreMat: new THREE.MeshStandardMaterial({ color: 0x14251a, roughness: 1 }),
    straw: new THREE.MeshStandardMaterial({ color: 0xc4a468, roughness: 1 }),
  };
  return shared;
}

// 先細りのチューブ
function taperTube(curve, segs, radial, r0, r1, ovalUp = 1) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * Math.pow(u, 0.75);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r);
      v.y *= ovalUp;
      v.add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

function rng(seed) {
  let s = (seed * 7919) % 233280;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
function placed(geo, pos, scale, rotY = 0) {
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  m4.compose(pos, q, scale);
  return geo.clone().applyMatrix4(m4);
}

function cylinderBetween(a, b, r) {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), 4, 1, true);
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m4);
}

// 松葉の房の板を一つのジオメトリに積み上げる
class Foliage {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; }
  card(center, normal, size, spin, color) {
    const n = normal.clone().normalize();
    const t = new THREE.Vector3(0, 1, 0).cross(n);
    if (t.lengthSq() < 1e-4) t.set(1, 0, 0);
    t.normalize();
    const b = n.clone().cross(t).normalize();
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const u = t.clone().multiplyScalar(cs).addScaledVector(b, sn).multiplyScalar(size / 2);
    const w = b.clone().multiplyScalar(cs).addScaledVector(t, -sn).multiplyScalar(size / 2);
    const base = this.pos.length / 3;
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [a, bb, uu, vv] of corners) {
      this.pos.push(center.x + u.x * a + w.x * bb, center.y + u.y * a + w.y * bb, center.z + u.z * a + w.z * bb);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uu, vv);
      this.col.push(color.r, color.g, color.b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/**
 * @param {object} o
 *  height: 幹の高さ, spread: 枝の張り, lean: 幹の傾き, seed, yukitsuri: 雪吊り, snowMat, density: 葉の密度
 *  snowStyle: 'heavy'（ふっくら厚い雪）| 'light'（松葉にうっすら積もる薄雪）
 *  longBranch: 低く横へ長く伸びる枝を加える
 */
export function makePine(opts) {
  const A = sharedAssets();
  const g = buildPine(opts);
  const group = new THREE.Group();
  const add = (geo, mat) => {
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(g.bark, A.bark);
  add(g.core, A.coreMat);
  const needles = add(g.needles, A.needles);
  needles.customDepthMaterial = A.needleDepth;
  add(g.snow, opts.snowMat);
  add(g.straw, A.straw);
  return group;
}

// 同じ形をたくさん並べる（背景の松）ためのインスタンス描画
export function makePineForest(variants, placements, snowMat) {
  const A = sharedAssets();
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  variants.forEach((opts, vi) => {
    const list = placements.filter((p) => p.v === vi);
    if (!list.length) return;
    const g = buildPine({ ...opts, lod: 'low' });
    const parts = [[g.bark, A.bark], [g.core, A.coreMat], [g.needles, A.needles], [g.snow, snowMat]];
    for (const [geo, mat] of parts) {
      if (!geo) continue;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => {
        qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.rot);
        sv.setScalar(p.scale);
        pv.set(p.x, p.y, p.z);
        m.compose(pv, qq, sv);
        im.setMatrixAt(i, m);
      });
      im.castShadow = false; // 遠景は影を落とさない（軽量化）
      im.receiveShadow = true;
      group.add(im);
    }
  });
  return group;
}

/** 松の形をジオメトリとして作る（form: 'garden' 庭木の松 | 'tiered' 段作りの松） */
export function buildPine({ height = 3, spread = 1.5, lean = 0.8, seed = 1, yukitsuri = false, density = 1, snowStyle = 'heavy', longBranch = false, form = 'garden', lod = 'high' }) {
  const low = lod === 'low';
  const heavy = snowStyle !== 'light';
  const tiered = form === 'tiered';
  const white = new THREE.Color(0xe4eaf2);
  const A = sharedAssets();
  const rnd = rng(seed);
  const H = height;
  const r0 = tiered ? 0.035 * H + 0.07 : 0.06 * H + 0.1;
  const flat = tiered ? 0.27 : 0.42; // 葉の層の厚み

  // ---- 幹：何度も曲がりながら傾く ----
  const turn = rnd() * Math.PI * 2;
  const lx = Math.cos(turn) * lean, lz = Math.sin(turn) * lean;
  const pts = [new THREE.Vector3(0, 0, 0)];
  const nCtl = 6;
  for (let i = 1; i <= nCtl; i++) {
    const u = i / nCtl;
    const wob = (i % 2 ? 1 : -1) * (0.12 + rnd() * 0.18) * Math.sin(u * Math.PI);
    pts.push(new THREE.Vector3(
      lx * Math.pow(u, 1.3) - Math.sin(turn) * wob,
      H * u,
      lz * Math.pow(u, 1.3) + Math.cos(turn) * wob,
    ));
  }
  const trunk = new THREE.CatmullRomCurve3(pts);
  const barkGeos = [taperTube(trunk, low ? 10 : 36, low ? 5 : 12, r0, r0 * 0.28)];
  const root = new THREE.CylinderGeometry(r0 * 0.98, r0 * 1.5, 0.22, low ? 6 : 14, 1, true);
  root.translate(0, 0.09, 0);
  barkGeos.push(root);
  const snowGeos = [], coreGeos = [];
  const fol = new Foliage();
  const col = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  // 枝の上に積もった雪の筋
  const branchSnow = (curve, rA, rB) => {
    const pts2 = curve.getSpacedPoints(10).map((p, i) => p.clone().add(new THREE.Vector3(0, (rA + (rB - rA) * (i / 10)) * 0.85, 0)));
    const k = heavy ? 1 : 0.55;
    snowGeos.push(taperTube(new THREE.CatmullRomCurve3(pts2), low ? 4 : 10, low ? 3 : 6, rA * 0.75 * k, rB * 0.6 * k, 0.55));
  };

  // ---- 葉の塊（雪をかぶる） ----
  const lump = (c, R, rot) => {
    // 暗い芯（遠景では省く）
    if (!low) coreGeos.push(placed(A.core, c.clone().add(new THREE.Vector3(0, -R * 0.05, 0)), new THREE.Vector3(R * 0.85, R * flat * 0.75, R * 0.72), rot));
    // 松葉の房：下半分と縁に多く、雪の下からのぞく
    const n = Math.max(low ? 5 : 10, Math.round(34 * density * Math.pow(R / 0.45, 2)));
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const rr = Math.pow(rnd(), 0.35);
      // 深雪：上は雪の中なので下半分と縁に。薄雪：上面にも房を並べる
      const yy = heavy ? -0.55 + rnd() * 0.9 : -0.5 + rnd() * 1.05;
      const p = new THREE.Vector3(Math.cos(a) * rr * R * 1.05, yy * R * flat, Math.sin(a) * rr * R * 0.9);
      const out = p.clone().normalize().lerp(up, (tiered ? 0.5 : 0.25) + rnd() * 0.3);
      p.add(c);
      const lightness = 0.2 + rnd() * 0.14;
      col.setHSL(0.28 + rnd() * 0.06, 0.42, lightness);
      // 縁の房はうっすら雪をかぶる
      if (heavy) { if (yy > 0.1 && rnd() < 0.5) col.lerp(white, 0.35); }
      else if (yy > -0.2 && rnd() < 0.85) col.lerp(white, 0.6 + rnd() * 0.3);
      fol.card(p, out, R * (0.55 + rnd() * 0.35), rnd() * Math.PI * 2, col);
    }
    // 雪：ふっくら丸く、縁から少しはみ出す
    if (!heavy) {
      // 薄雪：房の間に薄く載るだけ
      if (rnd() < 0.75) {
        const pos = c.clone().add(new THREE.Vector3(0, R * 0.14, 0));
        snowGeos.push(placed(low ? A.snowLow : A.snow, pos, new THREE.Vector3(R * 0.8, R * 0.13, R * 0.68), rot + rnd()));
      }
      return;
    }
    const blobs = low ? 1 : 1 + Math.floor(rnd() * 3);
    for (let b = 0; b < blobs; b++) {
      const ba = rot + b * 2.1 + rnd();
      const off = b === 0 ? 0 : R * (0.3 + rnd() * 0.25);
      const sc = b === 0 ? 1 : 0.6 + rnd() * 0.25;
      const pos = c.clone().add(new THREE.Vector3(Math.cos(ba) * off, R * (0.12 + rnd() * 0.06), Math.sin(ba) * off));
      snowGeos.push(placed(low ? A.snowLow : A.snow, pos, new THREE.Vector3(R * 1.02 * sc, R * (0.5 + rnd() * 0.15) * sc, R * 0.88 * sc), ba));
    }
  };
  const addPad = (c, R, rot) => {
    lump(c, R, rot);
    const k = low ? 2 : 2 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j++) {
      const a = rot + (j / k) * Math.PI * 2 + rnd() * 0.8;
      const d = R * (0.6 + rnd() * 0.35);
      lump(c.clone().add(new THREE.Vector3(Math.cos(a) * d, (rnd() - 0.55) * R * 0.35, Math.sin(a) * d)), R * (0.5 + rnd() * 0.22), a);
    }
  };

  // ---- 段作り：細い幹から薄く平らな層が左右交互に張り出す ----
  if (tiered) {
    const nt = 8 + Math.floor(rnd() * 4);
    for (let i = 0; i < nt; i++) {
      const t = 0.22 + (0.74 * i) / (nt - 1) + (rnd() - 0.5) * 0.04;
      const P = trunk.getPointAt(Math.min(0.97, t));
      const az = turn + (i % 2 ? Math.PI : 0) + i * 0.45 + (rnd() - 0.5) * 0.9;
      const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const L = spread * (0.55 + 0.45 * rnd()) * (1.15 - 0.6 * t);
      const curve = new THREE.CatmullRomCurve3([
        P,
        P.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3(0, -0.04, 0)).addScaledVector(side, (rnd() - 0.5) * 0.2),
        P.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, 0.05, 0)),
      ]);
      const rb = r0 * (0.42 - 0.2 * t);
      barkGeos.push(taperTube(curve, low ? 4 : 8, low ? 3 : 5, rb, 0.02));
      branchSnow(curve, rb, 0.025);
      // 枝に沿って平らな層を並べる
      const R = spread * (0.3 + 0.12 * rnd()) * (1.1 - 0.45 * t);
      for (const u of low ? [0.6, 1] : [0.45, 0.72, 1]) {
        const c = curve.getPointAt(u).add(new THREE.Vector3(0, R * 0.12, 0)).addScaledVector(side, (rnd() - 0.5) * R * 0.8);
        lump(c, R * (u === 1 ? 1 : 0.85), az + u);
      }
      // 反対側に短い層を添える
      if (!low && rnd() < 0.5) {
        const c = P.clone().addScaledVector(side, (rnd() < 0.5 ? -1 : 1) * L * 0.35).add(new THREE.Vector3(0, R * 0.1, 0));
        lump(c, R * 0.6, az + 1.5);
      }
    }
    addPad(trunk.getPointAt(1).add(new THREE.Vector3(0, 0.08 * spread, 0)), 0.3 * spread, turn);
  }

  // ---- 枝：一度下がり、先端が持ち上がって塊を支える ----
  const nb = tiered ? 0 : 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < nb; i++) {
    const t = 0.3 + (0.64 * i) / (nb - 1) + (rnd() - 0.5) * 0.05;
    const P = trunk.getPointAt(Math.min(0.96, t));
    const az = turn + i * 2.4 + (rnd() - 0.5) * 0.6;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const L = spread * (0.6 + 0.5 * rnd()) * (1.2 - 0.6 * t);
    const droop = 0.12 + rnd() * 0.15;
    const curve = new THREE.CatmullRomCurve3([
      P,
      P.clone().addScaledVector(dir, L * 0.3).add(new THREE.Vector3(0, -droop * 0.6, 0)).addScaledVector(side, (rnd() - 0.5) * 0.2),
      P.clone().addScaledVector(dir, L * 0.65).add(new THREE.Vector3(0, -droop, 0)).addScaledVector(side, (rnd() - 0.5) * 0.25),
      P.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, -droop * 0.3 + 0.12, 0)),
    ]);
    const rb = r0 * (0.5 - 0.22 * t);
    barkGeos.push(taperTube(curve, low ? 5 : 12, low ? 3 : 7, rb, 0.025));
    branchSnow(curve, rb, 0.03);
    const end = curve.getPointAt(1);
    const R = (0.36 + 0.2 * rnd()) * spread * (1.05 - 0.35 * t);
    addPad(end.clone().add(new THREE.Vector3(0, R * 0.22, 0)), R, az);
    // 先端近くで扇状に分かれる小枝と小さな塊
    const forks = low ? 1 : L > 0.7 ? 2 : 1;
    for (let f = 0; f < forks; f++) {
      const fork = curve.getPointAt(0.55 + rnd() * 0.15);
      const fa = az + (f % 2 ? 1 : -1) * (0.55 + rnd() * 0.45);
      const fdir = new THREE.Vector3(Math.cos(fa), 0, Math.sin(fa));
      const fend = fork.clone().addScaledVector(fdir, L * (0.3 + rnd() * 0.2)).add(new THREE.Vector3(0, 0.06 + rnd() * 0.12, 0));
      const fc = new THREE.CatmullRomCurve3([fork, fork.clone().lerp(fend, 0.5).add(new THREE.Vector3(0, -0.04, 0)), fend]);
      barkGeos.push(taperTube(fc, low ? 3 : 6, low ? 3 : 5, rb * 0.45, 0.015));
      lump(fend.clone().add(new THREE.Vector3(0, R * 0.18, 0)), R * (0.6 + rnd() * 0.15), fa);
    }
  }
  // 低く横へ長く伸びる枝（いくつもの塊を連ねる）
  if (longBranch) {
    const P = trunk.getPointAt(0.2);
    const az = turn + Math.PI * (0.8 + rnd() * 0.4);
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const L = spread * 2.5;
    const curve = new THREE.CatmullRomCurve3([
      P,
      P.clone().addScaledVector(dir, L * 0.3).add(new THREE.Vector3(0, -0.15, 0)).addScaledVector(side, 0.25),
      P.clone().addScaledVector(dir, L * 0.65).add(new THREE.Vector3(0, -0.28, 0)).addScaledVector(side, -0.2),
      P.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, -0.12, 0)),
    ]);
    const rb = r0 * 0.6;
    barkGeos.push(taperTube(curve, 18, 8, rb, 0.03));
    branchSnow(curve, rb, 0.035);
    for (const u of [0.42, 0.62, 0.82, 1]) {
      const c = curve.getPointAt(u);
      const R = spread * (0.32 + 0.12 * rnd()) * (1.1 - u * 0.3);
      addPad(c.add(new THREE.Vector3(0, R * 0.28, 0)).addScaledVector(side, (rnd() - 0.5) * 0.4), R, az + u * 2);
    }
  }
  // 樹冠
  if (!tiered) {
    const top = trunk.getPointAt(1);
    addPad(top.clone().add(new THREE.Vector3(0, 0.12 * spread, 0)), 0.42 * spread, turn);
  }

  const merge = (geos) => (geos.length ? (geos.length > 1 ? mergeGeometries(geos) : geos[0]) : null);
  const out = { bark: merge(barkGeos), core: merge(coreGeos), needles: fol.geometry(), snow: null, straw: null };

  if (yukitsuri) {
    // 雪吊り：幹に沿う柱の先から縄を放射状に張る
    const straw = [];
    const poleBase = new THREE.Vector3(0.08, 0, 0.08);
    const tip = new THREE.Vector3(lx * 0.9, H + 1.5 + spread * 0.5, lz * 0.9);
    straw.push(cylinderBetween(poleBase, tip, 0.035));
    const n = 24;
    const R = spread * 1.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const anchor = new THREE.Vector3(lx * 0.6 + Math.cos(a) * R, H * 0.42 + Math.sin(a * 3) * 0.15, lz * 0.6 + Math.sin(a) * R);
      straw.push(cylinderBetween(tip, anchor, 0.007));
    }
    const cap = new THREE.ConeGeometry(0.18, 0.35, 10);
    cap.translate(tip.x, tip.y + 0.12, tip.z);
    straw.push(cap);
    // こも巻き：幹の曲がりに沿わせる
    const kc = trunk.getPointAt(Math.min(0.5, 0.95 / H));
    const rk = r0 * (1 - 0.72 * Math.pow(0.95 / H, 0.75));
    const komo = new THREE.CylinderGeometry(rk * 1.12, rk * 1.16, 0.42, 14, 1, true);
    komo.translate(kc.x, kc.y, kc.z);
    straw.push(komo);
    for (const dy of [-0.15, 0.15]) {
      const band = new THREE.TorusGeometry(rk * 1.18, 0.015, 4, 16);
      band.rotateX(Math.PI / 2);
      band.translate(kc.x, kc.y + dy, kc.z);
      straw.push(band);
    }
    out.straw = merge(straw);
    // 柱の頭の雪
    snowGeos.push(placed(A.snow, tip.clone().add(new THREE.Vector3(0, 0.22, 0)), new THREE.Vector3(0.16, 0.1, 0.16)));
  }
  out.snow = merge(snowGeos);
  return out;
}
