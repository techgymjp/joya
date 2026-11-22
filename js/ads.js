// Google AdMob 広告（Android アプリのときだけ動く。Web 版では何もしない）
// 出す場面（基本ルール）
//  ・バナー：タイトル・遊び方・ポーズ・結果の画面だけ（画面の下中央）。プレイ中は出さない
//  ・全画面広告：プレイ開始／タイトルへ戻る／ポーズからの再開／結果からもう一度、のたびに毎回
//  ・リワード広告：共鳴コンボが途切れた一打をやり直すときだけ（1 ゲーム 5 回まで）
window.Ads = (() => {
  const UNITS = {
    android: {
      // Google 公式のテスト用広告ユニット
      test: {
        interstitial: 'ca-app-pub-3940256099942544/1033173712',
        rewarded: 'ca-app-pub-3940256099942544/5224354917',
        banner: 'ca-app-pub-3940256099942544/9214589741',
      },
      // 本番の広告ユニット（AdMob で作成後に入れる。空の種類は本番ビルドで出さない）
      production: {
        interstitial: 'ca-app-pub-6411535997477460/7585930561',
        rewarded: '', // リワード広告ユニットが届いたら入れる（空のあいだは本番ビルドで出さない）
        banner: 'ca-app-pub-6411535997477460/8077931333',
      },
    },
  };
  const RETRY_MS = 20000; // 読み込みに失敗したら少し待って再挑戦する
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = native && cap.Plugins ? cap.Plugins.AdMob : null;
  const testing = window.AD_MODE !== 'production';
  const ids = UNITS.android[testing ? 'test' : 'production'];

  let ready = false; // 広告をリクエストしてよい状態（初期化と同意確認が済んだ）
  let showing = false;
  let privacyRequired = false; // 「広告の設定」を利用者が開けるようにする必要があるか（EU など）
  const waiters = {};
  // 広告の表示中は音を止める（main.js が設定する）
  const audioHooks = { suspend: () => {}, resume: () => {} };

  const slots = {
    inter: { loaded: false, pending: null, id: ids.interstitial, load: () => AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: testing }) },
    reward: { loaded: false, pending: null, id: ids.rewarded, load: () => AdMob.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: testing }) },
  };

  function prepare(kind) {
    const s = slots[kind];
    if (!ready || !s.id) return Promise.resolve(false);
    if (s.loaded) return Promise.resolve(true);
    if (!s.pending) {
      s.pending = s.load()
        .then(() => { s.loaded = true; return true; })
        .catch(() => { setTimeout(() => prepare(kind), RETRY_MS); return false; })
        .finally(() => { s.pending = null; });
    }
    return s.pending;
  }

  function ensureLoaded(kind, timeout) {
    if (slots[kind].loaded) return Promise.resolve(true);
    return Promise.race([prepare(kind), new Promise((r) => setTimeout(() => r(false), timeout))]);
  }

  function finish(kind, result) {
    showing = false;
    audioHooks.resume();
    const w = waiters[kind];
    waiters[kind] = null;
    if (w) w(result);
    updateBanner();
  }

  async function init() {
    try {
      await AdMob.initialize({ initializeForTesting: testing });
    } catch (e) {
      return;
    }
    // EU・英国などで必要な広告の同意確認（必要な地域でだけフォームが出る）。
    // 確認自体が失敗した場合は、同意不要の地域とみなして続ける（ここで止まると広告が一切出なくなる）
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.status === 'REQUIRED' && consent.isConsentFormAvailable) consent = await AdMob.showConsentForm();
      ready = consent.canRequestAds !== false;
      privacyRequired = consent.privacyOptionsRequirementStatus === 'REQUIRED';
    } catch (e) {
      ready = true;
    }
    AdMob.addListener('bannerAdSizeChanged', (info) => { bannerHeight = (info && info.height) || 0; applyBannerSpace(); });
    AdMob.addListener('bannerAdFailedToLoad', () => { bannerHeight = 0; applyBannerSpace(); });
    let rewarded = false;
    AdMob.addListener('interstitialAdDismissed', () => finish('inter'));
    AdMob.addListener('interstitialAdFailedToShow', () => finish('inter'));
    AdMob.addListener('onRewardedVideoAdShowed', () => { rewarded = false; });
    AdMob.addListener('onRewardedVideoAdReward', () => { rewarded = true; });
    AdMob.addListener('onRewardedVideoAdDismissed', () => finish('reward', rewarded));
    AdMob.addListener('onRewardedVideoAdFailedToShow', () => finish('reward', false));
    prepare('inter');
    prepare('reward');
    updateBanner();
    if (onReadyCb) onReadyCb();
  }

  // ---- バナー
  let bannerWanted = false;
  let bannerCreated = false;
  let bannerVisible = false;
  let bannerHeight = 0;
  function applyBannerSpace() {
    document.documentElement.style.setProperty('--banner-h', (bannerVisible ? bannerHeight : 0) + 'px');
  }
  function updateBanner() {
    if (!AdMob || !ready || !ids.banner) return;
    const want = bannerWanted && !showing;
    if (want === bannerVisible) return;
    bannerVisible = want;
    applyBannerSpace();
    if (want && !bannerCreated) {
      bannerCreated = true;
      AdMob.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: testing })
        .catch(() => { bannerCreated = false; bannerVisible = false; applyBannerSpace(); });
    } else if (want) {
      AdMob.resumeBanner().catch(() => {});
    } else if (bannerCreated) {
      AdMob.hideBanner().catch(() => {});
    }
  }
  function setBanner(on) { bannerWanted = on; updateBanner(); }

  // 全画面広告を表示し、閉じられたら resolve する（読み込めていないときは出さずにすぐ resolve）
  function showInterstitial() {
    if (!AdMob || !ready || !slots.inter.loaded || showing) return Promise.resolve();
    showing = true;
    slots.inter.loaded = false;
    updateBanner();
    audioHooks.suspend();
    return new Promise((resolve) => {
      waiters.inter = () => { prepare('inter'); resolve(); };
      AdMob.showInterstitial().catch(() => finish('inter'));
    });
  }

  // リワード広告。結果は 'rewarded'（最後まで見た）/ 'skipped'（途中で閉じた）/ 'unavailable'（読み込めなかった）
  async function showRewarded() {
    if (!AdMob || showing) return 'unavailable';
    await initDone;
    if (!ready || !slots.reward.id || !(await ensureLoaded('reward', 8000))) return 'unavailable';
    showing = true;
    slots.reward.loaded = false;
    updateBanner();
    audioHooks.suspend();
    return new Promise((resolve) => {
      waiters.reward = (ok) => { prepare('reward'); resolve(ok ? 'rewarded' : 'skipped'); };
      AdMob.showRewardVideoAd().catch(() => finish('reward', false));
    });
  }

  function showPrivacyOptions() {
    if (!AdMob) return Promise.resolve();
    return AdMob.showPrivacyOptionsForm().catch(() => {});
  }

  let onReadyCb = null;
  const initDone = AdMob ? init() : Promise.resolve();

  return {
    get available() { return !!AdMob; },
    get rewardAvailable() { return !!AdMob && !!slots.reward.id; },
    get showing() { return showing; },
    get privacyOptionsRequired() { return privacyRequired; },
    initDone,
    onReady(cb) { onReadyCb = cb; },
    setAudioHooks(h) { Object.assign(audioHooks, h); },
    showInterstitial,
    showRewarded,
    showPrivacyOptions,
    setBanner,
  };
})();
