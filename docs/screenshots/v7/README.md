# 7.0 ステージの特色：画面と操作記録

2026-10-06。画像は隔離したEdge headlessの実際のWebGL描画。静止画だけでプレイ感やスマートフォン実機の性能を断定しない。

## 改修前と失敗の保存

- `before/`：6.0の検証済み開始画面を変更前の比較用に複製。撮り直した7.0の画面ではない。
- `identity-critic-before-courier-fix/`：独立した通常キー操作で鳥が旗の支柱に止まった試行。位置sampleと停止画面を保持する。
- `identity-critic-after-courier-fix/`：風車未復旧で同じ経路を歩き、鳥が到着して紋章を受け取った追試。JSONには後続の街で屋台に直進した操縦失敗も含む。護送の実装不具合とは区別する。
- `identity-critic-before-city-route-fix/`：描画道の点 `(22,-7)` が家の内部に入っていた試行。家の衝突は正常だが、見せている道が通れない位置へ誘導していた。
- `identity-critic-defense-before-pressure-fix/`：初期案の20秒防衛はルール検証を通ったが、敵不在の計時が約13.55秒だった実操作。特色7/10で不合格とし、守る対象への攻撃と複数方向の襲撃に変更する根拠を残す。
- `identity-critic-after-city-route-fix/`：歩ける街路へ直し、別の歯車回収順から時計の修理と東の出口までクリアした記録。JSONの後半には、続く防衛へ近づく操縦が灯台の柱を直進し、正常な衝突で停止した試行が含まれる。
- `identity-critic-defense-after-pressure-fix/`：灯台への放置攻撃による失敗を確認し、再起動して2方向の3波を迎撃した記録。敵不在の割合は12.75ゲーム秒のattemptから算出し、最後の撃破と達成が同じsnapshotだったことを確認する。撮影やキー解放の遅延を最後の待ち時間へ算入しない。

独立批評は初期解放とEXP1500だけを保存データで用意し、その後は通常のキーボード入力と読み取り専用QA snapshotで進めた。全体テストの `field-driver` は使わない。テレポート、敵HPの変更、紋章の直接付与、物理の無効化を行わない。高EXPの評価条件と、単体テストによる初期能力・体型境界の到達性を混同しない。

## 単体の衝突検証との区別

`tests/courier.test.js` の批評座標再現は、位置を指定した隔離物理の回帰テスト。独立ブラウザの同じ経路による追試とは別の証拠である。街の道路テストも各区間の始点に初期spawnを用意する。閉鎖中の門は有効のまま両側の道路を分けて歩き、紋章による実際の門解放は別の攻略テストで確認する。

## 最終QAの画面

`after/` は最終コードを固定した一括ブラウザ検証の `test-results/expedition/` から保存した40ファイル。各地域の開始・390px縦・844px横・クリア、護送の同行と到着、排水前後、時計修理、防衛の開始・最後の波・成功を含む。独立批評とは異なり、共通の `field-driver` による通常キーの操縦を使う。進行中のHPやフラグ、位置は変更しない。初期解放とEXP1500は単独ステージのfixtureで用意する。

- 水庭の同じ地点：[排水前](after/stage-3-water-before.png) → [排水後](after/stage-3-water-after.png)。水門達成後に庭底・通路・真珠が現れる。撮影用の寄り道も通常の移動キーで歩く。
- [護送の到着](after/stage-2-courier-arrival.png) / [状態と直前入力](after/stage-2-courier-arrival.json)。
- [時計修理](after/stage-4-clock-repaired.png) / [状態と直前入力](after/stage-4-clock-repaired.json)。
- [防衛の最後の波](after/stage-5-defense-last-wave.png) → [成功](after/stage-5-defense-success.png) / [状態と直前入力](after/stage-5-defense-success.json)。
- [縦画面で地図を閉じた巡回タイマー](after/stage-4-timer-portrait.png)。

水庭before/afterのPNGにJSONは付かない。画面の前提・進行表示を、単体の状態検証および独立批評による画像照合と合わせて確認する。静止画を全クリアや時間変化の単独証拠にはしない。

[設計](../../STAGE_IDENTITIES.md) / [独立批評と採点](../../STAGE_IDENTITY_CRITIQUE.md) / [QA](../../QA.md)
