// 鐘楼（しょうろう）・梵鐘・撞木の3Dモデル
import * as THREE from 'three';

// ---- 撞木の振り子 ----
export const SWING = {
  maxAngle: 0.55, // 最大に引いた角度（rad）
  omega2: 12,     // 振り子の固有角振動数^2
  damping: 3.2,   // 打撃後の減衰
};

export class Shumoku {
  constructor() {
    this.theta = 0; // 負 = 鐘から離れる方向に引いている
    this.vel = 0;
    this.state = 'idle'; // idle | pull | swing | settle
    this.releasePower = 0;
  }
  get ready() {
    return this.state === 'idle';
  }
  // pull: 0..1 の引き量
  setPull(p, dt) {
    this.state = 'pull';
    const target = -SWING.maxAngle * p;
    this.theta += (target - this.theta) * Math.min(1, dt * 10);
    this.vel = 0;
  }
  release(power) {
    if (this.state !== 'pull') return;
    this.state = 'swing';
    this.releasePower = power;
    this.vel = 0;
  }
  // 戻り値: 鐘に当たったらその強さ、当たらなければ 0
  update(dt) {
    let hit = 0;
    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (this.state === 'swing') {
        this.vel += -SWING.omega2 * Math.sin(this.theta) * h;
        const prev = this.theta;
        this.theta += this.vel * h;
        if (prev < 0 && this.theta >= 0 && this.vel > 0) {
          this.theta = 0;
          hit = Math.max(0.02, this.releasePower);
          this.vel = -this.vel * 0.32;
          this.state = 'settle';
        }
      } else if (this.state === 'settle') {
        this.vel += (-SWING.omega2 * Math.sin(this.theta) - SWING.damping * this.vel) * h;
        this.theta += this.vel * h;
        if (this.theta > 0) { this.theta = 0; this.vel = -this.vel * 0.3; }
        if (Math.abs(this.theta) < 0.004 && Math.abs(this.vel) < 0.03) {
          this.theta = 0; this.vel = 0; this.state = 'idle';
        }
      }
    }
    return hit;
  }
}

// ---- 屋根（寄棟、反りと軒先の反り上がり付き） ----
export function makeRoofGeometry({ ax, az, rh, yE, yR, up = 0.3, nu = 24, nv = 14, yOff = 0, vStart = 0, inset = 0 }) {
  const positions = [], uvs = [], indices = [];
  const faces = [
    { e0: [-ax, az], e1: [ax, az], r0: [-rh, 0], r1: [rh, 0], len: ax * 2 },
    { e0: [ax, az], e1: [ax, -az], r0: [rh, 0], r1: [rh, 0], len: az * 2 },
    { e0: [ax, -az], e1: [-ax, -az], r0: [rh, 0], r1: [-rh, 0], len: ax * 2 },
    { e0: [-ax, -az], e1: [-ax, az], r0: [-rh, 0], r1: [-rh, 0], len: az * 2 },
  ];
  let base = 0;
  for (const f of faces) {
    for (let j = 0; j <= nv; j++) {
      const v = vStart + (1 - vStart) * (j / nv);
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const k = Math.pow(Math.abs(2 * u - 1), 3);
        const spread = 1 + 0.05 * k - inset;
        const ex = (f.e0[0] + (f.e1[0] - f.e0[0]) * u) * spread;
        const ez = (f.e0[1] + (f.e1[1] - f.e0[1]) * u) * spread;
        const rx = f.r0[0] + (f.r1[0] - f.r0[0]) * u;
        const rz = f.r0[1] + (f.r1[1] - f.r0[1]) * u;
        const ey = yE + up * k;
        const x = ex + (rx - ex) * v;
        const z = ez + (rz - ez) * v;
        const y = ey + (yR - ey) * Math.pow(v, 1.55) + yOff;
        positions.push(x, y, z);
        uvs.push(u * f.len * 0.9, v * 4);
      }
    }
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * (nu + 1) + i;
        const b = a + 1, c = a + (nu + 1), d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    base += (nu + 1) * (nv + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// 屋根一式（瓦・雪・裏板・棟）
export function makeRoof(mats, opts) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(makeRoofGeometry(opts), mats.roof);
  top.castShadow = true; top.receiveShadow = true;
  group.add(top);
  const under = new THREE.Mesh(makeRoofGeometry({ ...opts, yOff: -0.22 }), mats.darkWood);
  under.material.side = THREE.DoubleSide;
  group.add(under);
  const snow = new THREE.Mesh(makeRoofGeometry({ ...opts, yOff: 0.07, vStart: 0.12, inset: 0.015 }), mats.snow);
  snow.receiveShadow = true; snow.castShadow = true;
  group.add(snow);
  // 軒先の鼻隠し
  const fasciaPts = [];
  const { ax, az, yE, up = 0.3 } = opts;
  const N = 40;
  const corners = [[-ax, az], [ax, az], [ax, -az], [-ax, -az], [-ax, az]];
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < N; i++) {
      const u = i / N;
      const k = Math.pow(Math.abs(2 * u - 1), 3);
      const sp = 1 + 0.05 * k;
      const x = (corners[s][0] + (corners[s + 1][0] - corners[s][0]) * u) * sp;
      const z = (corners[s][1] + (corners[s + 1][1] - corners[s][1]) * u) * sp;
      fasciaPts.push(new THREE.Vector3(x, yE + up * k - 0.1, z));
    }
  }
  fasciaPts.push(fasciaPts[0].clone());
  const curve = new THREE.CatmullRomCurve3(fasciaPts, true);
  const fascia = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.12, 4, true), mats.darkWood);
  group.add(fascia);
  // 棟
  const ridgeLen = opts.rh * 2 + 0.4;
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(ridgeLen, 0.32, 0.36), mats.roofDark);
  ridge.position.y = opts.yR + 0.12;
  ridge.castShadow = true;
  group.add(ridge);
  const ridgeSnow = new THREE.Mesh(new THREE.BoxGeometry(ridgeLen - 0.1, 0.08, 0.4), mats.snow);
  ridgeSnow.position.y = opts.yR + 0.31;
  group.add(ridgeSnow);
  for (const sx of [-1, 1]) {
    const oni = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.5), mats.roofDark);
    oni.position.set(sx * (ridgeLen / 2), opts.yR + 0.3, 0);
    group.add(oni);
  }
  return group;
}

// ---- 梵鐘 ----
// 外形プロファイル（鐘の下端を y=0 とする、単位 m）
const OUTER = [
  [0.0, 1.5], [0.2, 1.5], [0.3, 1.48], [0.36, 1.44], [0.39, 1.38], [0.4, 1.3],
  [0.405, 1.0], [0.415, 0.6], [0.43, 0.25], [0.445, 0.1], [0.46, 0.03], [0.46, 0.0],
];
const INNER = [[0.4, 0.0], [0.39, 0.08], [0.375, 0.4], [0.365, 1.0], [0.35, 1.32], [0.25, 1.42], [0.0, 1.43]];

export function outerR(y) {
  for (let i = OUTER.length - 1; i > 0; i--) {
    const [r0, y0] = OUTER[i - 1], [r1, y1] = OUTER[i];
    if (y <= y0 && y >= y1) {
      const t = (y - y1) / (y0 - y1 || 1);
      return r1 + (r0 - r1) * t;
    }
  }
  return 0.4;
}

export const STRIKE_Y = 0.45; // 撞座の高さ（鐘の下端から）

export function makeBell(mats, { detail = true } = {}) {
  const bell = new THREE.Group();
  // 内側（上→下）から外側（下→上）へ一筆書きのプロファイル
  const ordered = [...INNER.slice().reverse(), ...OUTER.slice().reverse()].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(ordered, detail ? 96 : 32), mats.bronze);
  body.castShadow = true; body.receiveShadow = true;
  bell.add(body);

  const bandMat = mats.bronzeBand;
  // 横帯
  const hBands = detail ? [1.33, 1.03, 0.47, 0.43, 0.2, 0.08] : [1.33, 0.45, 0.14];
  for (const y of hBands) {
    const r = outerR(y) + 0.008;
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, detail ? 96 : 32), bandMat);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    bell.add(t);
  }
  // 下帯（幅広）
  if (detail) {
    const pts = [];
    for (let y = 0.08; y <= 0.2001; y += 0.03) pts.push(new THREE.Vector2(outerR(y) + 0.006, y));
    const lb = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), bandMat);
    bell.add(lb);
  }
  // 縦帯（細いレーススライス）: 撞座と重ならない 45° の位置
  const vAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
  for (const a of vAngles) {
    for (const off of detail ? [-0.05, 0.05] : [0]) {
      const pts = [];
      for (let y = 0.47; y <= 1.3301; y += 0.06) pts.push(new THREE.Vector2(outerR(y) + 0.009, y));
      const g = new THREE.LatheGeometry(pts, 2, a + off - 0.012, 0.024);
      bell.add(new THREE.Mesh(g, bandMat));
    }
  }
  // 乳（ち）: 4区画 × 3段 × 9列 = 108 個
  if (detail) {
    const nipple = new THREE.SphereGeometry(0.019, 10, 8);
    const inst = new THREE.InstancedMesh(nipple, bandMat, 108);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let q = 0; q < 4; q++) {
      const a0 = vAngles[q] + 0.12;
      const a1 = vAngles[q] + Math.PI / 2 - 0.12;
      for (let row = 0; row < 3; row++) {
        const y = 1.09 + row * 0.08;
        const r = outerR(y) + 0.008;
        for (let col = 0; col < 9; col++) {
          const a = a0 + (a1 - a0) * (col / 8);
          m.makeScale(1, 1, 0.7);
          const rot = new THREE.Matrix4().makeRotationY(a);
          m.premultiply(rot);
          m.setPosition(Math.sin(a) * r, y, Math.cos(a) * r);
          inst.setMatrixAt(n++, m);
        }
      }
    }
    inst.castShadow = true;
    bell.add(inst);
  }
  // 撞座（つきざ）: 蓮華の円座、±X 方向
  for (const sx of [-1, 1]) {
    const seat = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, detail ? 32 : 12), bandMat);
    disc.rotation.z = Math.PI / 2;
    seat.add(disc);
    if (detail) {
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), bandMat);
      center.scale.set(0.6, 1, 1);
      center.position.x = sx * 0.015;
      seat.add(center);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), bandMat);
        petal.scale.set(0.4, 1, 0.6);
        petal.position.set(sx * 0.012, Math.sin(a) * 0.05, Math.cos(a) * 0.05);
        seat.add(petal);
      }
    }
    seat.position.set(sx * (outerR(STRIKE_Y) + 0.005), STRIKE_Y, 0);
    bell.add(seat);
  }
  // 竜頭（りゅうず）
  const ryuzu = new THREE.Group();
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.04, 10, 24), bandMat);
  loop.position.y = 1.62;
  ryuzu.add(loop);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.08, 16), bandMat);
  base.position.y = 1.53;
  ryuzu.add(base);
  if (detail) {
    for (const sx of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), bandMat);
      head.scale.set(1.4, 0.8, 0.8);
      head.position.set(sx * 0.12, 1.58, 0);
      ryuzu.add(head);
    }
    const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), bandMat);
    jewel.position.y = 1.76;
    ryuzu.add(jewel);
  }
  bell.add(ryuzu);
  return bell;
}

// ---- 鐘楼一式 ----
// 原点 = 地面中央。鐘は x=0,z=0 に吊られ、撞木は -X 側から打つ。
// ---- 和尚（遠くの寺で鐘をつく人） ----
// 鐘楼のローカル座標で、引き綱を握る手の位置に合わせて体と腕を動かす
function makeMonk(mats, S = 1.3) {
  const robe = mats.robe || new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.95 });
  const kesa = mats.kesa || new THREE.MeshStandardMaterial({ color: 0xb07a22, roughness: 0.8 });
  const skin = mats.skin || new THREE.MeshStandardMaterial({ color: 0xd8b08a, roughness: 0.7 });
  const body = new THREE.Group(); // 足元が原点、+X（鐘の方）を向く
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    body.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.2, 0.34, 1.05, 14), robe, 0, 0.53, 0);     // 裾の広い法衣
  add(new THREE.CylinderGeometry(0.17, 0.21, 0.42, 14), robe, 0, 1.25, 0);     // 胴
  add(new THREE.CylinderGeometry(0.215, 0.255, 0.55, 14, 1, true, Math.PI * 0.15, Math.PI * 0.9), kesa, 0, 1.12, 0); // 袈裟
  add(new THREE.BoxGeometry(0.05, 0.62, 0.05), kesa, 0.02, 1.2, 0.0, 0.62, 0, 0); // 肩からの袈裟の帯
  add(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), skin, 0, 1.49, 0);     // 首
  add(new THREE.SphereGeometry(0.105, 16, 12), skin, 0.01, 1.62, 0);           // 剃髪の頭
  add(new THREE.SphereGeometry(0.03, 8, 6), skin, 0.0, 1.6, 0.1);              // 耳
  add(new THREE.SphereGeometry(0.03, 8, 6), skin, 0.0, 1.6, -0.1);
  for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.22, 0.06, 0.1), mats.darkWood || robe, 0.04, 0.03, sz * 0.1); // 草履
  body.scale.setScalar(S); // 遠くからでも動きが分かるよう少し大きめ
  const group = new THREE.Group();
  group.add(body);
  // 腕（袖）は鐘楼ローカルで毎フレーム置き直す
  const armGeo = new THREE.CylinderGeometry(0.05, 0.075, 1, 8);
  const handGeo = new THREE.SphereGeometry(0.04, 8, 6);
  const arms = [0, 1].map(() => {
    const a = new THREE.Mesh(armGeo, robe);
    a.castShadow = true;
    const h = new THREE.Mesh(handGeo, skin);
    return { a, h };
  });
  const up = new THREE.Vector3(0, 1, 0);
  const sh = new THREE.Vector3(), hd = new THREE.Vector3(), dir = new THREE.Vector3();
  function update(hand, pull) {
    // 引くほど後ろ（-X）へ体重をかけ、半歩下がる
    const lean = 0.08 + pull * 0.32;
    const footX = hand.x - 0.5 * S - pull * 0.12;
    group.position.set(footX, 0, hand.z);
    body.rotation.z = lean;
    const cs = Math.cos(lean), sn = Math.sin(lean);
    [-1, 1].forEach((side, i) => {
      // 肩（体の傾きを反映）
      const lx = 0.02 * S, ly = 1.42 * S;
      sh.set(footX + lx * cs - ly * sn, lx * sn + ly * cs, hand.z + side * 0.17 * S);
      // 手：綱の上で前後に並べて握る
      hd.set(hand.x - (i ? 0.13 : 0), hand.y - (i ? 0.03 : 0), hand.z + side * 0.05);
      const { a, h } = arms[i];
      dir.copy(hd).sub(sh);
      const len = dir.length();
      a.position.copy(sh).addScaledVector(dir, 0.5);
      a.scale.set(S, len, S);
      a.quaternion.setFromUnitVectors(up, dir.normalize());
      h.position.copy(hd);
      h.scale.setScalar(S);
    });
  }
  return { group, parts: arms.flatMap(({ a, h }) => [a, h]), update };
}

export function makeShoro(mats, { detail = true, monk = false } = {}) {
  const root = new THREE.Group();
  const PX = 2.2, PZ = 1.7;
  const PLAT = 0.5, TOP = 4.35;

  // 基壇
  const plat = new THREE.Mesh(new THREE.BoxGeometry(PX * 2 + 1.4, PLAT, PZ * 2 + 1.4), mats.stone);
  plat.position.y = PLAT / 2;
  plat.receiveShadow = true; plat.castShadow = true;
  root.add(plat);
  const platSnow = new THREE.Mesh(new THREE.BoxGeometry(PX * 2 + 1.3, 0.04, PZ * 2 + 1.3), mats.snow);
  platSnow.position.y = PLAT + 0.02;
  platSnow.receiveShadow = true;
  root.add(platSnow);
  if (detail) {
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.8, PLAT / 3, 0.4), mats.stone);
      step.position.set(0, (PLAT / 3) * (i + 0.5), PZ + 0.7 + 0.4 * (2 - i) + 0.2);
      step.receiveShadow = true;
      root.add(step);
    }
  }

  // 柱
  const pillarGeo = new THREE.CylinderGeometry(0.13, 0.15, TOP - PLAT, 14);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(pillarGeo, mats.wood);
    p.position.set(sx * PX, PLAT + (TOP - PLAT) / 2, sz * PZ);
    p.castShadow = true; p.receiveShadow = true;
    root.add(p);
    const fdn = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.16, 12), mats.stone);
    fdn.position.set(sx * PX, PLAT + 0.08, sz * PZ);
    root.add(fdn);
  }
  const beam = (len, along, x, y, z, h = 0.28, w = 0.22) => {
    const g = along === 'x' ? new THREE.BoxGeometry(len, h, w) : new THREE.BoxGeometry(w, h, len);
    const b = new THREE.Mesh(g, mats.wood);
    b.position.set(x, y, z);
    b.castShadow = true; b.receiveShadow = true;
    root.add(b);
    return b;
  };
  // 頭貫・桁
  for (const sz of [-1, 1]) beam(PX * 2 + 0.6, 'x', 0, TOP - 0.15, sz * PZ);
  for (const sx of [-1, 1]) beam(PZ * 2 + 0.6, 'z', sx * PX, TOP - 0.15, 0);
  for (const sz of [-1, 1]) beam(PX * 2 + 1.6, 'x', 0, TOP + 0.15, sz * (PZ + 0.25), 0.2, 0.18);
  // 鐘を吊る大梁
  beam(PX * 2 + 0.4, 'x', 0, TOP + 0.05, 0, 0.36, 0.3);
  // 貫（中段・腰）
  // 前後の中段の貫は設けない（奥の景色・遠くの寺が見通せるように）
  for (const sx of [-1, 1]) beam(PZ * 2, 'z', sx * PX, 3.3, 0, 0.18, 0.12);
  for (const sz of [-1, 1]) beam(PX * 2, 'x', 0, 1.15, sz * PZ, 0.16, 0.12);
  beam(PZ * 2, 'z', PX, 1.15, 0, 0.16, 0.12);
  // 組物（斗栱）
  if (detail) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), mats.wood);
      b.position.set(sx * PX, TOP + 0.02, sz * PZ);
      root.add(b);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.2), mats.wood);
      b2.position.set(sx * PX, TOP + 0.2, sz * PZ);
      root.add(b2);
    }
  }

  // 屋根
  const roof = makeRoof(mats, { ax: 3.3, az: 2.8, rh: 1.3, yE: 4.55, yR: 6.1, up: 0.32, nu: detail ? 28 : 12, nv: detail ? 14 : 6 });
  root.add(roof);

  // 鐘（ピボット = 吊り金具の上端）
  const HOOK_Y = TOP - 0.13;
  const BELL_BASE = 1.6;
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, HOOK_Y, 0);
  root.add(bellPivot);
  const bell = makeBell(mats, { detail });
  bell.position.y = BELL_BASE - HOOK_Y;
  bellPivot.add(bell);
  // 吊り金具（鎖）
  const chainTop = HOOK_Y, chainBot = BELL_BASE + 1.62 + 0.1;
  const nLinks = detail ? 5 : 2;
  for (let i = 0; i < nLinks; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), mats.iron);
    t.position.y = chainBot - HOOK_Y + ((chainTop - chainBot) * (i + 0.5)) / nLinks;
    if (i % 2) t.rotation.y = Math.PI / 2;
    t.scale.y = 1.4;
    bellPivot.add(t);
  }

  // 撞木
  const strikeWorldY = BELL_BASE + STRIKE_Y;
  const strikeX = -(outerR(STRIKE_Y) + 0.035);
  const LOG_LEN = 1.6, LOG_R = 0.11;
  const ROPE_TOP = TOP - 0.1;
  const ROPE_L = ROPE_TOP - strikeWorldY;
  const logRestX = strikeX - LOG_LEN / 2;
  const attach = [-0.45, 0.45];
  const log = new THREE.Group();
  const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(LOG_R, LOG_R, LOG_LEN, 18), mats.logWood);
  logMesh.rotation.z = Math.PI / 2;
  logMesh.castShadow = true;
  log.add(logMesh);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(LOG_R + 0.01, LOG_R + 0.01, 0.06, 18), mats.iron);
    cap.rotation.z = Math.PI / 2;
    cap.position.x = sx * (LOG_LEN / 2 - 0.12);
    log.add(cap);
  }
  root.add(log);
  const ropeMat = mats.rope;
  const ropes = attach.map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), ropeMat);
    root.add(m);
    return m;
  });
  // 引き綱
  const pullRope = new THREE.Mesh(new THREE.BufferGeometry(), ropeMat);
  pullRope.castShadow = true;
  root.add(pullRope);
  const handRest = new THREE.Vector3(logRestX - LOG_LEN / 2 - 1.6, 1.25, 0.45);
  let monkFig = null;
  if (monk) {
    monkFig = makeMonk(mats);
    root.add(monkFig.group, ...monkFig.parts);
  }

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function setLogAngle(theta, pull = 0) {
    const dx = ROPE_L * Math.sin(theta);
    const dy = ROPE_L * (1 - Math.cos(theta));
    log.position.set(logRestX + dx, strikeWorldY + dy, 0);
    attach.forEach((ax, i) => {
      tmpA.set(logRestX + ax, ROPE_TOP, 0);
      tmpB.set(log.position.x + ax, log.position.y + LOG_R * 0.6, 0);
      const r = ropes[i];
      r.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
      r.scale.set(1, tmpA.distanceTo(tmpB), 1);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmpB.clone().sub(tmpA).normalize());
    });
    if (pullRope) {
      const end = new THREE.Vector3(log.position.x - LOG_LEN / 2 + 0.05, log.position.y, 0);
      const hand = handRest.clone().add(new THREE.Vector3(dx * 0.55 - 0.4 * pull, 0.15 * pull, 0));
      const sag = 0.55 * (1 - Math.min(1, pull * 1.4)) + 0.05;
      const mid = end.clone().lerp(hand, 0.5);
      mid.y -= sag;
      const tail = hand.clone().add(new THREE.Vector3(-0.15, -0.9, 0.1));
      const curve = new THREE.CatmullRomCurve3([end, end.clone().lerp(mid, 0.5).setY(end.y - sag * 0.6), mid, hand, tail]);
      pullRope.geometry.dispose();
      pullRope.geometry = new THREE.TubeGeometry(curve, detail ? 40 : 16, 0.022, detail ? 6 : 4, false);
      if (monkFig) monkFig.update(hand, pull);
    }
  }
  setLogAngle(0);

  return {
    root, bellPivot, bell, log, setLogAngle, monk: monkFig,
    strikePoint: new THREE.Vector3(strikeX, strikeWorldY, 0),
    bellCenter: new THREE.Vector3(0, BELL_BASE + 0.8, 0),
    ropeLength: ROPE_L,
  };
}
