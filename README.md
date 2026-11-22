# 除夜の鐘

大晦日の夜、雪の境内で百八の鐘をつく 3D ウェブゲームです。ブラウザだけで動き、ビルドは要りません。

## 遊び方

- **長押し**（クリック・タップ・スペースキー）で撞木を引き、**離す**と撞木が鐘にぶつかります。長く引くほど強く響きます（約1.4秒で最大）。
- 前の鐘の**余韻**（左下の輪）が消えてから撞くと、得点が上がります。
- 遠くの丘の寺でも和尚が除夜の鐘をついています。奥の丘の寺で和尚が撞木を引く様子を見て、**同時に鳴らすと「共鳴」**。続けるとコンボでボーナスが増え、二つの寺と同時なら「大共鳴」。和尚は本番の前に「ためし引き」をすることがあり、引く速さも毎回変わります。
- 最初は西の寺だけ。30打ごとに東の寺、北の寺が加わります。
- 107 打目のあと年が明けます。最後の一打は新年に。
- 横長画面で遊ぶゲームです（スマホは横向き。縦向きでは案内が出ます）。望遠レンズで撮ったような構図で、奥の寺も大きく見えます。
- タイトル画面の「遊び方」から説明ページを開けます。日本語と英語を切り替えられます（初回はブラウザの言語に合わせます）。

## 構成

| ファイル | 内容 |
| --- | --- |
| `index.html` | 画面と HUD |
| `css/style.css` | スタイル |
| `js/main.js` | ゲーム進行・入力・得点・共鳴判定 |
| `js/world.js` | 3D シーン（地形、空、雪、杉、本堂、遠くの寺、カメラ） |
| `js/shoro.js` | 鐘楼・梵鐘（乳は 108 個）・撞木の振り子・和尚 |
| `js/fire.js` | 篝火（炎・火の粉のパーティクルと灯り） |
| `js/pine.js` | 松（うねる幹・雲形の葉・雪・雪吊り・こも巻き） |
| `js/audio.js` | 梵鐘の音・遠くの鐘・陰旋法の BGM・風と篝火の音を Web Audio で合成（録音素材なし） |
| `js/textures.js` | テクスチャを手続き生成 |
| `js/bonnou.js` | 画面に出る煩悩の一覧（身近な迷い 108 個と英訳。教義上の百八煩悩とは別物） |
| `js/i18n.js` | 日本語・英語の文言 |
| `vendor/` | [three.js](https://threejs.org/) r170（MIT、`vendor/THREE_LICENSE`） |
| `js/ads.js` | AdMob 広告（アプリのときだけ動く） |
| `scripts/build-web.js` | Web 版・アプリ用のファイルを `www/` にまとめる |
| `android/` | Android プロジェクト（Capacitor） |
| `assets/` | アイコン・起動画面の元画像 |

## Android アプリ

パッケージ名 `jp.techgym.joya`。Web 版と同じファイルを [Capacitor](https://capacitorjs.com/) でアプリに同梱しています（オフラインで遊べます）。

- 動作確認用 APK（テスト広告・デバッグ署名）：リリース画面 https://github.com/techgymjp/joya/releases/tag/android-latest
- APK を直接ダウンロード：https://github.com/techgymjp/joya/releases/latest/download/joya.apk

<img src="docs/apk-qr.png" width="200" alt="リリース画面の QR コード">

- ビルドは GitHub Actions（`.github/workflows/android.yml`）。`main` へ push するたびに APK を作り、上のリリース画面の APK を差し替えます
- GitHub Secrets（`ANDROID_KEYSTORE_BASE64` など 4 つ）を登録すると、Google Play 用の署名付き AAB（本番広告）も作られ、Actions の Artifact に上がります
- 広告（AdMob）：バナーはタイトル・遊び方・ポーズ・結果の画面だけ。全画面広告はプレイ開始・タイトルへ戻る・再開・もう一度のたび。リワード広告は「共鳴コンボが途切れた一打をやり直す」（1 ゲーム 5 回まで）
- 本番の AdMob アプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id`、広告ユニット ID は `js/ads.js` の `production` に入れる
- ストアの掲載文の下書き：`docs/store/listing.md`

```bash
npm ci
npm run android:sync   # www/ を作って Android プロジェクトへコピー
npm run android:open   # Android Studio で開く
```

## ローカルで動かす

ES モジュールを使うため、ファイルを直接開くのではなく簡易サーバーを立ててください。

```bash
python3 -m http.server 8000
```

ブラウザで http://localhost:8000 を開きます。

## GitHub Pages

リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `main` / `(root)` にすると公開されます。

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリ（Google Play、App Store など）として公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止し、著作権表示を残してください。詳しくは [LICENSE](LICENSE) をご覧ください。同梱の three.js は MIT ライセンスです（`vendor/THREE_LICENSE`）。
