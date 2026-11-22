// 篝火（かがりび）: 鉄の籠・薪・炎・火の粉・ゆらめく灯り
import * as THREE from 'three';
import { Q } from './quality.js';
import { mergeStatic } from './shoro.js';

const flameVert = /* glsl */`
  attribute vec3 aStart;
  attribute vec3 aVel;
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uLife;
  uniform float uRise;
  uniform float uConverge;
  varying float vAge;
  varying float vSeed;
  void main() {
    float life = uLife * (0.6 + aSeed * 0.8);
    float age = mod(uTime + aSeed * 37.0, life) / life;
    vec3 p = aStart * (1.0 - age * uConverge);
    p += aVel * age * life;
    p.y += age * age * uRise;
    p.x += sin(uTime * 7.0 + aSeed * 40.0) * 0.06 * age;
    p.z += cos(uTime * 6.0 + aSeed * 23.0) * 0.06 * age;
    vAge = age;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uScale * (1.0 - age * 0.55) * (0.55 + aSeed * 0.7) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const flameFrag = /* glsl */`
  uniform float uIntensity;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCool;
  varying float vAge;
  varying float vSeed;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float soft = smoothstep(1.0, 0.0, r);
    vec3 c = mix(uHot, uMid, smoothstep(0.0, 0.35, vAge));
    c = mix(c, uCool, smoothstep(0.35, 1.0, vAge));
    float a = soft * (1.0 - vAge) * (0.6 + 0.4 * vSeed);
    gl_FragColor = vec4(c * a * uIntensity, a);
  }
`;

function particles({ count, spread, height, vel, scale, life, rise, converge, hot, mid, cool, intensity }) {
  const g = new THREE.BufferGeometry();
  const start = new Float32Array(count * 3);
  const v = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    start[i * 3] = Math.cos(a) * r;
    start[i * 3 + 1] = Math.random() * height;
    start[i * 3 + 2] = Math.sin(a) * r;
    v[i * 3] = (Math.random() - 0.5) * vel[0];
    v[i * 3 + 1] = vel[1] * (0.6 + Math.random() * 0.8);
    v[i * 3 + 2] = (Math.random() - 0.5) * vel[0];
    seed[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(start.slice(), 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aVel', new THREE.BufferAttribute(v, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: flameVert,
    fragmentShader: flameFrag,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: scale },
      uLife: { value: life },
      uRise: { value: rise },
      uConverge: { value: converge },
      uIntensity: { value: intensity },
      uHot: { value: new THREE.Color(...hot) },
      uMid: { value: new THREE.Color(...mid) },
      uCool: { value: new THREE.Color(...cool) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.userData.baseScale = scale;
  return pts;
}

export class Bonfire {
  constructor(mats, { scale = 1, light = true, lightIntensity = 9 } = {}) {
    this.group = new THREE.Group();
    this.scale = scale;
    const s = scale;
    // 鉄の三脚と籠
    const legGeo = new THREE.CylinderGeometry(0.025 * s, 0.03 * s, 1.35 * s, 6);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(legGeo, mats.iron);
      leg.position.set(Math.cos(a) * 0.22 * s, 0.62 * s, Math.sin(a) * 0.22 * s);
      leg.rotation.z = Math.cos(a) * 0.28;
      leg.rotation.x = -Math.sin(a) * 0.28;
      leg.castShadow = true;
      this.group.add(leg);
    }
    const basketY = 1.3 * s;
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry((0.2 + k * 0.08) * s, 0.012 * s, 5, 20), mats.iron);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = basketY + k * 0.12 * s;
      this.group.add(ring);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * s, 0.01 * s, 0.3 * s, 4), mats.iron);
      bar.position.set(Math.cos(a) * 0.28 * s, basketY + 0.12 * s, Math.sin(a) * 0.28 * s);
      bar.rotation.z = Math.cos(a) * 0.55;
      bar.rotation.x = -Math.sin(a) * 0.55;
      this.group.add(bar);
    }
    // 薪
    for (let i = 0; i < 7; i++) {
      const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.6 * s, 6), mats.ember);
      wood.position.set((Math.random() - 0.5) * 0.12 * s, basketY + 0.1 * s + Math.random() * 0.12 * s, (Math.random() - 0.5) * 0.12 * s);
      wood.rotation.set(Math.random() * 3, Math.random() * 3, 1.2 + Math.random() * 0.6);
      this.group.add(wood);
    }
    // 炎・火の粉
    const flameBase = new THREE.Group();
    flameBase.position.y = basketY + 0.15 * s;
    this.group.add(flameBase);
    this.flame = particles({
      count: Math.round(220 * Q.fireCount), spread: 0.2 * s, height: 0.08 * s, vel: [0.25 * s, 0.7 * s], scale: 260 * s,
      life: 0.75, rise: 0.35 * s, converge: 0.85,
      hot: [1.0, 0.92, 0.65], mid: [1.0, 0.45, 0.08], cool: [0.45, 0.06, 0.01], intensity: 1.1,
    });
    this.core = particles({
      count: Math.round(70 * Q.fireCount), spread: 0.12 * s, height: 0.05 * s, vel: [0.1 * s, 0.4 * s], scale: 200 * s,
      life: 0.5, rise: 0.15 * s, converge: 0.6,
      hot: [1.0, 1.0, 0.85], mid: [1.0, 0.75, 0.3], cool: [1.0, 0.35, 0.05], intensity: 1.2,
    });
    this.sparks = particles({
      count: Math.round(50 * Q.fireCount), spread: 0.18 * s, height: 0.2 * s, vel: [0.7 * s, 1.1 * s], scale: 22 * s,
      life: 2.4, rise: 1.4 * s, converge: -0.8,
      hot: [1.0, 0.85, 0.5], mid: [1.0, 0.5, 0.15], cool: [0.8, 0.2, 0.05], intensity: 2.2,
    });
    this.smoke = new THREE.Group();
    flameBase.add(this.flame, this.core, this.sparks);
    // 灯り
    if (light) {
      this.light = new THREE.PointLight(0xff8a3a, lightIntensity * s, 14 * s, 1.6);
      this.light.position.y = basketY + 0.6 * s;
      this.group.add(this.light);
      this.baseIntensity = lightIntensity * s;
    }
    this.seed = Math.random() * 100;
    mergeStatic(this.group);
  }
  setPixelScale(k) {
    for (const p of [this.flame, this.core, this.sparks]) p.material.uniforms.uScale.value = p.userData.baseScale * k;
  }
  update(t) {
    for (const p of [this.flame, this.core, this.sparks]) p.material.uniforms.uTime.value = t;
    if (this.light) {
      const f = Math.sin(t * 13 + this.seed) * 0.12 + Math.sin(t * 7.3 + this.seed * 2) * 0.1 + Math.sin(t * 23.1) * 0.05;
      this.light.intensity = this.baseIntensity * (1 + f);
      this.light.position.x = Math.sin(t * 5 + this.seed) * 0.05;
    }
  }
}
