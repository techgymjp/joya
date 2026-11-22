// 画質設定：スマホ（タッチ端末）は自動で軽量モード。URL の ?q=high / ?q=low で指定もできる
const q = new URLSearchParams(location.search).get('q');
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export const LOW = q === 'low' || (q !== 'high' && touch);

export const Q = LOW
  ? {
    pixelRatio: 1, antialias: false, bloom: false, shadows: false, shadowSize: 1024, softShadow: false,
    forest: 40, forestDensity: 0.16, pineDensity: 0.45, templePineDensity: 0.3,
    snow: 800, fireCount: 0.4, groundSeg: 90, extraLights: false, fps: 30,
  }
  : {
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2), antialias: true, bloom: true, shadows: true, shadowSize: 2048, softShadow: true,
    forest: 170, forestDensity: 0.28, pineDensity: 1, templePineDensity: 0.5,
    snow: 5000, fireCount: 1, groundSeg: 220, extraLights: true, fps: 0,
  };
