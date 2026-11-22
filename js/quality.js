// 画質設定：スマホ（タッチ端末）は自動で軽量モード。URL の ?q=high / ?q=low で指定もできる
const q = new URLSearchParams(location.search).get('q');
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
export const LOW = q === 'low' || (q !== 'high' && touch);

export const Q = LOW
  ? {
    pixelRatio: 1, antialias: false, bloom: false, shadowSize: 1024, softShadow: false,
    forest: 70, forestDensity: 0.18, pineDensity: 0.55, templePineDensity: 0.3,
    snow: 1500, fireCount: 0.45, groundSeg: 110, extraLights: false,
  }
  : {
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2), antialias: true, bloom: true, shadowSize: 2048, softShadow: true,
    forest: 170, forestDensity: 0.28, pineDensity: 1, templePineDensity: 0.5,
    snow: 5000, fireCount: 1, groundSeg: 220, extraLights: true,
  };
