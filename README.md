# Relax Space 🌊

> 音・呼吸・映像で、数分間だけ頭を手放す場所。

**デモ → [junia2009.github.io/relax_space](https://junia2009.github.io/relax_space/)**

---

## どんなアプリ？

スマートフォンのブラウザで開くだけで使える、瞑想・リラックス用の Web アプリです。  
インストール不要で PWA（アプリとしてホーム画面に追加）にも対応しています。

4 つのテーマと呼吸ガイド、タイマーを組み合わせて、自分好みのリラックスタイムを作れます。  
テーマは 3D カルーセルで横スワイプして選択。セッションを重ねると実績バッジが解除されていきます。

---

## 機能一覧

### テーマ（Three.js による 3D シーン）

| テーマ | 演出のポイント |
|--------|---------------|
| 🌊 深海 | プランクトンが漂う粒子、ゆらめくクラゲ、揺れる光の柱 |
| 🌿 森   | 蛍の粒子が瞬く、シルエットの木々が風でそっとゆれる |
| ✨ 宇宙 | 星がカメラへ向かって流れ続ける無限スターフィールド、星雲の揺らぎ |
| 🔥 焚き火 | 外炎・内炎・火の粉の 3 層パーティクル、ちらつく炎のライト |

### 呼吸ガイド

| パターン | リズム | 効果 |
|----------|--------|------|
| ボックス呼吸 | 4-4-4-4 | 集中・ストレス軽減 |
| 4-7-8 呼吸 | 4-7-8 | 睡眠・深いリラックス |
| 自然呼吸 | 4-6 | 日常的なリラックス |

### その他

- **テーマ選択** : 3D カルーセルで横スワイプして選択。サイドのカードをタップしても切り替わる
- **タイマー** : 5 分 / 10 分 / 20 分 / ∞（無制限）をボトムシートで選択
- **呼吸法** : 3 パターンをボトムシートで選択
- **音量コントロール** : スライダー＋ミュートボタン
- **習慣トラッキング** : 今日の合計時間と連続日数をローカルに記録
- **実績システム** : セッション回数・テーマ制覇などの条件を満たすとバッジが解除され、ホーム画面に表示
- **セッション完了画面** : 達成メッセージ・ストリーク・新規解除バッジを表示

### 実績バッジ一覧

全 11 種類。条件を満たすとセッション完了時に通知され、ホーム画面のバッジ欄に永続表示されます。  
進捗はブラウザの localStorage に保存されるため、アプリを閉じても引き継がれます。

| バッジ | 名前 | 解除条件 | カテゴリ |
|--------|------|----------|----------|
| 🌱 | はじまり | 初めてのセッションを完了 | 初回 |
| ✨ | 3日連続 | 3日連続でセッション | 連続 |
| 🌙 | 1週間の旅 | 7日連続でセッション | 連続 |
| ⭐ | 月の習慣 | 30日連続でセッション | 連続 |
| ⏳ | 1時間の静寂 | 累計60分達成 | 累計時間 |
| 🧘 | 修行者 | 累計300分達成 | 累計時間 |
| 🌊 | 深海探検 | 深海テーマを使用 | テーマ |
| 🌿 | 森の精 | 森テーマを使用 | テーマ |
| 💫 | 星の旅人 | 宇宙テーマを使用 | テーマ |
| 🔥 | 焚き火の番人 | 焚き火テーマを使用 | テーマ |
| 🎯 | 全テーマ制覇 | 全4テーマを使用 | テーマ |

---

## 技術スタック

| 分類 | 使用技術 |
|------|----------|
| フロントエンド | Vanilla JavaScript (ES Modules) |
| 3D グラフィックス | [Three.js](https://threejs.org/) / WebGL |
| ビルドツール | [Vite](https://vitejs.dev/) |
| PWA | vite-plugin-pwa / Workbox |
| デプロイ | GitHub Actions → GitHub Pages |
| スタイル | CSS (カスタムプロパティ・アニメーション) |
| 音声 | Web Audio API |

---

## こだわりポイント

### 1. Three.js で本格的な 3D シーンを構築

ブラウザ上で WebGL を動かし、テーマごとにまったく異なる世界を実装しました。

- **パーティクルシステム** を自作し、プランクトン・蛍・星・火の粉をそれぞれ専用のロジックで動かしています
- **ポイントライト** の強度を時間に合わせてアニメーションさせ、焚き火のちらつきや深海の光のゆらぎを表現
- **フォグ（霧）** を加えることで奥行き感と幻想的な雰囲気を演出

```js
// 焚き火ライトのちらつき（2 つの sin 波を重ねてランダム感を出す）
fireLight.intensity = 5.5 + Math.sin(t * 9) * 0.8 + Math.sin(t * 14.3) * 0.5;
```

### 2. 「星が消えるバグ」を根本から修正

開発中に **宇宙モードで数分後に星が消える** 問題を発見しました。

**原因の特定**：星フィールド全体を `rotation.y = t * 0.008` で回転させていたため、約 6.5 分後（π ÷ 0.008 秒）に 180° 回転してカメラの背後に全星が回り込み、見えなくなっていました。

**修正**：回転方式を廃止し、各星が Z 軸方向にカメラへ向かって流れ続け、通り過ぎたら奥にリセットされる**スターストリーミング方式**に変更。どんな長さのセッションでも星が途切れません。

```js
// 各星を個別に Z 方向へ移動させ、カメラを通過したらリスポーン
updaters.push(t => {
  for (let i = 0; i < SC; i++) {
    sArr[i * 3 + 2] += sSpeeds[i];       // Z 方向に流す
    if (sArr[i * 3 + 2] > 18) resetStar(i); // カメラ通過 → 奥にリセット
  }
  sGeo.attributes.position.needsUpdate = true;
});
```

### 3. iPhone / Safari の細かい差異への対応

iOS Safari は Chrome と挙動が異なる箇所が多く、以下を丁寧に対応しました。

- **`100dvh`（Dynamic Viewport Height）**: ブラウザの UI バーが表示/非表示になっても画面がずれない
- **`env(safe-area-inset-*)`**: ノッチやホームバーに UI が隠れないよう余白を動的に確保
- **`viewport-fit=cover`**: 画面の端まで背景色を広げ、没入感を高める
- **`-webkit-backdrop-filter`**: Safari でブラーエフェクトを有効化
- **`color-mix()` 非対応への回避**: CSS 変数 `--theme-glow` で代替し、全ブラウザ対応

### 4. PWA として完全に動作

- ホーム画面に追加するとアプリのように起動
- Service Worker によるオフラインキャッシュ対応
- アイコン（192px・512px・Apple Touch Icon 180px）を**外部ライブラリ不使用**の純 Node.js コードで生成

```js
// zlib の deflateSync だけで PNG を自作エンコード（依存ゼロ）
function encodePNG(rgba, w, h) {
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', ...)]);
}
```

### 5. GitHub Actions による自動デプロイ

`main` ブランチへ push するたびに自動でビルド → GitHub Pages に公開されます。

```yaml
- run: npm install --legacy-peer-deps
- run: npm run build
- uses: peaceiris/actions-gh-pages@v4
  with:
    publish_dir: ./dist
```

### 7. 3D カルーセルによるテーマ選択 UI

テーマカードを 2×2 グリッドから **3D coverflow カルーセル**に刷新しました。

- CSS `perspective` によるY軸回転でカードが奥へ傾いて見える立体感を実現
- `touchstart` / `touchend` のスワイプ検知と、サイドカードへのタップ操作の両方に対応
- `data-pos` 属性（`active` / `right` / `left` / `back`）を切り替えるだけで CSS Transition が自動補間するシンプルな実装
- `will-change: transform, opacity` で GPU レイヤーを確保し、60fps のスムーズなアニメーションを維持

```js
// インデックスをずらして data-pos を付け直すだけで切り替わる
function updateCarousel() {
  document.querySelectorAll('.theme-card').forEach((card, i) => {
    const rel = (i - carouselIdx + n) % n;
    card.dataset.pos = CAROUSEL_POS[rel]; // CSS がアニメーションを補間
  });
}
```

### 8. モバイルファーストなレイアウト設計

縦に長いコンテンツが小さな画面でも収まるよう、`clamp()` を活用して余白とサイズを画面高さに応じて自動調整しています。

```css
/* gap が画面高さに応じて 0.6rem〜2rem の間で自動的に縮小 */
.home-inner {
  gap: clamp(0.6rem, 2vh, 2rem);
  padding-top: calc(clamp(0.75rem, 2vh, 1.5rem) + env(safe-area-inset-top, 0px));
}
```

---

## ローカルで動かす

```bash
git clone https://github.com/junia2009/relax_space.git
cd relax_space
npm install --legacy-peer-deps
npm run dev
```

ブラウザで `http://localhost:5173/relax_space/` を開く。

---

## ディレクトリ構成

```
relax_space/
├── src/
│   ├── main.js          # アプリ全体の制御・DOM 構築・カルーセル
│   ├── scenes.js        # Three.js 3D シーン（テーマ別）
│   ├── audio.js         # Web Audio API による環境音
│   ├── breathing.js     # 呼吸ガイドアニメーション
│   ├── achievements.js  # 実績システム（定義・判定・保存）
│   └── style.css        # スタイル（CSS アニメーション・カルーセル含む）
├── scripts/
│   └── gen-icons.mjs  # PWA アイコン自動生成スクリプト
├── public/
│   ├── favicon.svg
│   └── icons/         # 192px・512px・apple-touch-icon
├── .github/workflows/
│   └── deploy.yml     # GitHub Actions 自動デプロイ
└── vite.config.js     # Vite + PWA 設定
```

---

## ライセンス

MIT
