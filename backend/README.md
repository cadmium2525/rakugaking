# ランキング用バックエンド

ゲーム本体は静的配信。ランキングのみCloudflare Workers＋D1に接続します。既存Firebase設定がないため、課金必須のFunctionsや追加SDKは導入していません。

## ローカル実行

Node 24.12以上で `npm run ranking:dev`。127.0.0.1:8787で起動し、`.local/ranking.sqlite`へ保存。テストでは同じWorkerリクエストハンドラとSQLをNode内蔵SQLiteで実行します。Cloudflare実環境の検証を代替するものではありません。

## 本番設定（まだ未実施）

1. CloudflareのWorkers FreeとD1を用意する。`npx wrangler login`。
2. `npx wrangler d1 create rakuga-ranking`で返されたIDを`backend/wrangler.toml`の`database_id`に設定。
3. `ALLOWED_ORIGINS`をGitHub Pagesのorigin（例 `https://username.github.io`、パスなし）に設定。複数はカンマ区切り。
4. `npx wrangler d1 execute rakuga-ranking --remote --file=backend/schema.sql --config=backend/wrangler.toml`。
5. `npx wrangler deploy --config=backend/wrangler.toml`。
6. 発行されたWorkerのHTTPS URLを`public/ranking-config.json`の`endpoint`に設定し、ゲームを再ビルド・公開。
7. 本番で新規登録、別ブラウザ、TOP100、自分の順位、通信失敗を再確認。

有料プランへの自動切り替えは行いません。無料枠の上限到達時はランキングのみ停止する想定です。料金・上限は提供元で確認してください: [Workers Freeの制限](https://developers.cloudflare.com/workers/platform/limits/)、[D1料金](https://developers.cloudflare.com/d1/platform/pricing/)。

## API・保存・検証

- `POST /session`: 匿名トークン発行。ブラウザに保存、DBにはSHA-256のみ。
- `POST /scores`: Bearer token必須。自分のベストのみ更新。名前、バージョン、5区間、合計、レベル、形状から再計算した能力をサーバーで検証。
- `GET /scores`: 未フラグのTOP100。
- `GET /me`: 自分のベストと順位。同タイムは同順位。
- スコアは名前・キャラクター名・レベル・タイム・スプリット・能力・形状ハッシュ・バージョンを記録。
- 不正記録は`flagged=1`にすると表示と順位集計から除外。
- 匿名ID発行・登録にIP単位または利用者単位の時間制限。IPそのものは保存しない。

プレイがクライアント側なので、現実的な偽タイムや偽のレベルを完全には検知できません。リプレイ検証・サーバー発行の走行証明を将来追加できる構造です。サイトデータを消すと匿名IDも失われ、以前の自分の記録を編集できなくなります。管理者用秘密鍵はゲームに含めません。
