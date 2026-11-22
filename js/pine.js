// 松（日本の庭木の黒松）：うねる幹、水平に張る枝、雲のような葉の塊、雪、雪吊り、こも巻き
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

let shared = null;
function sharedAssets() {
  if (shared) return shared;
  // 葉の塊：ゆがませて平たくした球（下側はさらに平ら）
  const pad = new THREE.SphereGeometry(1, 16, 9);
  const p = pad.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 7.1 + v.z * 3.3) * 0.5 + Math.sin(v.z * 8.7 - v.y * 5.1) * 0.5;
    v.multiplyScalar(0.88 + 0.16 * n);
    if (v.y < 0) v.y *= 0.45;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  pad.computeVertexNormals();
  // 葉の上に積もる雪（上半球を平たく）
  const snow = new THREE.SphereGeometry(1, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const s = snow.attributes.position;
  for (let i = 0; i < s.count; i++) {
    v.fromBufferAttribute(s, i);
    const n = Math.sin(v.x * 6.3 + v.z * 4.1) * 0.5 + Math.sin(v.z * 7.7) * 0.5;
    v.multiplyScalar(0.9 + 0.1 * n);
    s.setXYZ(i, v.x, v.y, v.z);
  }
  snow.computeVertexNormals();
  shared = {
    pad, snow,
    bark: new THREE.MeshStandardMaterial({ map: TX.pineBarkTexture(), roughness: 0.95 }),
    needles: new THREE.MeshStandardMaterial({ map: TX.needleTexture(), color: 0xb8d0b0, roughness: 0.9 }),
    straw: new THREE.MeshStandardMaterial({ color: 0xc4a468, roughness: 1 }),
  };
  return shared;
}

// 先細りのチューブ
function taperTube(curve, segs, radial, r0, r1) {
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * Math.pow(u, 0.8);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
function placed(geo, pos, scale, rotY = 0) {
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  sc.copy(scale);
  m4.compose(pos, q, sc);
  return geo.clone().applyMatrix4(m4);
}

function cylinderBetween(a, b, r) {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, dir.length(), 4, 1, true);
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m4.compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
  return g.applyMatrix4(m4);
}

/**
 * @param {object} o
 *  height: 幹の高さ, spread: 枝の張り, lean: 幹の傾き, seed, yukitsuri: 雪吊りの有無, snowMat
 */
export function makePine({ height = 3, spread = 1.5, lean = 0.6, seed = 1, yukitsuri = false, snowMat }) {
  const A = sharedAssets();
  const rnd = rng(seed);
  const H = height;
  const r0 = 0.06 * H + 0.1;
  const turn = rnd() * Math.PI * 2;
  const lx = Math.cos(turn) * lean, lz = Math.sin(turn) * lean;
  const trunk = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lx * 0.1 + 0.05, H * 0.22, lz * 0.1),
    new THREE.Vector3(lx * 0.55 - 0.12, H * 0.48, lz * 0.55 + 0.1),
    new THREE.Vector3(lx * 0.8 + 0.1, H * 0.75, lz * 0.8 - 0.08),
    new THREE.Vector3(lx, H, lz),
  ]);
  const barkGeos = [taperTube(trunk, 24, 10, r0, r0 * 0.25)];
  // 根張り
  const root = new THREE.CylinderGeometry(r0 * 0.98, r0 * 1.45, 0.2, 14, 1, true);
  root.translate(0, 0.08, 0);
  barkGeos.push(root);
  const padGeos = [], snowGeos = [];
  // 雲のような葉の塊：大小の楕円を寄せ集める
  const lump = (c, R, rot) => {
    padGeos.push(placed(A.pad, c, new THREE.Vector3(R * 1.2, R * 0.55, R * 1.0), rot));
    snowGeos.push(placed(A.snow, c.clone().add(new THREE.Vector3(0, R * 0.16, 0)), new THREE.Vector3(R * 1.08, R * 0.36, R * 0.9), rot));
  };
  const addPad = (c, R, rot) => {
    lump(c, R, rot);
    const k = 3 + Math.floor(rnd() * 3);
    for (let j = 0; j < k; j++) {
      const a = rot + (j / k) * Math.PI * 2 + rnd() * 0.8;
      const d = R * (0.55 + rnd() * 0.35);
      const cc = c.clone().add(new THREE.Vector3(Math.cos(a) * d, (rnd() - 0.4) * R * 0.3, Math.sin(a) * d));
      lump(cc, R * (0.5 + rnd() * 0.25), a);
    }
  };
  const nb = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < nb; i++) {
    const t = 0.26 + (0.68 * i) / (nb - 1) + (rnd() - 0.5) * 0.06;
    const P = trunk.getPointAt(Math.min(0.97, t));
    const az = turn + i * 2.4 + (rnd() - 0.5) * 0.5;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const L = spread * (0.55 + 0.55 * rnd()) * (1.15 - 0.55 * t);
    const mid = P.clone().addScaledVector(dir, L * 0.5).add(new THREE.Vector3(0, -0.04 + rnd() * 0.12, 0));
    const end = P.clone().addScaledVector(dir, L).add(new THREE.Vector3(0, 0.12 + rnd() * 0.25, 0));
    const curve = new THREE.CatmullRomCurve3([P, mid, end]);
    barkGeos.push(taperTube(curve, 8, 6, r0 * (0.55 - 0.25 * t), 0.02));
    const R = (0.34 + 0.22 * rnd()) * spread * (1.05 - 0.35 * t);
    addPad(end.clone().add(new THREE.Vector3(0, R * 0.25, 0)), R, az);
    // 途中で分かれる小枝とその先の塊
    if (L > 0.7) {
      const fork = curve.getPointAt(0.55);
      const fa = az + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.4);
      const fdir = new THREE.Vector3(Math.cos(fa), 0, Math.sin(fa));
      const fend = fork.clone().addScaledVector(fdir, L * 0.45).add(new THREE.Vector3(0, 0.1 + rnd() * 0.15, 0));
      barkGeos.push(taperTube(new THREE.CatmullRomCurve3([fork, fork.clone().lerp(fend, 0.5).add(new THREE.Vector3(0, -0.03, 0)), fend]), 6, 5, r0 * 0.22, 0.015));
      addPad(fend.add(new THREE.Vector3(0, R * 0.2, 0)), R * 0.7, fa);
    }
  }
  // 樹冠
  const top = trunk.getPointAt(1);
  const Rt = 0.45 * spread;
  addPad(top.clone().add(new THREE.Vector3(0, Rt * 0.1, 0)), Rt, turn);

  const group = new THREE.Group();
  const add = (geos, mat) => {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    geos.forEach((g) => g.dispose());
    return m;
  };
  add(barkGeos, A.bark);
  add(padGeos, A.needles);
  add(snowGeos, snowMat);

  if (yukitsuri) {
    // 雪吊り：幹に沿う柱の先から縄を放射状に張る
    const straw = [];
    const poleBase = new THREE.Vector3(0.06, 0, 0.06);
    const tip = new THREE.Vector3(lx, H + 1.4 + spread * 0.5, lz);
    straw.push(cylinderBetween(poleBase, tip, 0.035));
    const n = 22;
    const R = spread * 1.25;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const anchor = new THREE.Vector3(lx * 0.6 + Math.cos(a) * R, H * 0.45 + Math.sin(a * 3) * 0.15, lz * 0.6 + Math.sin(a) * R);
      straw.push(cylinderBetween(tip, anchor, 0.007));
    }
    // 柱の頭の飾り（わら帽子）
    const cap = new THREE.ConeGeometry(0.18, 0.35, 10);
    cap.translate(tip.x, tip.y + 0.12, tip.z);
    straw.push(cap);
    // こも巻き
    const komo = new THREE.CylinderGeometry(r0 * 1.1, r0 * 1.14, 0.42, 14, 1, true);
    komo.translate(lx * 0.04 + 0.01, 0.95, lz * 0.04);
    straw.push(komo);
    for (const y of [0.8, 1.1]) {
      const band = new THREE.TorusGeometry(r0 * 1.16, 0.015, 4, 16);
      band.rotateX(Math.PI / 2);
      band.translate(lx * 0.04 + 0.01, y, lz * 0.04);
      straw.push(band);
    }
    add(straw, A.straw);
  }
  return group;
}
