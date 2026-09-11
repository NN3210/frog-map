# クレジット・出典表記

「カエル見つけたマップ」が利用しているソフトウェア・素材の出典一覧です。公開前に内容を確認し、抜けがあれば追記してください。

---

## ソフトウェア

### Leaflet

- 用途：地図表示ライブラリ本体
- ライセンス：BSD 2-Clause License
- 配布元：https://leafletjs.com/
- 表記：`Leaflet | © Leaflet contributors`（画面上の地図出典表示に含める）

---

## 地図タイル

### 地理院タイル（国土地理院）

- 用途：背景地図（標準地図）
- タイルURL：`https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png`
- 利用規約：https://maps.gsi.go.jp/development/ichiran.html
- 出典表記：「地理院タイル」を画面上に常時表示する（Leaflet の attribution 欄）。
- 備考：申請不要・無償で利用可能だが、出典の記載が必須。地図タイルそのものの著作権は国土地理院に帰属する。

---

## 種の写真

現在は差し替え用の仮素材として、Wikimedia Commons の写真を使用しています。ライセンスは Commons API のメタデータで 2026-09-11 に確認しました。

| 種コード | 種 | Commonsファイル | 作者 | ライセンス |
|---|---|---|---|---|
| amagaeru | *Dryophytes leopardus*（ヒガシニホンアマガエル） | [File:Japanese tree frog (Hyla japonica), green.jpg](https://commons.wikimedia.org/wiki/File:Japanese_tree_frog_(Hyla_japonica),_green.jpg) | Warehadokuro | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| tonosama | *Pelophylax nigromaculatus*（トノサマガエル） | [File:Pelophylax nigromaculatus s1.JPG](https://commons.wikimedia.org/wiki/File:Pelophylax_nigromaculatus_s1.JPG) | Alpsdake | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| ezoaka | *Rana pirica*（エゾアカガエル） | [File:Rana pirica 228856699.jpg](https://commons.wikimedia.org/wiki/File:Rana_pirica_228856699.jpg) | Atsushi Nakajima | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| hikigaeru | *Bufo japonicus*（ヒキガエル） | [File:Bufo japonicus formosus s10.jpg](https://commons.wikimedia.org/wiki/File:Bufo_japonicus_formosus_s10.jpg) | Alpsdake | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| tsuchigaeru | *Glandirana rugosa*（ツチガエル） | [File:Glandirana rugosa.JPG](https://commons.wikimedia.org/wiki/File:Glandirana_rugosa.JPG) | Alpsdake | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| ushigaeru | *Lithobates catesbeianus*（ウシガエル） | [File:Lithobates catesbeianus bullfrog amphibian.jpg](https://commons.wikimedia.org/wiki/File:Lithobates_catesbeianus_bullfrog_amphibian.jpg) | Buchanan Bill, U.S. Fish and Wildlife Service | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) |

---

## 3Dモデル（参考）

- **既定の方針：研究室が撮影した写真を第一候補として使用する。**
- 発注者が参考として挙げた Sketchfab のコレクション
  （https://sketchfab.com/baxterbaxter/collections/frogs-701ddc5db18a40bcad2029777125f52e ）は
  **3Dモデルの集まり**であり、モデルごとに利用条件（CCライセンスの種類、クレジット表記の要否、非営利限定の有無など）が異なる。
- **本アプリで実際に使用する場合は、モデルごとに個別にライセンスを確認し、本ファイルに記載すること。**
  ライセンスが確認できない・不明なモデルは使用しない。

---

## 鳴き声音源

- 用途：種カード詳細表示時の再生ボタン（`assets/sounds/<code>.mp3`）
- 出典：研究室の録音を使用。
- ライセンス：研究室内部資料のため、本アプリの範囲内での利用に限定する（外部への二次配布は想定しない）。

---

## 更新履歴

- 2026-09-11：Wikimedia Commons の種写真6点とライセンス・作者情報を追加。
- 2026-09-11：雛形作成（Claude Code、GAS/スクリプト担当分）。素材の個別確認は未実施。写真・3Dモデルの差し替え時に本ファイルを必ず更新すること。
