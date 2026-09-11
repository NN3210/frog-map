# 設計メモ — カエル見つけたマップ

- 版：v0.1（2026-09-11）　対応要件：`カエル見つけたマップ_要件定義.md` v0.1
- 目的：実装前に「画面遷移」「データ定義」「技術構成」「未決事項の既定値」を発注者と合意する。

---

## 1. 技術構成（確定案）

| 層 | 採用 | 理由 |
|---|---|---|
| フロント | **Vanilla JS + Leaflet 1.9**、esbuild で単一バンドル | フレームワーク不要の規模。Leaflet は JS 約42KB + CSS 約4KB（gzip）で 300KB 目標に余裕。esbuild は依存ゼロ・高速。 |
| 地図タイル | 地理院タイル 標準地図 `https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png` | 水田記号あり。出典表記「地理院タイル」を常時表示（[利用規約](https://maps.gsi.go.jp/development/ichiran.html) の「出典の記載」要件に対応）。 |
| ピン | Leaflet `circleMarker`（既投稿）＋ `divIcon`（仮ピン） | 画像アイコンを使わないので追加リクエストなし。種ごとに色分けは CSS のみ。 |
| バックエンド | Google Apps Script Web アプリ（`doPost` 受付 / `doGet` 公開ピン配信）＋スプレッドシート | 要件 6.1 のとおり。追加費用なし、CSV は標準機能。 |
| ホスティング | GitHub Pages（`dist/` を `gh-pages` ブランチへ） | 無料・静的。大学ドメインが使える場合は CNAME で対応可。 |
| QR | Python `segno`（純Python）で PNG/SVG、`reportlab` で印刷用 PDF | `?src=` 別に複数枚生成。 |
| エクスポート | Python `scripts/export.py`：シートから DL した CSV → GeoJSON / QGIS 用 CSV | Google API 認証不要（手動 DL した CSV を入力にする）。 |

**外部接続先はふたつだけ**：地理院タイル（画像）と GAS の URL（投稿・公開ピン取得）。JS/CSS は自前配信。

### プライバシー要件（第5章）への対応
- Geolocation / カメラ / Cookie / localStorage / sessionStorage：**一切使わない**（コードレビューで `navigator.geolocation`, `localStorage`, `document.cookie` の非出現を確認）。
- 送信失敗時の入力保持は **メモリ上のみ**（ページを閉じれば消える）。
- GAS 側で `e.parameter` の投稿本文以外（IP・UA は GAS でもそもそも取得不可）を保存しない。
- 座標丸めは **クライアント側と GAS 側の両方**で実施（設定 `roundDecimals`）。
- 公開ピン（doGet）は **位置・種・観察年月のみ**返す。`comment`・日・record_id は返さない。

---

## 2. 画面遷移

```
[QR読取] → ① トップ（地図全画面）
               │ 地図タップ
               ▼
            ② 投稿シート（ボトムシート、地図は背面に残る）
               │ 送信                        │ 閉じる
               ▼                             ▼
            ③ 完了画面 ──「もう1件」──→ ①（フォーム初期化、仮ピン消去）
               └「研究室のページを見る」→ 外部リンク（新規タブ）

①左下「使い方」 → ④ 使い方モーダル（3ステップ説明 ＋ プライバシー説明3行 ＋ 大学方針リンク）
```

### ① トップ
- 上部バナー：「地図をタップして、カエルを見た・聞いた場所を教えてください」
- 左下：「使い方」ボタン（44px 以上）。右下：Leaflet 標準の出典表示（「地理院タイル」リンク）。
- 「現在地」ボタンは設置しない。
- 起動時に `doGet` で公開ピンを取得して `circleMarker` 表示（設定で OFF 可）。取得失敗時は黙って非表示。

### ② 投稿シート（ボトムシート）
- 地図タップで仮ピン（ドラッグ可）を立て、下からせり上がる。シートは画面高さの最大 70%、内部スクロール。地図が上部に見えたままなので仮ピンを微調整できる。
- 見出し：「この場所でカエルを見た・聞いた」
- 項目順：種カード（横スクロール）→ 観察時期 → 個体数 → 確認方法 → 自信 →（環境）→（ひとこと）→ 送信ボタン
- 種カード：写真＋表示名＋補足1行。選択中は太枠＋チェック。「わからない」は「？」アイコン。カード長押し/詳細ボタンで拡大＋鳴き声再生（音源が `assets/sounds/<code>.mp3` にある場合のみボタン表示）。
- 観察時期：3段の `<select>`（年 → 月 → 日）。年は今年〜10年前＋「もっと前」（`before_YYYY` として保存せず、年のみ空・`observed_date_text = "before_2016"`）。月「不明」なら日は無効化。未来日は選択肢から除外。
- 送信中：ボタンをスピナー化・二重送信防止。失敗：赤帯「電波の良いところでもう一度お試しください」。入力はそのまま。
- ハニーポット：`<input name="website">` を `aria-hidden` + 視覚的に非表示で配置。

### ③ 完了画面
- 「ありがとうございました！」＋「もう1件投稿する」＋「研究室のページを見る」（設定 URL、空ならボタン非表示）。

### ④ 使い方モーダル
- 3ステップ（タップ → えらぶ → おくる）を文＋簡単な絵文字/アイコンで。
- プライバシー説明（案、3行）：
  > このアプリは、あなたの端末の情報（位置情報・写真・連絡先など）を取得・保存しません。
  > 投稿されるのは、地図でタップした場所と、フォームで選んだ内容だけです。
  > 投稿された場所は、研究のために保存され、精度を粗くした上で地図に表示されることがあります。
- 大学のプライバシー方針へのリンク（設定 URL）。同意ボタンは設定でON/OFF（既定 OFF）。

---

## 3. データ定義

### 3.1 スプレッドシート（1投稿＝1行、シート名 `records`）

| 列 | 型 | 付与元 | 備考 |
|---|---|---|---|
| submitted_at | ISO8601 JST (`2026-09-20T13:05:22+09:00`) | GAS | |
| record_id | UUID v4 | GAS | `Utilities.getUuid()` |
| lat, lng | number | クライアント→GAS で再丸め | `roundDecimals`（既定 4） |
| species_code | string | クライアント | `config/species.json` のコードのみ許可。空可 |
| observed_year / observed_month / observed_day | int | クライアント | 空可。GAS で未来日・範囲外を検証 |
| observed_date_text | string | GAS が再構成 | `2026` / `2026-07` / `2026-07-15` / `before_2016` / 空 |
| count_category | string | クライアント | `1`..`10`, `many`, `few`, `unknown`。空可 |
| method | string | | `seen` / `heard` / `both`。空可 |
| confidence | string | | `high` / `medium` / `low`。空可 |
| habitat | string | | `paddy` / `ditch_river` / `pond` / `forest_grass` / `road_residential` / `other`。空可 |
| comment | string | | 最大100文字（設定で欄自体を無効化可）。GAS でも切詰め |
| source | string | クライアント（`?src=`） | 既定 `festival_2026`。英数字・`_`・`-` のみ、32文字まで |
| app_version | string | クライアント | ビルド時に埋込 |
| review_status | string | GAS | `unreviewed` / `out_of_area` / `suspect_duplicate` / `invalid` |

- 選択肢は **コード値で保存**（分析しやすい）。表示ラベルはフロントの設定 JSON が持つ。
- 「保存しないもの」（IP, UA, Cookie 等）：GAS の `doPost` ではそもそも取得しないので実装上も混入しない。

### 3.2 GAS API

| メソッド | 用途 | 入出力 |
|---|---|---|
| `POST <exec URL>` | 投稿 | 本文：JSON 文字列を `Content-Type: text/plain`（プリフライト回避）。応答：`{ok:true, record_id}` または `{ok:false, error}`。 |
| `GET <exec URL>?action=pins` | 公開ピン | 応答：`[{lat, lng, species_code, ym}]`（`ym` = `YYYY-MM` or `YYYY` or 空）。`publicDecimals`（既定 3）で丸めて返す。キャッシュ `CacheService` 60秒。 |
| `GET <exec URL>?action=ping` | 疎通確認 | `{ok:true, version}` |

**サーバ側検証**
- 必須：`lat`, `lng` が数値。それ以外は空でも受理。
- 選択肢外の値 → その項目を空にして `review_status = invalid` は付けず、**丸ごと `invalid`** にする（改竄の痕跡として残す）。
- 北海道の矩形（`config/map.json` の `areaBounds`）外 → 保存して `out_of_area`。
- ハニーポットが埋まっている → 保存せず `{ok:true}` を返す（ボットに気づかせない）。
- 重複抑制：直近 50 行のうち、同一 `lat,lng,species_code,observed_date_text,count_category` かつ `submitted_at` が 2 分以内 → 保存して `suspect_duplicate`。
- 受付期間：`ACCEPT_UNTIL`（スクリプトプロパティ、空なら無期限）を過ぎたら `{ok:false, error:"closed"}`。
- 割り当て（2026-09 時点の公式値を実装時に再確認）：Web アプリの同時実行 30、URL Fetch 制限は関係なし、スプレッドシート書込は `LockService` で直列化。祭り規模（数百件/日）は問題なし。

### 3.3 設定ファイル

`config/map.json`
```json
{
  "center": [43.1961, 141.7759],
  "zoom": 10,
  "minZoom": 7,
  "maxZoom": 17,
  "areaBounds": [[41.3, 139.3], [45.6, 146.0]],
  "roundDecimals": 4,
  "publicDecimals": 3,
  "showPublicPins": true,
  "enableComment": false,
  "requireConsent": false,
  "gasUrl": "https://script.google.com/macros/s/XXXX/exec",
  "privacyPolicyUrl": "",
  "labPageUrl": "",
  "defaultSource": "festival_2026"
}
```

`config/species.json`（並び順＝表示順）
```json
[
  {"code":"amagaeru","name":"ヒガシニホンアマガエル","note":"小さくて緑や灰色。吸盤がある","color":"#2e9e4f"},
  {"code":"tonosama","name":"トノサマガエル／トウキョウダルマガエル","note":"見分けが難しいため1つにまとめる","color":"#7a5c2e"},
  {"code":"ezoaka","name":"エゾアカガエル","note":"北海道の在来種。早春に鳴く","color":"#d9532b"},
  {"code":"hikigaeru","name":"ヒキガエル","note":"大きく、いぼがある","color":"#5b4a3a"},
  {"code":"tsuchigaeru","name":"ツチガエル","note":"背中にいぼがある。水辺に多い","color":"#8a8f2e"},
  {"code":"ushigaeru","name":"ウシガエル","note":"とても大きい。「ヴォー」と低く鳴く","color":"#1f6f8b"},
  {"code":"unknown","name":"わからない","note":"","color":"#888888"}
]
```
- 写真：`assets/species/<code>.jpg`（無ければプレースホルダ `assets/species/_placeholder.svg` に種名を重ねる）。
- 音源：`assets/sounds/<code>.mp3`（存在すれば再生ボタン表示。存在確認はビルド時にリスト化）。

---

## 4. リポジトリ構成

```
app_frogMap/
  README.md
  package.json            esbuild のみ依存
  build.mjs               src → dist（config/assets をコピー、app_version 埋込）
  src/  index.html, main.js, map.js, form.js, api.js, ui.js, style.css
  config/ map.json, species.json
  assets/species/, assets/sounds/
  gas/Code.gs, gas/README.md（デプロイ手順）
  scripts/ export.py, make_qr.py, requirements.txt
  docs/ DESIGN.md（本書）, RUNBOOK.md, PRIVACY.md, CREDITS.md, qr/
  dist/                   ビルド成果物（git 管理外）
```

- GitHub Pages 用に **`app_frogMap` 自体を独立 git リポジトリ**にする（親 `frog` リポジトリとは分ける。親側は未コミット状態なので衝突しない）。

---

## 5. 未決事項（【要確認】）と既定値

実装はすべて設定値で切替可能にするため、**回答が後になっても手戻りは発生しない**。

| # | 事項 | 既定値（回答待ちの間） | 推奨 |
|---|---|---|---|
| 1 | 初期中心・ズーム | 岩見沢市役所 (43.1961, 141.7759)、zoom 10 | 会場が市内ならこのままで石狩・空知の水田帯が入る |
| 2 | 座標丸め | 保存 4桁（約10m）、公開表示 3桁（約100m） | 研究用途は 4桁、公開は 3桁の二段構え |
| 3 | 自由記述欄 | **設けない**（`enableComment:false`） | 個人情報混入リスクと 60 秒目標の両面で不要 |
| 4,5 | 種の補足文・正式名称 | 要件定義書の案をそのまま | `species.json` で差替え |
| 6 | プライバシー方針 URL・同意ボタン | URL 空（リンク非表示）、同意ボタン無し | 大学規程次第 |
| 7 | ホスティング | GitHub Pages | 大学ドメイン可なら CNAME |
| 8 | 受付期間 | 無期限 | GAS のスクリプトプロパティで後から設定可 |
| 9 | 完了画面リンク | 空（ボタン非表示） | |
| 10 | 既投稿ピンの公開表示 | **表示する**（3桁丸め） | 客寄せ効果があるため推奨 |
