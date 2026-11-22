// 日本語・英語の文言
const STR = {
  ja: {
    pageTitle: '除夜の鐘',
    pageDesc: '大晦日の夜、108回の鐘をつく3Dウェブゲーム。遠くの寺の鐘と同時に撞けば共鳴コンボ。',
    countPre: '第', countPost: '打',
    score: '得点', mute: '音の切り替え', pull: '引き', yoin: '余韻',
    hint: '長押しで撞木を引き、離して撞く',
    title: '除夜の鐘', sub: '百八の煩悩を、ひと撞きずつ。',
    start: '鐘をつく', howto: '遊び方', soundNote: '音が出ます', back: '戻る',
    langBtn: 'English',
    h1t: '撞木を引いて、離す',
    h1p: '<b>長押し</b>（クリック・タップ・スペースキー）で撞木を引き、<b>離す</b>と鐘にぶつかります。長く引くほど強く響きます（約1.4秒で最大）。',
    h2t: '余韻を聴く',
    h2p: '前の鐘の響きが消えてから撞くと心が整い、得点が上がります。左の「余韻」の輪が小さくなるのが目安です。',
    h3t: '遠くの寺と共鳴する',
    h3p: '奥の丘の寺でも和尚が鐘をついています。和尚が撞木を引く様子を見て、<b>同時に鳴らす</b>と「共鳴」。続けるとコンボになり、二つの寺と同時なら「大共鳴」です。',
    rotate: '画面を横向きにしてお楽しみください',
    h3p2: '和尚は本番の前に「ためし引き」をすることがあり、引く速さも毎回変わります。撞木が鐘に届くまでの時間を見越して、早めに引き始めましょう。',
    h4t: '寺が増える',
    h4p: 'はじめは西の寺だけ。30打ごとに東の寺、北の寺が加わります。',
    h5t: '年を越す',
    h5p: '107打目のあと年が明けます。最後の一打は新年に。百八打を終えると、得点に応じた位が授けられます。',
    nums: ['一', '二', '三', '四', '五'],
    kinga: '謹賀新年', points: '点',
    great: '見事', good: '良し', ok: 'やや弱い', bad: 'かすか', reso: '共鳴', maxCombo: '最大コンボ',
    retry: 'もう一度', toTitle: 'タイトルへ',
    loading: '鐘楼を建てています…', noWebgl: 'WebGL を利用できないため表示できません。',
    temples: ['西の寺', '北の寺', '東の寺'],
    joined: (n) => `${n}も鐘をつき始めた`, joinedSub: '和尚の引き方を見て、同時に鳴らそう',
    caption: (n) => `払う煩悩　其の${n}`,
    comboHud: (n) => `共鳴 ${n} 連`,
    yoinGood: '余韻を聴いた', yoinBad: 'せっかち', yoinMid: '余韻が残る',
    soon: 'まもなく年が明けます', soonSub: '最後の一打は新年に',
    newYear: '謹賀新年', year: (y) => `${y}年`,
    resoBig: '大共鳴', resoPop: (title, c) => `${title}！ ${c}連`, resoSub: (names, b) => `${names}と響き合う　+${b}`, joiner: '・',
    best: (b) => `最高得点　${b}`, newBest: '最高得点を更新しました',
    dawn: '年が明けました', dawnSub: '最後の一打を',
    pauseTitle: 'ひと休み', resume: '再開する', share: '結果をシェア', copied: '結果をコピーしました',
    privacy: 'プライバシーポリシー', privacyUrl: 'https://techgym.jp/privacy-policy/', adSettings: '広告の設定',
    redoBtn: (n) => `広告を見て、この一打をやり直す（あと${n}回）`, redoDone: 'やり直し', redoDoneSub: '途切れる前の一打に戻りました',
    redoLabel: 'やり直し', redoCount: (n) => `${n}回`,
    shareText: (score, rank, combo, redo) => `除夜の鐘で百八の煩悩を払いました。${score}点・位は「${rank}」、共鳴は最大${combo}連${redo ? `（やり直し${redo}回）` : ''}。`,
    h1pApp: '<b>画面を長押し</b>して撞木を引き、<b>指を離す</b>と鐘にぶつかります。長く引くほど強く響きます（約1.4秒で最大）。',
    ranks: [
      ['解脱', '鐘の声に、迷いはひとつも残っていない。'],
      ['悟りの境地', '遠くの寺と心を通わせ、見事に年を越した。'],
      ['心清らか', '澄んだ響きで新しい年を迎えた。'],
      ['修行中', 'まだ少し煩悩が残っている。来年もまた。'],
      ['煩悩まみれ', '焦らず、余韻に耳を澄ませてみよう。'],
    ],
  },
  en: {
    pageTitle: 'Joya no Kane',
    pageDesc: 'A 3D web game: ring the temple bell 108 times on New Year\'s Eve. Ring together with distant temples for resonance combos.',
    countPre: 'Strike', countPost: '',
    score: 'Score', mute: 'Toggle sound', pull: 'Pull', yoin: 'Echo',
    hint: 'Hold to pull the log, release to strike',
    title: 'Joya no Kane', sub: 'The New Year\'s Eve bell. Ring away 108 earthly desires.',
    start: 'Ring the bell', howto: 'How to play', soundNote: 'Sound on', back: 'Back',
    langBtn: '日本語',
    h1t: 'Pull the log, then let go',
    h1p: '<b>Hold</b> (click, tap or Space) to pull back the wooden striker, and <b>release</b> to swing it into the bell. The longer you pull, the louder it rings (full strength in about 1.4 s).',
    h2t: 'Listen to the echo',
    h2p: 'Wait until the previous ring fades before striking again to keep a calm mind and score higher. Watch the "Echo" ring on the left shrink.',
    h3t: 'Resonate with distant temples',
    h3p: 'Monks at the temples on the far hills are ringing their bells too. Watch them pull their strikers and <b>ring at the same moment</b> for a "Resonance". Keep it up for combos; matching two temples at once is a "Great Resonance".',
    rotate: 'Please turn your device sideways',
    h3p2: 'Monks sometimes do practice pulls first, and their pace changes each time. The log takes a moment to reach the bell, so start pulling a little early.',
    h4t: 'More temples join',
    h4p: 'Only the West Temple rings at first. The East and North Temples join every 30 strikes.',
    h5t: 'See in the New Year',
    h5p: 'The year turns after the 107th strike; the last strike belongs to the new year. After all 108, you receive a rank based on your score.',
    nums: ['1', '2', '3', '4', '5'],
    kinga: 'Happy New Year', points: 'pts',
    great: 'Superb', good: 'Good', ok: 'Weak', bad: 'Faint', reso: 'Resonance', maxCombo: 'Max combo',
    retry: 'Play again', toTitle: 'Title',
    loading: 'Building the bell tower…', noWebgl: 'This game needs WebGL, which is not available in this browser.',
    temples: ['West Temple', 'North Temple', 'East Temple'],
    joined: (n) => `The ${n} begins to ring`, joinedSub: 'Watch the monk and ring together',
    caption: (n) => `Desire no. ${n}`,
    comboHud: (n) => `Resonance ×${n}`,
    yoinGood: 'Listened to the echo', yoinBad: 'Too hasty', yoinMid: 'Echo still lingering',
    soon: 'The new year is near', soonSub: 'Save the last strike for the new year',
    newYear: 'Happy New Year', year: (y) => `${y}`,
    resoBig: 'Great Resonance', resoPop: (title, c) => `${title}! ×${c}`, resoSub: (names, b) => `In tune with the ${names}  +${b}`, joiner: ' & ',
    best: (b) => `Best score  ${b}`, newBest: 'New best score!',
    dawn: 'The new year has come', dawnSub: 'Ring the final bell',
    pauseTitle: 'Paused', resume: 'Resume', share: 'Share result', copied: 'Result copied',
    privacy: 'Privacy policy', privacyUrl: 'https://techgym.jp/privacy-policy-en/', adSettings: 'Ad settings',
    redoBtn: (n) => `Watch an ad to redo this strike (${n} left)`, redoDone: 'Redo', redoDoneSub: 'Back to the strike before the combo broke',
    redoLabel: 'Redos', redoCount: (n) => `${n}`,
    shareText: (score, rank, combo, redo) => `I rang away 108 earthly desires in Joya no Kane: ${score} pts, rank "${rank}", best resonance ×${combo}${redo ? ` (${redo} redo${redo > 1 ? 's' : ''})` : ''}.`,
    h1pApp: '<b>Touch and hold</b> the screen to pull back the wooden striker, and <b>let go</b> to swing it into the bell. The longer you pull, the louder it rings (full strength in about 1.4 s).',
    ranks: [
      ['Liberation', 'Not a single doubt remains in the voice of the bell.'],
      ['Enlightenment', 'In harmony with the distant temples, you saw the year out beautifully.'],
      ['Pure Heart', 'You greeted the new year with a clear tone.'],
      ['In Training', 'A few desires remain. Try again next year.'],
      ['Full of Desires', 'Do not rush. Listen to the echo.'],
    ],
  },
};

// アプリ（Capacitor）で動いているか。アプリでは操作の説明をタッチ向けにする
const cap = window.Capacitor;
export const NATIVE = !!(cap && cap.isNativePlatform && cap.isNativePlatform());

const KEY = 'joya-lang';
let lang = (() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'ja' || v === 'en') return v;
  } catch { /* 保存できない環境 */ }
  return (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
})();

export const getLang = () => lang;
export function t(key, ...args) {
  const v = STR[lang][key] ?? STR.ja[key];
  return typeof v === 'function' ? v(...args) : v;
}

// data-i18n 属性のついた要素の中身を差し替える
export function applyStatic() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('pageDesc'));
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    el.innerHTML = t(NATIVE && STR.ja[`${k}App`] ? `${k}App` : k);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-num]').forEach((el) => { el.textContent = t('nums')[Number(el.dataset.i18nNum)]; });
}

export function setLang(l) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* 保存できない環境 */ }
  applyStatic();
}
