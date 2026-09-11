# カエル見つけたマップ

北海道岩見沢市のお祭りで、大学ブースから来場者に配布するQRコードから開く、市民参加型のカエル目撃情報収集Webアプリです。来場者はスマホでQRを読み、地図をタップして「カエルを見た・聞いた場所」を投稿できます（ログイン不要・端末情報は取得しません）。投稿は Google スプレッドシートに集まり、研究室が一括ダウンロードして目撃記録として利用します。詳しい要件は `カエル見つけたマップ_要件定義.md`、設計の正は `docs/DESIGN.md` を参照してください。

---

## リポジトリ構成

```
app_frogMap/
  README.md                 本ファイル
  package.json               フロントの依存関係（leaflet / esbuild）
  build.mjs                   src/ → dist/ のビルドスクリプト
  カエル見つけたマップ_要件定義.md   発注要件（第0章に読む順の指示あり）

  src/                        フロントエンド本体
    index.html, main.js, map.js, form.js, api.js, ui.js, style.css

  config/
    map.json                  初期座標・ズーム・対象範囲・各種URLなどの設定
    species.json               種リスト（表示順＝配列順）

  assets/
    species/                   種の写真（<code>.jpg など。README.md に差し替え方法）
    sounds/                    鳴き声音源（<code>.mp3 など。README.md に差し替え方法）

  gas/
    Code.gs                    投稿の受け口（Google Apps Script）
    README.md                  GAS デプロイ手順（このファイルから誘導）
    test/validate.test.mjs     検証ロジックの単体テスト（Node 標準テストランナー）

  scripts/
    export.py                  スプレッドシートCSV → QGIS用CSV/GeoJSON 変換
    make_qr.py                  配布用QRコード（PNG/SVG/印刷用PDF）生成
    requirements.txt            上記2スクリプトの Python 依存関係
    sample/records_sample.csv   export.py の動作確認用サンプルCSV

  docs/
    DESIGN.md                  設計メモ（画面遷移・データ定義・技術構成の正）
    RUNBOOK.md                  祭り当日の運用手順
    PRIVACY.md                  プライバシー説明文（アプリ内表示版・掲示物版・実装根拠）
    CREDITS.md                  ソフトウェア・地図タイル・素材のクレジット一覧
    qr/                          生成したQRコード（PNG/SVG/PDF）

  .github/workflows/deploy.yml  GitHub Pages への自動デプロイ

  dist/                        ビルド成果物（git 管理外。npm run build で生成）
```

---

## セットアップ手順

研究室で最初に環境を用意し、本番公開するまでの手順です。上から順番に進めてください。

### 1. 依存関係のインストール

Node.js（18以上、推奨20以上）が入っている PC で実行します。

```bash
npm install
```

### 2. GAS（投稿の受け口）をデプロイする

投稿データを受け取る Google Apps Script Web アプリを用意します。手順は **`gas/README.md`** に番号順で書いてあります。完了すると `https://script.google.com/macros/s/xxxx/exec` の形式のURLが手に入ります。

### 3. `config/map.json` を設定する

`gas/README.md` の手順2で得たURLと、必要な他のURLを設定します。

```bash
# config/map.json の例（詳細は「設定ファイルで変えられること」表を参照）
{
  "gasUrl": "https://script.google.com/macros/s/xxxx/exec",
  "privacyPolicyUrl": "",
  "labPageUrl": ""
}
```

### 4. 種の写真・鳴き声を差し替える

- 写真：`assets/species/<code>.jpg`（対応拡張子・優先順位は `assets/species/README.md` を参照）
- 音源：`assets/sounds/<code>.mp3`（対応拡張子・優先順位は `assets/sounds/README.md` を参照）
- コード一覧は `config/species.json` の `code` 列。ファイルが無い種は自動でプレースホルダ表示になります。

### 5. ビルドしてサイズを確認する

```bash
npm run build
npm run size
```

`npm run size` は JS+CSS 合計が 300KB を超えていないかを自動でチェックします（超えた場合は非ゼロ終了）。

### 6. GitHub Pages へデプロイする

1. GitHub の対象リポジトリで **Settings → Pages → Source** を「**GitHub Actions**」に変更する（最初の1回だけ）。
2. `main` ブランチに push すると `.github/workflows/deploy.yml` が自動でビルドし、GitHub Pages に公開する。
3. 公開URL（`https://<ユーザー名>.github.io/<リポジトリ名>/` の形式）を手順3の `gasUrl` 同様に控えておく（QR生成・`labPageUrl` 等で使う）。

### 7. QRコードを生成する

本番URLが決まったら、配布用QRコードを作ります。

```bash
python -m pip install -r scripts/requirements.txt
python scripts/make_qr.py --url "https://<ユーザー名>.github.io/<リポジトリ名>/" --src festival_2026 --out-dir docs/qr --title "カエル見つけたマップ"
```

`docs/qr/` に PNG・SVG・印刷用PDFが出力されます。ブース別・日別に分けたい場合は `--src booth_a,booth_b` のようにカンマ区切りで複数指定できます。

### 8. データを取得する

祭り当日〜終了後、投稿データを取得する手順です。詳しくは `gas/README.md` §8、当日の運用は `docs/RUNBOOK.md` を参照してください。

```bash
python scripts/export.py <スプレッドシートからダウンロードしたCSV> --out-dir output
```

UTF-8 BOM付きCSV（`records_qgis.csv`、Excelで文字化けしない）と GeoJSON（`records.geojson`）が `output/` に出力されます。

---

## コマンド一覧

| コマンド | 内容 |
|---|---|
| `npm install` | 依存関係（leaflet, esbuild）のインストール |
| `npm run build` | `src/` → `dist/` を本番ビルド（minify・ソースマップ別ファイル） |
| `npm run dev` | 開発用ビルド。ファイル監視＋ `http://localhost:8000` でローカルサーバ起動 |
| `npm run size` | ビルドした上で `dist/app.js` + `dist/app.css` の合計サイズ（raw/gzip）を表示し、300KB上限をチェック |
| `node --test gas/test/validate.test.mjs` | GAS の投稿検証ロジック（`validateRecord` 等）の単体テスト |
| `python scripts/export.py <csv> [--out-dir DIR] [--exclude-status a,b] [--only-source SRC]` | スプレッドシートCSV → QGIS用CSV / GeoJSON 変換 |
| `python scripts/make_qr.py --url URL [--src a,b] [--out-dir DIR] [--title TITLE]` | 配布用QRコード（PNG/SVG/印刷用PDF）生成 |

Python スクリプトを使う前に `python -m pip install -r scripts/requirements.txt` を一度実行してください（`segno`, `reportlab` を使用）。

---

## 設定ファイルで変えられること

### `config/map.json`

| キー | 意味 |
|---|---|
| `center` | 地図の初期中心座標 `[緯度, 経度]` |
| `zoom` | 地図の初期ズームレベル |
| `minZoom` / `maxZoom` | ピンチ・ドラッグで動かせるズーム範囲 |
| `areaBounds` | 「対象範囲」の矩形 `[[南西の緯度,経度],[北東の緯度,経度]]`。この外の投稿は保存はされるが `review_status = out_of_area` になる。**`gas/Code.gs` の `AREA_BOUNDS` と手動で同期すること** |
| `roundDecimals` | 保存時の緯度経度の丸め桁数（既定4＝約10m精度） |
| `publicDecimals` | 公開ピン配信（`?action=pins`）時の丸め桁数（既定3＝約100m精度） |
| `showPublicPins` | 起動時に既投稿ピン（位置・種・観察年月のみ）を地図に表示するか |
| `enableComment` | 投稿フォームに「ひとこと」自由記述欄を出すか（既定 false） |
| `requireConsent` | 使い方モーダルに同意ボタンを出すか |
| `gasUrl` | GAS ウェブアプリのURL（`gas/README.md` の手順3で発行） |
| `privacyPolicyUrl` | 大学のプライバシー方針ページのURL（空ならリンク非表示） |
| `labPageUrl` | 完了画面「研究室のページを見る」リンク先（空ならボタン非表示） |
| `defaultSource` | 投稿の `source` 列の既定値。URLパラメータ `?src=` で上書き可能 |

### `config/species.json`

配列の並び順がそのまま種カードの表示順になります。各要素の項目：

| 項目 | 意味 |
|---|---|
| `code` | 種の識別コード（写真・音源のファイル名、スプレッドシートの `species_code` 列に使う。**`gas/Code.gs` の `SPECIES_CODES` と手動で同期すること**） |
| `name` | 表示名 |
| `note` | カード下の補足1行 |
| `color` | 公開ピン表示時のアイコン色 |

---

## `docs/` 内の文書

| 文書 | 内容 |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | 設計メモ。画面遷移・データ定義（スプレッドシート列・GAS API）・技術構成の正 |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | 祭り当日の運用手順（前日まで／当日／障害時／祭り後） |
| [docs/PRIVACY.md](docs/PRIVACY.md) | プライバシー説明文（アプリ内表示・掲示物用・実装上の根拠） |
| [docs/CREDITS.md](docs/CREDITS.md) | ソフトウェア・地図タイル・素材のクレジット一覧 |
| [gas/README.md](gas/README.md) | GAS（投稿の受け口）のデプロイ・再デプロイ・受付終了日設定の手順 |
| [assets/species/README.md](assets/species/README.md) | 種の写真の差し替え方法 |
| [assets/sounds/README.md](assets/sounds/README.md) | 鳴き声音源の差し替え方法 |
