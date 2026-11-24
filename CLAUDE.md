# カエル見つけたマップ — 作業メモ（Claude Code 用）

岩見沢の祭りで配る QR から開く、市民参加型カエル目撃投稿マップ。要件は `カエル見つけたマップ_要件定義.md`。

## まず読むもの
- `docs/DESIGN.md` — 設計判断・データ仕様・GAS API（変更時はここも更新する）
- `docs/RUNBOOK.md` — 当日運用手順
- `README.md` — セットアップ・コマンド一覧

## 公開先
- GitHub: https://github.com/NN3210/frog-map（public）
- 本番: https://nn3210.github.io/frog-map/ — `main` に push すると GitHub Actions が自動でビルド・公開（約1分）
- QR: `docs/qr/`（本番 URL + `?src=festival_2026`）。URL が変わらない限り作り直し不要

## 開発
- `npm run dev` → http://localhost:8000 （モック API で送信まで試せる。表示は1行だけで待機するのが正常）
- `npm run build` → `dist/`（300KB 上限のサイズチェック付き）
- GAS の検証ロジック: `node --test gas/test/validate.test.mjs`
- 写真を追加したら dev サーバーを再起動する（build.mjs が起動時に一覧を作る）

## 守ること（要件定義由来）
- Geolocation / カメラ / Cookie / localStorage / sessionStorage / 解析タグを使わない
- 外部接続は地理院タイルと GAS のみ。IP・UA を保存しない。座標は保存時に小数4桁に丸める。過去の投稿地点は非公開
- フロントと GAS の型契約は `docs/DESIGN.md` §3.1（年月日は数値、GAS 側は数字文字列も許容）

## 保存先
- GAS の公開 URL は `config/map.json`。専用シートの ID は GAS の `SPREADSHEET_ID` にある。運用手順は `gas/README.md`。
- `privacyPolicyUrl` / `labPageUrl` は任意。

## モデル使い分け（ユーザー指定）
設計・技術判断=Opus / まとまった実装=Sonnet / GAS の CORS・実機不具合で詰まったら Opus / 文言・色・種リスト変更=Haiku か Sonnet
