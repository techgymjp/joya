// 3D世界：大晦日の雪の境内、鐘楼、篝火、遠くの寺々
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as TX from './textures.js';
import { makeShoro, makeRoof, Shumoku, SWING, mergeStatic, outlineMaterial, addOutline } from './shoro.js';
import { Bonfire } from './fire.js';
import { makePine, makePineForest } from './pine.js';
import { Q } from './quality.js';

// ---- 地形 ----
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, y * f); a *= 0.5; f *= 2; }
  return s;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// ---- 望遠カメラ ----
// 鐘楼の左前、約42m離れた位置から望遠で撮る。望遠の圧縮効果で、遠くの寺も小さくなりすぎない。
const TELE_DIR = new THREE.Vector2(-8, 12).normalize(); // 鐘楼から見たカメラの方向
const TELE_DIST = 42;
export const CAM = { x: TELE_DIR.x * TELE_DIST, y: 3.4, z: TELE_DIR.y * TELE_DIST };
const FWD_DEG = Math.atan2(-TELE_DIR.x, TELE_DIR.y) * 180 / Math.PI; // カメラ→鐘楼の方位（-Z から右回り）
// 鐘楼を基準にした相対方位（右が正）と距離から位置を求める
const fromCam = (rel, d) => {
  const a = (FWD_DEG + rel) * Math.PI / 180;
  return [CAM.x + Math.sin(a) * d, CAM.z - Math.cos(a) * d];
};
// カメラから見た方向（相対方位・仰角）の単位ベクトル
export function camDir(rel, el) {
  const a = (FWD_DEG + rel) * Math.PI / 180, e = el * Math.PI / 180;
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

// カメラ→鐘楼の線の周りは地形をならす
function corridorMask(x, z) {
  const ax = CAM.x, az = CAM.z;
  const vx = -ax, vz = -az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  const d = Math.hypot(x - (ax + vx * t), z - (az + vz * t));
  return smooth(7, 18, d);
}

function baseHeight(x, z) {
  const r = Math.hypot(x, z + 4);
  const hills = fbm(x * 0.03 + 3, z * 0.03 + 7) * 16 - 3;
  return Math.max(0, hills) * smooth(12, 34, r) * 0.7 * corridorMask(x, z) + smooth(60, 200, r) * 10;
}

// 遠くの寺：鐘楼から見た相対方位・カメラからの距離・土台の仰角（度）
function templeAt(rel, d, el) {
  const pos = fromCam(rel, d);
  const want = CAM.y + Math.tan(el * Math.PI / 180) * d;
  return { pos, hill: want - baseHeight(pos[0], pos[1]) };
}
export const TEMPLE_DEFS = [
  { name: '西の寺', ...templeAt(-9.5, 100, 2.6), period: 8.6, pitch: 1.22, pan: -0.6, vol: 0.45, join: 0 },
  { name: '北の寺', ...templeAt(-3.5, 165, 4.6), period: 11.2, pitch: 1.05, pan: -0.15, vol: 0.38, join: 2 },
  { name: '東の寺', ...templeAt(7.6, 130, 4.0), period: 9.7, pitch: 1.4, pan: 0.2, vol: 0.42, join: 1 },
];

// 木（位置・高さ・横幅の半分）がカメラから見て遠くの寺に重なるか（方角と高さの両方で判定）
const TEMPLE_SCALE = 1.875;
const MAIN_SCALE = 1.12; // 自分の鐘楼の大きさ
export function occludesTemple(x, z, top, radius) {
  const dx = x - CAM.x, dz = z - CAM.z;
  const d = Math.hypot(dx, dz);
  const az = Math.atan2(dx, -dz);
  const topEl = Math.atan2(top - CAM.y, d);
  for (const def of TEMPLE_DEFS) {
    const [tx, tz] = def.pos;
    const dT = Math.hypot(tx - CAM.x, tz - CAM.z);
    if (dT <= d + 2) continue; // 寺より奥の木は隠さない
    const gy = groundHeight(tx, tz);
    const baseEl = Math.atan2(gy - CAM.y, dT);
    if (topEl < baseEl) continue; // 木のてっぺんが寺の土台より下に見えるなら隠さない
    const azT = Math.atan2(tx - CAM.x, -(tz - CAM.z));
    let da = Math.abs(az - azT);
    if (da > Math.PI) da = 2 * Math.PI - da;
    if (da < Math.atan2(7.7, dT) + Math.atan2(radius, d)) return true; // 寺の横幅の半分 約7.7m
  }
  return false;
}
// 画面の右方向（カメラから見て）
const RIGHT = (() => { const a = FWD_DEG * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; })();

export function groundHeight(x, z) {
  let h = baseHeight(x, z);
  for (const d of TEMPLE_DEFS) {
    const dd = (x - d.pos[0]) ** 2 + (z - d.pos[1]) ** 2;
    h += d.hill * Math.exp(-dd / 500);
  }
  return h;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Q.pixelRatio);
    renderer.shadowMap.enabled = Q.shadows;
    renderer.shadowMap.type = Q.softShadow ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // 軽量モードでは影を毎フレーム計算しない（景色はほとんど動かない）
    renderer.shadowMap.autoUpdate = Q.bloom;
    this._shadowT = 1;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1226, 0.0045);
    scene.background = new THREE.Color(0x070b18);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    this.camBase = new THREE.Vector3();
    this.camTarget = new THREE.Vector3();
    this.shake = 0;

    this.mats = this.makeMaterials();
    this.makeEnvironment();
    this.makeSky();
    this.makeLights();
    this.makeGround();
    this.makeMountains();

    // 主役の鐘楼
    // 自分の鐘楼：鐘を大きめにし、和尚が綱を引く
    this.shoro = makeShoro(this.mats, { detail: true, monk: true, bellScale: 1.35 });
    this.shoro.root.scale.setScalar(MAIN_SCALE);
    this.shoro.strikePoint.multiplyScalar(MAIN_SCALE);
    this.shoro.bellCenter.multiplyScalar(MAIN_SCALE);
    scene.add(this.shoro.root);
    this.shumoku = new Shumoku();
    this.bellSwing = { a: 0, v: 0, buzz: 0 };

    this.fires = [];
    this.addFire(-6.2, -1.6, 1); // 和尚の背後から照らす
    this.addFire(4.6, 1.6, 1);
    this.addLanterns();
    this.makeHall();
    this.makeTrees();
    this.makePines();
    this.makeTemples();
    this.makeSnow();
    this.rings = [];
    this.ringTex = TX.ringTexture();

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, this.camera));
    if (Q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  makeMaterials() {
    const wood = TX.woodTexture('#4a2618', 1);
    wood.repeat.set(1, 2);
    const darkWood = TX.woodTexture('#2b1810', 2);
    const logWood = TX.woodTexture('#8a6a48', 3);
    const bronze = TX.bronzeTexture();
    return {
      wood: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85, color: 0xffffff }),
      darkWood: new THREE.MeshStandardMaterial({ map: darkWood, roughness: 0.9 }),
      logWood: new THREE.MeshStandardMaterial({ map: logWood, roughness: 0.8 }),
      roof: new THREE.MeshStandardMaterial({ map: TX.roofTexture(), roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }),
      roofDark: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6 }),
      snow: new THREE.MeshStandardMaterial({ map: TX.snowTexture(4, [3, 3]), roughness: 0.92, color: 0xf2f6ff }),
      stone: new THREE.MeshStandardMaterial({ map: TX.stoneTexture(), roughness: 0.95 }),
      bronze: new THREE.MeshStandardMaterial({ map: bronze, color: 0xc8b089, metalness: 0.8, roughness: 0.42 }),
      bronzeBand: new THREE.MeshStandardMaterial({ map: bronze, color: 0xd8bf95, metalness: 0.85, roughness: 0.35 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x1d1b1a, metalness: 0.7, roughness: 0.6 }),
      rope: new THREE.MeshStandardMaterial({ color: 0xc9b07a, roughness: 1 }),
      ember: new THREE.MeshStandardMaterial({ color: 0x1a0e08, emissive: 0xff5a10, emissiveMap: TX.emberTexture(), emissiveIntensity: 1.6, roughness: 1 }),
      silhouette: new THREE.MeshStandardMaterial({ color: 0x1b1f2b, roughness: 1 }),
      robe: new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 0.95 }),
      kesa: new THREE.MeshStandardMaterial({ color: 0xb8801f, roughness: 0.75 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xd9b08a, roughness: 0.7 }),
    };
  }

  // 金属の映り込み用の環境マップ（夜空と暖かい灯り）
  makeEnvironment() {
    const env = new THREE.Scene();
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 top = vec3(0.04,0.06,0.14); vec3 hor = vec3(0.16,0.17,0.25); vec3 gnd = vec3(0.35,0.37,0.42); vec3 c = h > 0.0 ? mix(hor, top, h) : mix(hor, gnd, -h*2.0); gl_FragColor = vec4(c,1.0); }',
      }),
    );
    env.add(sky);
    const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.8, 0.6) });
    for (const [x, z] of [[-6, 4], [6, 5], [0, 8]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), warm);
      b.position.set(x, 0.5, z);
      env.add(b);
    }
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.4) }));
    moon.position.set(-4, 6, -5);
    env.add(moon);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
  }

  makeSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uDawn: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform float uDawn; varying vec3 vP;
          void main(){
            float h = normalize(vP).y;
            vec3 top = vec3(0.012,0.02,0.06);
            vec3 hor = vec3(0.07,0.09,0.17);
            vec3 c = mix(hor, top, smoothstep(-0.02, 0.5, h));
            c += vec3(0.25,0.12,0.18) * uDawn * (1.0 - smoothstep(0.0, 0.35, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    this.skyMat = sky.material;
    this.scene.add(sky);
    // 星
    const n = 2500;
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.03;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 500;
      pos[i * 3 + 1] = Math.cos(ph) * 500;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 500;
      sizes[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.starMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
      vertexShader: `attribute float aSize; uniform float uTime; uniform float uPx; varying float vA;
        void main(){ vA = 0.4 + 0.6*abs(sin(uTime*0.8 + aSize*50.0)); vA *= 0.3 + aSize*0.7;
          gl_PointSize = (1.0 + aSize*2.2) * uPx; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; gl_FragColor = vec4(vec3(0.85,0.9,1.0), vA*smoothstep(1.0,0.0,d)); }`,
      transparent: true, depthWrite: false, fog: false,
    });
    this.scene.add(new THREE.Points(g, this.starMat));
    // 月
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.moonTexture(), fog: false, depthWrite: false, transparent: true }));
    moon.position.set(CAM.x, CAM.y, CAM.z).addScaledVector(camDir(6, 9), 420);
    moon.scale.set(24, 24, 1);
    this.scene.add(moon);
  }

  makeLights() {
    this.scene.add(new THREE.HemisphereLight(0x5a6e9a, 0x2a2a35, 0.55));
    const moon = new THREE.DirectionalLight(0xa8bce8, 1.1);
    moon.position.set(-12, 18, -8);
    moon.target.position.set(0, 1, 0);
    moon.castShadow = true;
    moon.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
    const sc = moon.shadow.camera;
    sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.03;
    this.scene.add(moon, moon.target);
    this.moonLight = moon;
    // 鐘楼内部を照らす吊り提灯の灯り
    if (Q.extraLights) {
      const inner = new THREE.PointLight(0xffb070, 3.5, 7, 1.5);
      inner.position.set(-1.2, 3.6, 1.2);
      this.scene.add(inner);
    }
  }

  makeGround() {
    const size = 420, seg = Q.groundSeg;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const tex = TX.snowTexture(11, [100, 100]);
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: 0xdfe6f2 }));
    ground.receiveShadow = true;
    this.scene.add(ground);
    // 参道の石畳
    const pathMat = new THREE.MeshStandardMaterial({ map: TX.stoneTexture(21, [1, 6]), roughness: 0.9, color: 0x9a9a9a });
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 16), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.02, 11);
    path.receiveShadow = true;
    this.scene.add(path);
  }

  makeMountains() {
    const segs = 160;
    const pos = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const h = 18 + fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + 10) * 55;
      for (const [r, y] of [[190, 8], [260, h + 10], [330, h * 0.7]]) pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = a + 3;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8c96b0, roughness: 1, side: THREE.DoubleSide }));
    this.scene.add(m);
  }

  addFire(x, z, scale, light = true) {
    const f = new Bonfire(this.mats, { scale, light });
    f.group.position.set(x, groundHeight(x, z), z);
    this.scene.add(f.group);
    this.fires.push(f);
    return f;
  }

  addLanterns() {
    // 鐘楼の軒の吊り提灯
    const glow = TX.glowTexture('255,170,90');
    const paper = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff7a2a, emissiveIntensity: 2.2, roughness: 0.8 });
    for (const [x, z] of [[-2.2, 1.95], [2.2, 1.95]]) {
      const l = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), paper);
      body.scale.y = 1.35;
      l.add(body);
      for (const y of [-0.3, 0.3]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), this.mats.iron);
        cap.position.y = y;
        l.add(cap);
      }
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      halo.scale.set(1.6, 1.6, 1);
      l.add(halo);
      l.position.set(x, 3.75, z);
      this.scene.add(l);
    }
    // 石灯籠
    const stone = this.mats.stone;
    const win = new THREE.MeshStandardMaterial({ color: 0x110800, emissive: 0xffa040, emissiveIntensity: 2.5 });
    for (const [x, z] of [[-1.6, 8.5], [1.6, 8.5], [-1.6, 13], [1.6, 13]]) {
      const g = new THREE.Group();
      const parts = [
        [new THREE.CylinderGeometry(0.32, 0.38, 0.2, 6), 0.1],
        [new THREE.CylinderGeometry(0.1, 0.12, 0.8, 12), 0.6],
        [new THREE.CylinderGeometry(0.3, 0.22, 0.14, 6), 1.07],
      ];
      for (const [geo, y] of parts) { const m = new THREE.Mesh(geo, stone); m.position.y = y; m.castShadow = true; g.add(m); }
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), win);
      box.position.y = 1.29;
      g.add(box);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 6), stone);
      roof.position.y = 1.59;
      roof.castShadow = true;
      g.add(roof);
      const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.18, 6), this.mats.snow);
      snowCap.position.y = 1.7;
      g.add(snowCap);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), stone);
      knob.position.y = 1.82;
      g.add(knob);
      if (Q.extraLights) {
        const pl = new THREE.PointLight(0xffa050, 1.2, 4, 1.8);
        pl.position.y = 1.29;
        g.add(pl);
      }
      g.position.set(x, 0, z);
      mergeStatic(g);
      this.scene.add(g);
    }
  }

  makeHall() {
    // 本堂（左奥）
    const hall = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.BoxGeometry(15, 0.9, 11), this.mats.stone);
    plat.position.y = 0.45;
    plat.receiveShadow = true;
    hall.add(plat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 4.6, 8.4), this.mats.darkWood);
    body.position.y = 0.9 + 2.3;
    body.castShadow = true; body.receiveShadow = true;
    hall.add(body);
    const shoji = new THREE.MeshStandardMaterial({ map: TX.shojiTexture(), emissive: 0xffa555, emissiveMap: TX.shojiTexture(), emissiveIntensity: 0.9, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.8), shoji);
      s.position.set(-4.4 + i * 2.2, 0.9 + 1.6, 4.22);
      hall.add(s);
    }
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 4.6, 12), this.mats.wood);
      p.position.set(-5.5 + i * 2.2, 0.9 + 2.3, 5.2);
      p.castShadow = true;
      hall.add(p);
    }
    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.15, 1.6), this.mats.darkWood);
    porchFloor.position.set(0, 1.2, 4.9);
    hall.add(porchFloor);
    const roof = makeRoof(this.mats, { ax: 8.4, az: 6.6, rh: 3.8, yE: 5.6, yR: 9.6, up: 0.55, nu: 28, nv: 14 });
    hall.add(roof);
    if (Q.extraLights) {
      const pl = new THREE.PointLight(0xffa860, 6, 16, 1.4);
      pl.position.set(0, 2.5, 6.5);
      hall.add(pl);
    }
    mergeStatic(hall);
    hall.position.set(19, 0, -1);
    hall.rotation.y = Math.atan2(CAM.x - 19, CAM.z + 1) + 0.35;
    this.scene.add(hall);
  }

  makeTrees() {
    // 雪をかぶった杉（インスタンス描画）
    const spots = [];
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const tryAdd = (x, z, s) => {
      if (Math.hypot(x, z) < 9) return;
      if (occludesTemple(x, z, groundHeight(x, z) + 8.5 * s, 2.6 * s)) return; // 遠くの寺を隠す木は置かない
      if (Math.abs(x) < 3.5 && z > 4 && z < 30) return; // 参道
      if (Math.hypot(x - 19, z + 1) < 11) return; // 本堂
      // 手前左の視界を空ける
      { const ang = Math.atan2(x - CAM.x, -(z - CAM.z)) * 180 / Math.PI - FWD_DEG; const dist = Math.hypot(x - CAM.x, z - CAM.z); if (ang > -22 && ang < 20 && dist < 50) return; }
      for (const d of TEMPLE_DEFS) {
        if (Math.hypot(x - d.pos[0], z - d.pos[1]) < 8) return;
        // 視線上（カメラ→寺）を空ける
        const cx = CAM.x, cz = CAM.z;
        const vx = d.pos[0] - cx, vz = d.pos[1] - cz;
        const t = ((x - cx) * vx + (z - cz) * vz) / (vx * vx + vz * vz);
        if (t > 0 && t < 1) {
          const px = cx + vx * t, pz = cz + vz * t;
          if (Math.hypot(x - px, z - pz) < 3 + 4 * t) return;
        }
      }
      spots.push([x, z, s]);
    };
    for (let i = 0; i < 1400 && spots.length < Q.forest; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 10 + rnd() * 150;
      tryAdd(Math.cos(a) * r, Math.sin(a) * r - 6, 0.7 + rnd() * 0.8);
    }
    // 寺の背後の森
    for (const d of TEMPLE_DEFS) for (let i = 0; i < 14; i++) {
      const a = Math.PI + (rnd() - 0.5) * 2.6 + Math.atan2(d.pos[1] - CAM.z, d.pos[0] - CAM.x);
      const r = 8 + rnd() * 10;
      tryAdd(d.pos[0] + Math.cos(a) * r * -1, d.pos[1] + Math.sin(a) * r * -1, 0.8 + rnd() * 0.6);
    }
    // 背景の松：段作り・庭木の形を数種類作り、向きと大きさを変えて並べる
    const variants = [
      { form: 'tiered', height: 6.5, spread: 2.0, lean: 0.9, seed: 101, snowStyle: 'light', density: Q.forestDensity },
      { form: 'tiered', height: 7.5, spread: 2.3, lean: 1.4, seed: 102, snowStyle: 'light', density: Q.forestDensity },
      { form: 'tiered', height: 5.5, spread: 1.9, lean: 0.6, seed: 103, snowStyle: 'heavy', density: Q.forestDensity },
      { form: 'tiered', height: 8.5, spread: 2.2, lean: 1.8, seed: 104, snowStyle: 'light', density: Q.forestDensity },
      { form: 'garden', height: 4.5, spread: 2.2, lean: 1.5, seed: 105, snowStyle: 'heavy', density: Q.forestDensity + 0.02 },
      { form: 'garden', height: 5.0, spread: 2.0, lean: 1.2, seed: 106, snowStyle: 'light', density: Q.forestDensity + 0.02 },
    ];
    const placements = spots.map(([x, z, s], i) => ({
      v: i % variants.length, x, y: groundHeight(x, z) - 0.05, z, rot: x * 13.1 + z * 7.7, scale: s,
    }));
    this.scene.add(makePineForest(variants, placements, this.mats.snow));
  }

  // 境内の松（雪吊り・こも巻き付き）
  makePines() {
    const defs = [
      { x: -11.5, z: 3.0, height: 2.6, spread: 1.7, lean: 1.4, seed: 3, yukitsuri: true, snowStyle: 'heavy' },
      { x: 6.9, z: -3.6, height: 3.4, spread: 2.4, lean: 1.2, seed: 8, yukitsuri: true, snowStyle: 'light', longBranch: true },
      { x: 2.6, z: -6.6, height: 4.0, spread: 1.4, lean: 1.2, seed: 13, yukitsuri: true, snowStyle: 'heavy' },
      { x: 5.9, z: 4.4, height: 2.6, spread: 2.0, lean: 1.3, seed: 21, yukitsuri: true, snowStyle: 'light' },
    ];
    for (const d of defs) {
      const p = makePine({ ...d, snowMat: this.mats.snow, density: Q.pineDensity, lod: Q.bloom ? 'high' : 'low' });
      p.position.set(d.x, groundHeight(d.x, d.z), d.z);
      this.scene.add(p);
    }
  }

  makeTemples() {
    this.temples = TEMPLE_DEFS.map((def, i) => {
      const [x, z] = def.pos;
      const y = groundHeight(x, z);
      const shoro = makeShoro(this.mats, { detail: false, monk: true });
      // ライトアップ：光源を増やさず、材質を暖かく発光させて夜でも浮かび上がらせる
      shoro.root.traverse((o) => { if (o.isMesh && o.material !== this.mats.snow) o.material = this.litMaterial(o.material); });
      // 和尚・鐘・撞木に光の輪郭を付けて、遠くからでも形と動きが分かるようにする
      const outlines = [];
      const om = (thick) => outlineMaterial(0xffd590, thick, 0.9);
      const monkMeshes = [];
      shoro.monk.group.traverse((o) => { if (o.isMesh) monkMeshes.push(o); });
      for (const m of [...monkMeshes, ...shoro.monk.parts]) outlines.push(addOutline(m, om(0.035)));
      shoro.bell.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.parent === shoro.bell) outlines.push(addOutline(o, om(0.03))); });
      outlines.push(addOutline(shoro.logMesh, om(0.035)));
      const g = new THREE.Group();
      g.add(shoro.root);
      // 撞木の振れが見えるよう、横向きにカメラへ向ける
      const cam = new THREE.Vector3(CAM.x, 0, CAM.z);
      const dx = x - cam.x, dz = z - cam.z;
      g.rotation.y = Math.atan2(dx, dz) + Math.PI; // 和尚と篝火が手前に来る向き
      g.position.set(x, y - 0.1, z);
      g.scale.setScalar(TEMPLE_SCALE); // 遠くでも見えるよう大きめ
      // 地面の起伏に合わせた土台
      const fdn = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.5, 3, 16), this.mats.stone);
      fdn.position.y = -1.45;
      g.add(fdn);
      this.scene.add(g);
      // 寺の松。ほかの寺を隠すときは画面の右へずらす（ずらしても隠すなら置かない）
      g.updateMatrixWorld(true);
      for (const [px, pz, h, sd] of [[5.2, -3.2, 4.6, 31 + i], [-6.2, -3.0, 3.8, 41 + i]]) {
        const w0 = g.localToWorld(new THREE.Vector3(px, 0, pz));
        let spot = null;
        for (const k of [0, 5, 10, 15, 20, 26]) {
          const wx = w0.x + RIGHT[0] * k, wz = w0.z + RIGHT[1] * k;
          const top = groundHeight(wx, wz) + (h + 1.5) * TEMPLE_SCALE;
          if (!occludesTemple(wx, wz, top, 1.4 * 1.3 * TEMPLE_SCALE)) { spot = new THREE.Vector3(wx, groundHeight(wx, wz), wz); break; }
        }
        if (!spot) continue;
        const pine = makePine({ height: h * TEMPLE_SCALE, spread: 1.4 * TEMPLE_SCALE, lean: 0.9 * TEMPLE_SCALE, seed: sd, snowMat: this.mats.snow, density: Q.templePineDensity / 3.5, lod: 'low', snowStyle: sd % 2 ? 'heavy' : 'light' });
        pine.position.copy(spot);
        this.scene.add(pine);
      }
      // 篝火（遠くでも見える）
      const fire = new Bonfire(this.mats, { scale: 1.1, light: Q.extraLights, lightIntensity: 14 });
      fire.group.position.set(-3.6, 0, 2.2);
      g.add(fire.group);
      this.fires.push(fire);
      const fire2 = new Bonfire(this.mats, { scale: 1.1, light: false });
      fire2.group.position.set(3.6, 0, 2.2);
      g.add(fire2.group);
      this.fires.push(fire2);
      // 鐘の音の光輪
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.glowTexture('255,220,160'), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      halo.position.set(0, 2.4, 0);
      halo.scale.set(9, 9, 1);
      g.add(halo);
      return {
        ...def, group: g, shoro, halo, fire, fires: [fire, fire2], active: true, outlines,
        shumoku: new Shumoku(),
        bellSwing: { a: 0, v: 0 },
        worldBell: new THREE.Vector3(x, y + 4.5, z),
      };
    });
  }

  makeSnow() {
    const n = Q.snow;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.snowMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: 1 }, uCenter: { value: new THREE.Vector3() } },
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uPx; uniform vec3 uCenter; varying float vA;
        void main(){
          vec3 p = position;
          float fall = 0.6 + aSeed * 0.7;
          p.y = mod(p.y - uTime * fall, 25.0) - 2.0;
          p.x += sin(uTime * 0.6 + aSeed * 30.0) * 0.6 + uTime * 0.25;
          p.z += cos(uTime * 0.5 + aSeed * 20.0) * 0.4;
          p.x = mod(p.x - uCenter.x + 30.0, 60.0) - 30.0 + uCenter.x;
          p.z = mod(p.z - uCenter.z + 30.0, 60.0) - 30.0 + uCenter.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.04 + aSeed * 0.05) * uPx / -mv.z;
          vA = smoothstep(60.0, 2.0, -mv.z) * 0.85;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.92,0.95,1.0), vA * smoothstep(1.0, 0.2, d)); }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(g, this.snowMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.snowPoints = pts;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    const portrait = w / h < 1;
    // 望遠（横長は狭い画角、縦長は横幅を確保するため少し広め）
    this.camera.fov = portrait ? 34 : 17.5;
    this.camera.updateProjectionMatrix();
    if (portrait) {
      // 縦長：鐘楼の階段の手前から鐘を見上げる。鐘の左奥に遠くの寺が見える
      this.camBase.set(CAM.x, CAM.y, CAM.z);
      this.camTarget.copy(this.camBase).addScaledVector(camDir(-0.8, 2.2), 10);
    } else {
      this.camBase.set(CAM.x, CAM.y, CAM.z);
      this.camTarget.copy(this.camBase).addScaledVector(camDir(-1.5, 3.2), 10);
    }
    const pr = this.renderer.getPixelRatio();
    // 望遠では粒（雪・炎）も相対的に大きく見えるよう、画角に応じて拡大
    const zoom = Math.tan(THREE.MathUtils.degToRad(21)) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const pxScale = (h * pr) / 900 * zoom;
    for (const f of this.fires) f.setPixelScale(pxScale);
    this.snowMat.uniforms.uPx.value = 900 * pxScale * 1.4;
    this.starMat.uniforms.uPx.value = pr;
  }

  // 鐘を打つ（主役）
  strike(power) {
    this.bellSwing.v += 0.05 * power + 0.01;
    this.bellSwing.buzz = power;
    this.shake = Math.max(this.shake, 0.05 + power * 0.12);
    this.addRing(this.shoro.strikePoint.clone(), power, true);
  }

  addRing(pos, power, local) {
    const mat = new THREE.MeshBasicMaterial({ map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.0, side: THREE.DoubleSide, fog: !local });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    this.scene.add(m);
    this.rings.push({ m, age: 0, power, max: local ? 14 : 18, life: local ? 2.4 : 2.8 });
  }

  litMaterial(m) {
    this._lit ||= new Map();
    if (!this._lit.has(m)) {
      const c = m.clone();
      const bronze = m === this.mats.bronze || m === this.mats.bronzeBand;
      c.emissive = new THREE.Color(bronze ? 0xffb070 : 0xff9a55);
      c.emissiveIntensity = bronze ? 0.55 : 0.28;
      if (m.map) c.emissiveMap = m.map;
      this._lit.set(m, c);
    }
    return this._lit.get(m);
  }

  // 鐘をつき始めた寺だけ篝火を焚き、和尚を立たせる
  setTempleActive(i, on) {
    const t = this.temples[i];
    if (t.active === on) return;
    t.active = on;
    for (const f of t.fires) f.group.visible = on;
    t.halo.material.opacity = on ? 0.22 : 0;
    for (const o of t.outlines) o.visible = on;
    if (t.shoro.monk) {
      t.shoro.monk.group.visible = on;
      for (const m of t.shoro.monk.parts) m.visible = on;
    }
    if (!on) t.shoro.setLogAngle(0, 0);
  }

  ringTemple(i, power) {
    const t = this.temples[i];
    t.bellSwing.v += 0.06;
    t.halo.material.opacity = 0.9;
    this.addRing(t.worldBell.clone(), power, false);
  }

  update(dt, time) {
    // 撞木と鐘
    this.shoro.setLogAngle(this.shumoku.theta, this.pullAmount || 0);
    const bs = this.bellSwing;
    bs.v += (-6 * bs.a - 0.6 * bs.v) * dt;
    bs.a += bs.v * dt;
    bs.buzz *= Math.exp(-dt * 1.5);
    this.shoro.bellPivot.rotation.z = bs.a;
    this.shoro.bellPivot.rotation.x = Math.sin(time * 37) * 0.0015 * bs.buzz;

    for (const t of this.temples) {
      if (!t.active) continue;
      t.shoro.setLogAngle(t.shumoku.theta, Math.min(1, Math.max(0, -t.shumoku.theta / SWING.maxAngle)));
      t.bellSwing.v += (-6 * t.bellSwing.a - 0.6 * t.bellSwing.v) * dt;
      t.bellSwing.a += t.bellSwing.v * dt;
      t.shoro.bellPivot.rotation.z = t.bellSwing.a;
      // 鐘の周りの淡い光は常に灯し、鳴った瞬間に強く光らせる
      const base = t.active ? 0.22 : 0;
      t.halo.material.opacity = base + (t.halo.material.opacity - base) * Math.exp(-dt * 1.2);
    }

    for (const f of this.fires) f.update(time);

    // 音の輪
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const k = r.age / r.life;
      const s = 0.8 + Math.pow(k, 0.6) * r.max;
      r.m.scale.set(s, s, 1);
      r.m.material.opacity = (1 - k) * (0.15 + 0.35 * r.power);
      if (k >= 1) {
        this.scene.remove(r.m);
        r.m.geometry.dispose(); r.m.material.dispose();
        this.rings.splice(i, 1);
      }
    }

    // カメラ（ゆるやかな呼吸＋打撃の揺れ）
    this.shake *= Math.exp(-dt * 5);
    const cam = this.camera;
    cam.position.copy(this.camBase);
    cam.position.x += Math.sin(time * 0.13) * 0.5;
    cam.position.y += Math.sin(time * 0.21) * 0.08;
    // 望遠では位置を揺らしても画が動かないので、向きを揺らす
    this._look = (this._look || new THREE.Vector3()).copy(this.camTarget);
    this._look.x += (Math.random() - 0.5) * this.shake * 0.12;
    this._look.y += (Math.random() - 0.5) * this.shake * 0.12;
    cam.lookAt(this._look);

    this.snowMat.uniforms.uTime.value = time;
    // 雪はカメラと鐘楼の間から鐘楼の周りに降らせる
    this.snowMat.uniforms.uCenter.value.copy(cam.position).lerp(this.camTarget, 2.6);
    this.starMat.uniforms.uTime.value = time;
    this.skyMat.uniforms.uDawn.value += ((this.dawn || 0) - this.skyMat.uniforms.uDawn.value) * Math.min(1, dt * 0.5);

    if (!Q.bloom && Q.shadows) {
      this._shadowT += dt;
      if (this._shadowT > 0.1) { this.renderer.shadowMap.needsUpdate = true; this._shadowT = 0; }
    }
    if (Q.bloom) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // ゲーム開始前の準備：シェーダーを組み立て、数フレーム試し描きする
  async warmup(onProgress = () => {}) {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    onProgress(0.35);
    await frame();
    try {
      if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
      else this.renderer.compile(this.scene, this.camera);
    } catch (e) { console.warn(e); }
    onProgress(0.6);
    await frame();
    for (let k = 0; k < 4; k++) {
      this.update(1 / 60, k / 60);
      onProgress(0.6 + 0.1 * (k + 1));
      await frame();
    }
  }

}

export { SWING };
