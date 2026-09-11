// node --test gas/test/
//
// gas/Code.gs は GAS 環境向けの .gs ファイルだが、GAS 固有 API を
// トップレベルで呼ばないように書かれているため、vm.runInNewContext で
// そのまま読み込んで validateRecord() を純粋関数としてテストできる。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, "..", "Code.gs"), "utf8");

function loadGas() {
  const sandbox = { module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "Code.gs" });
  return sandbox.module.exports;
}

const { validateRecord, buildObservedDateText, isInArea, roundTo, extractYm } = loadGas();

// 固定の「現在時刻」。テストが未来判定に依存しないよう now を明示的に渡す。
const NOW = new Date(2026, 8, 11, 12, 0, 0); // 2026-09-11 12:00 (月は0始まり)

test("正常系: 全項目ありで unreviewed になる", () => {
  const input = {
    lat: 43.1961,
    lng: 141.7759,
    species_code: "amagaeru",
    observed_year: 2026,
    observed_month: 7,
    observed_day: 15,
    count_category: "3",
    method: "seen",
    confidence: "high",
    habitat: "paddy",
    comment: "田んぼのそばで見た",
    source: "festival_2026",
    app_version: "1.0.0"
  };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "unreviewed");
  assert.equal(record.species_code, "amagaeru");
  assert.equal(record.observed_date_text, "2026-07-15");
  assert.equal(record.count_category, "3");
  assert.equal(record.method, "seen");
  assert.equal(record.confidence, "high");
  assert.equal(record.habitat, "paddy");
  assert.equal(record.comment, "田んぼのそばで見た");
  assert.equal(record.source, "festival_2026");
  assert.equal(record.app_version, "1.0.0");
});

test("全項目空で lat,lng のみ", () => {
  const input = { lat: 43.1, lng: 141.7 };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "unreviewed");
  assert.equal(record.species_code, "");
  assert.equal(record.observed_year, "");
  assert.equal(record.observed_month, "");
  assert.equal(record.observed_day, "");
  assert.equal(record.observed_date_text, "");
  assert.equal(record.count_category, "");
  assert.equal(record.method, "");
  assert.equal(record.confidence, "");
  assert.equal(record.habitat, "");
  assert.equal(record.comment, "");
  assert.equal(record.source, "unknown");
});

test("lat が文字列 → invalid、lat/lng は空になる", () => {
  const input = { lat: "43.1", lng: 141.7 };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "invalid");
  assert.equal(record.lat, "");
  assert.equal(record.lng, "");
});

test("lat/lng が範囲外 → invalid", () => {
  const input = { lat: 999, lng: 141.7 };
  const { review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "invalid");
});

test("species_code が選択肢外 → その項目を空にして invalid", () => {
  const input = { lat: 43.1, lng: 141.7, species_code: "kappa" };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "invalid");
  assert.equal(record.species_code, "");
});

test("count_category / method / confidence / habitat が選択肢外 → invalid", () => {
  for (const field of ["count_category", "method", "confidence", "habitat"]) {
    const input = { lat: 43.1, lng: 141.7, [field]: "invalid_value" };
    const { record, review_status } = validateRecord(input, NOW);
    assert.equal(review_status, "invalid", `${field} should invalidate the record`);
    assert.equal(record[field], "");
  }
});

test("北海道外（東京）→ out_of_area", () => {
  const input = { lat: 35.68, lng: 139.76 };
  const { review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "out_of_area");
});

test("未来日（来年）→ invalid", () => {
  const input = { lat: 43.1, lng: 141.7, observed_year: 2027 };
  const { review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "invalid");
});

test("未来日（今年の来月）→ invalid", () => {
  const input = { lat: 43.1, lng: 141.7, observed_year: 2026, observed_month: 10 };
  const { review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "invalid");
});

test("observed_year = 'before' → before_ 形式", () => {
  const input = { lat: 43.1, lng: 141.7, observed_year: "before" };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "unreviewed");
  assert.equal(record.observed_year, "");
  assert.equal(record.observed_month, "");
  assert.equal(record.observed_day, "");
  assert.equal(record.observed_date_text, "before_2016");
});

test("年のみ", () => {
  const input = { lat: 43.1, lng: 141.7, observed_year: 2025 };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "unreviewed");
  assert.equal(record.observed_date_text, "2025");
  assert.equal(record.observed_month, "");
  assert.equal(record.observed_day, "");
});

test("年＋月", () => {
  const input = { lat: 43.1, lng: 141.7, observed_year: 2026, observed_month: 5 };
  const { record, review_status } = validateRecord(input, NOW);
  assert.equal(review_status, "unreviewed");
  assert.equal(record.observed_date_text, "2026-05");
  assert.equal(record.observed_day, "");
});

test("丸め: 43.123456 → 43.1235 (小数第4位)", () => {
  const input = { lat: 43.123456, lng: 141.111111 };
  const { record } = validateRecord(input, NOW);
  assert.equal(record.lat, 43.1235);
  assert.equal(record.lng, 141.1111);
});

test("comment 150文字 → 100文字に切詰め", () => {
  const longComment = "あ".repeat(150);
  const input = { lat: 43.1, lng: 141.7, comment: longComment };
  const { record } = validateRecord(input, NOW);
  assert.equal(record.comment.length, 100);
});

test("comment の改行はスペースに置換される", () => {
  const input = { lat: 43.1, lng: 141.7, comment: "line1\nline2\r\nline3" };
  const { record } = validateRecord(input, NOW);
  assert.equal(record.comment, "line1 line2 line3");
});

test("source が不正な形式 → unknown", () => {
  const input = { lat: 43.1, lng: 141.7, source: "あいうえお!!" };
  const { record } = validateRecord(input, NOW);
  assert.equal(record.source, "unknown");
});

test("source が有効な形式 → そのまま保存", () => {
  const input = { lat: 43.1, lng: 141.7, source: "booth_a-day2" };
  const { record } = validateRecord(input, NOW);
  assert.equal(record.source, "booth_a-day2");
});

// --- 補助関数のユニットテスト ---

test("buildObservedDateText: 空年", () => {
  const result = buildObservedDateText({}, NOW);
  assert.equal(result.invalid, false);
  assert.equal(result.dateText, "");
});

test("isInArea: 境界値", () => {
  assert.equal(isInArea(41.3, 139.3), true);
  assert.equal(isInArea(45.6, 146.0), true);
  assert.equal(isInArea(41.29, 139.3), false);
  assert.equal(isInArea(45.6, 146.01), false);
});

test("roundTo", () => {
  assert.equal(roundTo(43.123456, 4), 43.1235);
  assert.equal(roundTo(43.1234, 3), 43.123);
});

test("extractYm", () => {
  assert.equal(extractYm("2026-07-15"), "2026-07");
  assert.equal(extractYm("2026"), "2026");
  assert.equal(extractYm("before_2016"), "");
  assert.equal(extractYm(""), "");
});

test("数字文字列の年月日も数値として受理する（フロント互換）", () => {
  const { record, review_status } = validateRecord(
    { lat: 43.2, lng: 141.8, observed_year: "2026", observed_month: "7", observed_day: "15" },
    new Date(2026, 8, 11)
  );
  assert.equal(review_status, "unreviewed");
  assert.equal(record.observed_date_text, "2026-07-15");
  assert.equal(record.observed_year, 2026);
});
