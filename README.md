# ラクガキアドベンチャー

6つのパーツを描き、立体になったキャラクターで5つの短いコースを攻略する、スマートフォン向けブラウザゲームです。描画・立体化・物理・保存はブラウザ内で動作し、画像生成APIは使用しません。

**公開URL:** https://cadmium2525.github.io/rakugaking/

GitHub Pagesで起動・3D生成を確認済み。オンラインランキングは未設定、iPhone/Android実機は未検証です。

## 起動

Node.js 24.12以上を使用します。

```sh
npm ci
npm run dev
```

表示されたlocalhost URLを開きます。ビルド確認は `npm run build`、`npm run preview`。HTMLをファイルとして直接開かず、HTTPで配信してください。スマホでLAN内から確認するときは `npm run dev -- --host 0.0.0.0` を使い、端末からPCのLANアドレスへ接続します。

## 遊び方

- 「ラクガキする」で頭・胴体・左右の腕と脚を描く。色、消しゴム、パーツ消去、Undo/Redo、左右コピー、3Dプレビューを使用できます。「誕生させる」で操作できます。
- PC: WASD/矢印で移動、Spaceでジャンプ、EでACTION。スマホ: 左スティック、右のジャンプとACTION。横向き推奨。
- 冒険: 草原→強風→水没→崩壊遺跡→最終塔。ゴールして次のコースを解放。水没と塔の封印には近づいてACTION。
- レベルは1〜20。初回クリアと再走でEXPを獲得。大きさ・重量・脚や腕の長さが能力を決め、色は小さな補正になります。
- タイムアタック: 5ステージを同じキャラクター・開始時能力で通走。ロード時間を除き、ポーズと失敗の時間を含みます。タブが隠れた走行はランキング対象外。
- 一時停止からリトライ、ホーム、画質変更ができます。

## ホーム画面に追加・オフライン

[公開ゲーム](https://cadmium2525.github.io/rakugaking/)を開き、iPhoneはSafariの共有メニューから「ホーム画面に追加」、AndroidはChromeのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。表示名はブラウザによって異なります。PCの対応ブラウザでもインストールできます。

初回は通信が必要です。ゲームと必要ファイルの保存が終わると、ホーム画面からオフラインでも起動・作成・プレイできます。ランキングには通信が必要です。OSによるサイトデータ削除・容量不足時はオフライン利用できない場合があります。

更新はバックグラウンドで取得し、ゲームの全タブ・アプリ画面を閉じて再度開くと適用されます。プレイ中の強制再読み込みはしません。更新処理でキャラクターや進行の保存を消すことはありません。

manifest・Service Worker・192/512pxアイコン・Androidのmaskable・iPhone用180pxアイコンを同梱。[PWAの仕様](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)に沿った構成です。実機のホーム画面追加は未検証です。

## 保存とランキングの仕様

IndexedDBを優先し、使用不能ならlocalStorageへ保存します。キャラクター最大24体、進行、EXP、直近20件の有効な記録、ベストを保持します。走行途中の復元はしません。保存不能時は画面に通知します。ブラウザのサイトデータ削除で保存が失われます。

ランキングは独立した無料枠対応のWorkers＋D1バックエンドです。未設定・通信失敗でもゲームは遊べます。名前・タイム・レベル・キャラクター情報が公開対象です。匿名トークンで自分のベストを更新し、TOP100と自分の順位を表示します。[設定と検証仕様](backend/README.md)を参照してください。クライアントゲームのため巧妙な不正タイムの完全な検知はできません。

## GitHub Pages公開

1. 公開先リポジトリへこのプロジェクトをpushします。無料Pagesを使う場合は公開リポジトリを使用します。
2. Settings → Pages → Sourceを **GitHub Actions** に設定します。
3. main/masterへのpush、またはActionsの「Verify and deploy Pages」を手動実行します。
4. lint・単体テスト・ビルド・配信ビルド起動テストが成功後、distを公開します。
5. 発行URLで実機操作とランキングの本番接続を確認します。

Viteの相対baseによりリポジトリのサブパスへ配信できます。秘密鍵は不要です。ランキングendpointは `public/ranking-config.json` に公開HTTPS URLを設定して再ビルドします。GitHub操作は[公式Pages手順](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に準拠。masterブランチからのActions公開を確認済みです。

## 検証・構成

```sh
npm run lint
npm test
npm run build
npm run test:e2e
node tests/production-smoke.js
```

ローカルのブラウザテストはMicrosoft Edgeを使用します。E2Eが開発サーバー5186とランキングAPI8787を起動します。CIの配信ビルドテストはChromiumを使用します。

- Three.js: 押し出し形状・階層アニメーション・WebGL描画。
- Rapier compat 0.19.3: 固定60Hzの衝突とキャラクター移動。バージョン固定理由はQAに記載。
- Vite: 開発・静的ビルド。Playwright、Node test、ESLint、Prettier: 開発用。
- `src/core`: 形状・能力・物理・保存・時計。`src/game`: コース・描画。`src/ui`: エディタ・操作。`backend`: 任意のランキング。

[検証結果と既知の制限](docs/QA.md) / [開発フェーズ記録](docs/DEVELOPMENT.md)

今後の候補: 実機での負荷調整、ジャンプ型のショートカット、リプレイと不正記録検証、追加コース。
