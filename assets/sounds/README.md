# 鳴き声音源の差し替え方法

- ファイル名を `config/species.json` の `code` に合わせて置くだけで自動的に使われます。
  例：`amagaeru.mp3`, `ezoaka.m4a`
- 対応拡張子：`mp3` / `m4a` / `ogg`（同じ code で複数ある場合は mp3 → m4a → ogg の順で最初に見つかったもの1つだけを使用）
- ファイルがある種だけ、種の詳細モーダルに再生ボタン（`<audio controls preload="none">`）が表示されます。無い種はボタン自体を出しません。
- 音源を追加・変更したら `npm run build`（または `npm run dev`）を実行し直してください（ビルド時に存在チェックして埋め込みます）。
