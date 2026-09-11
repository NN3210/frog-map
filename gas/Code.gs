/**
 * カエル見つけたマップ — Google Apps Script（コンテナバインド版）
 *
 * 使い方：スプレッドシート「拡張機能 → Apps Script」でこのファイルの内容を
 * 貼り付け、setup() を一度手動実行してからウェブアプリとしてデプロイする。
 * 手順は gas/README.md を参照。
 *
 * 設計の正：docs/DESIGN.md（特に §3.1, §3.2, §3.3）
 */

// ============================================================
// CONFIG（config/species.json と手動で同期すること。ここを変えたら
// フロント側の config/species.json / config/map.json も揃えること）
// ============================================================

var SHEET_NAME = "records";

// config/species.json の "code" 一覧と手動で同期すること
var SPECIES_CODES = [
  "amagaeru",
  "tonosama",
  "ezoaka",
  "hikigaeru",
  "tsuchigaeru",
  "ushigaeru",
  "unknown"
];

var COUNT_CATEGORIES = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "many", "few", "unknown"
];

var METHODS = ["seen", "heard", "both"];

var CONFIDENCES = ["high", "medium", "low"];

var HABITATS = [
  "paddy", "ditch_river", "pond", "forest_grass", "road_residential", "other"
];

// 北海道を覆う矩形 [[minLat, minLng], [maxLat, maxLng]]（config/map.json の areaBounds と同期）
var AREA_BOUNDS = [[41.3, 139.3], [45.6, 146.0]];

var ROUND_DECIMALS = 4;   // 保存時の丸め桁（約10m精度）
var PUBLIC_DECIMALS = 3;  // 公開ピン配信時の丸め桁（約100m精度）
var COMMENT_MAX = 100;    // ひとことの最大文字数
var DUPLICATE_WINDOW_MS = 120000;   // 重複判定の時間窓（2分）
var DUPLICATE_LOOKBACK_ROWS = 50;   // 重複判定で遡る行数
var GAS_VERSION = "1.0.0";

// スプレッドシートの列順（docs/DESIGN.md §3.1 のとおり）
var COLUMNS = [
  "submitted_at",
  "record_id",
  "lat",
  "lng",
  "species_code",
  "observed_year",
  "observed_month",
  "observed_day",
  "observed_date_text",
  "count_category",
  "method",
  "confidence",
  "habitat",
  "comment",
  "source",
  "app_version",
  "review_status"
];

// ============================================================
// セットアップ（手動で1回だけ実行する）
// ============================================================

/**
 * 「records」シートが無ければ作成し、1行目に列名を書いて固定・太字にする。
 * Apps Script エディタで setup を選んで「実行」する。
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  var headerRange = sheet.getRange(1, 1, 1, COLUMNS.length);
  headerRange.setValues([COLUMNS]);
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

// ============================================================
// エントリーポイント（doPost / doGet）
// ============================================================

/**
 * 投稿の受け口。フロントは Content-Type: text/plain で JSON 文字列を POST する
 * （プリフライトを避けるため）。IP・User-Agent・e.parameter の余計な値は
 * 一切保存しない。
 */
function doPost(e) {
  try {
    var now = new Date();

    var input;
    try {
      input = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOutput_({ ok: false, error: "bad_json" });
    }

    // ハニーポット：埋まっていても保存せず、ボットには成功したように見せる
    if (input && input.website) {
      return jsonOutput_({ ok: true, record_id: Utilities.getUuid() });
    }

    // 受付期間チェック（JST で当日終わりまで受付）
    var acceptUntil = PropertiesService.getScriptProperties().getProperty("ACCEPT_UNTIL");
    if (acceptUntil) {
      var deadline = new Date(acceptUntil + "T23:59:59+09:00");
      if (now.getTime() > deadline.getTime()) {
        return jsonOutput_({ ok: false, error: "closed" });
      }
    }

    var validated = validateRecord(input, now);
    var record = validated.record;
    var reviewStatus = validated.review_status;

    var sheet = getSheet_();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (reviewStatus === "unreviewed") {
        if (isDuplicate_(sheet, record, now)) {
          reviewStatus = "suspect_duplicate";
        }
      }

      record.submitted_at = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd'T'HH:mm:ssXXX");
      record.record_id = Utilities.getUuid();
      record.review_status = reviewStatus;

      var rowValues = COLUMNS.map(function (col) {
        var v = record[col];
        return v === undefined || v === null ? "" : v;
      });
      sheet.appendRow(rowValues);
    } finally {
      lock.releaseLock();
    }

    CacheService.getScriptCache().remove("pins");

    return jsonOutput_({ ok: true, record_id: record.record_id });
  } catch (err) {
    return jsonOutput_({ ok: false, error: "server_error" });
  }
}

/**
 * action=pins → 公開ピン一覧（未審査・重複疑いのみ、座標は PUBLIC_DECIMALS 丸め）
 * action=ping または指定なし → 疎通確認
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === "pins") {
      return jsonOutput_(getPins_());
    }
    var acceptUntil = PropertiesService.getScriptProperties().getProperty("ACCEPT_UNTIL");
    return jsonOutput_({ ok: true, version: GAS_VERSION, accept_until: acceptUntil || null });
  } catch (err) {
    return jsonOutput_({ ok: false, error: "server_error" });
  }
}

// ============================================================
// GAS 依存のヘルパー（Node からは呼ばれない）
// ============================================================

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('"' + SHEET_NAME + '" シートがありません。setup() を先に実行してください。');
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 直近 DUPLICATE_LOOKBACK_ROWS 行の中に、lat/lng/species_code/
 * observed_date_text/count_category が完全一致し、submitted_at が
 * DUPLICATE_WINDOW_MS 以内の行があれば true。
 */
function isDuplicate_(sheet, record, now) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  var startRow = Math.max(2, lastRow - DUPLICATE_LOOKBACK_ROWS + 1);
  var numRows = lastRow - startRow + 1;
  var values = sheet.getRange(startRow, 1, numRows, COLUMNS.length).getValues();

  var submittedAtIdx = COLUMNS.indexOf("submitted_at");
  var latIdx = COLUMNS.indexOf("lat");
  var lngIdx = COLUMNS.indexOf("lng");
  var speciesIdx = COLUMNS.indexOf("species_code");
  var dateTextIdx = COLUMNS.indexOf("observed_date_text");
  var countIdx = COLUMNS.indexOf("count_category");

  var nowMs = now.getTime();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (row[latIdx] !== record.lat) continue;
    if (row[lngIdx] !== record.lng) continue;
    if (String(row[speciesIdx]) !== String(record.species_code)) continue;
    if (String(row[dateTextIdx]) !== String(record.observed_date_text)) continue;
    if (String(row[countIdx]) !== String(record.count_category)) continue;

    var rowTime = new Date(row[submittedAtIdx]).getTime();
    if (isNaN(rowTime)) continue;
    if (Math.abs(nowMs - rowTime) <= DUPLICATE_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

/**
 * 公開ピン一覧を作る（review_status が unreviewed / suspect_duplicate のみ）。
 * CacheService に 60 秒キャッシュ（100KB を超える場合はキャッシュを省略）。
 */
function getPins_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("pins");
  if (cached) {
    return JSON.parse(cached);
  }

  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var pins = [];

  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
    var latIdx = COLUMNS.indexOf("lat");
    var lngIdx = COLUMNS.indexOf("lng");
    var speciesIdx = COLUMNS.indexOf("species_code");
    var dateTextIdx = COLUMNS.indexOf("observed_date_text");
    var statusIdx = COLUMNS.indexOf("review_status");

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var status = row[statusIdx];
      if (status !== "unreviewed" && status !== "suspect_duplicate") continue;

      var lat = row[latIdx];
      var lng = row[lngIdx];
      if (lat === "" || lng === "" || lat === null || lng === null) continue;

      pins.push({
        lat: roundTo(Number(lat), PUBLIC_DECIMALS),
        lng: roundTo(Number(lng), PUBLIC_DECIMALS),
        species_code: row[speciesIdx] || "",
        ym: extractYm(row[dateTextIdx])
      });
    }
  }

  var json = JSON.stringify(pins);
  if (json.length <= 100000) {
    try {
      cache.put("pins", json, 60);
    } catch (cacheErr) {
      // 100KB 超過などキャッシュに失敗しても無視して結果は返す
    }
  }

  return pins;
}

// ============================================================
// 純粋関数（GAS の API を呼ばない。Node の vm からも読み込める）
// ============================================================

/**
 * 投稿内容を検証・正規化する。GAS 固有 API は一切使わない。
 * @param {Object} input JSON.parse 済みの投稿内容
 * @param {Date} now 現在時刻
 * @return {{record: Object, review_status: string}}
 */
function validateRecord(input, now) {
  input = input || {};
  var invalid = false;

  // --- lat / lng ---
  var rawLat = input.lat;
  var rawLng = input.lng;
  var latOk = typeof rawLat === "number" && isFinite(rawLat) && rawLat >= -90 && rawLat <= 90;
  var lngOk = typeof rawLng === "number" && isFinite(rawLng) && rawLng >= -180 && rawLng <= 180;

  var lat, lng;
  if (!latOk || !lngOk) {
    invalid = true;
    lat = "";
    lng = "";
  } else {
    lat = roundTo(rawLat, ROUND_DECIMALS);
    lng = roundTo(rawLng, ROUND_DECIMALS);
  }

  // --- 選択肢項目（空は許可、選択肢外はその項目を空にしてレコード全体を invalid に） ---
  var species = validateOption_(input.species_code, SPECIES_CODES);
  var count = validateOption_(input.count_category, COUNT_CATEGORIES);
  var method = validateOption_(input.method, METHODS);
  var confidence = validateOption_(input.confidence, CONFIDENCES);
  var habitat = validateOption_(input.habitat, HABITATS);
  if (species.invalid || count.invalid || method.invalid || confidence.invalid || habitat.invalid) {
    invalid = true;
  }

  // --- 観察時期 ---
  var date = buildObservedDateText(input, now);
  if (date.invalid) {
    invalid = true;
  }

  // --- ひとこと（改行はスペースに、先頭100文字） ---
  var comment = String(input.comment === undefined || input.comment === null ? "" : input.comment)
    .replace(/\r\n|\r|\n/g, " ")
    .slice(0, COMMENT_MAX);

  // --- source ---
  var source = (typeof input.source === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(input.source))
    ? input.source
    : "unknown";

  // --- app_version ---
  var appVersion = String(input.app_version === undefined || input.app_version === null ? "" : input.app_version)
    .slice(0, 32);

  // --- review_status（優先順位：invalid > out_of_area > unreviewed） ---
  var reviewStatus;
  if (invalid) {
    reviewStatus = "invalid";
  } else if (!isInArea(lat, lng)) {
    reviewStatus = "out_of_area";
  } else {
    reviewStatus = "unreviewed";
  }

  var record = {
    submitted_at: "",
    record_id: "",
    lat: lat,
    lng: lng,
    species_code: species.value,
    observed_year: date.year,
    observed_month: date.month,
    observed_day: date.day,
    observed_date_text: date.dateText,
    count_category: count.value,
    method: method.value,
    confidence: confidence.value,
    habitat: habitat.value,
    comment: comment,
    source: source,
    app_version: appVersion,
    review_status: reviewStatus
  };

  return { record: record, review_status: reviewStatus };
}

/**
 * 選択肢項目を検証する。空（undefined/null/""）は許可、選択肢外は
 * 値を空文字にして invalid フラグを立てる。
 */
function validateOption_(value, allowed) {
  if (value === undefined || value === null || value === "") {
    return { value: "", invalid: false };
  }
  if (allowed.indexOf(value) === -1) {
    return { value: "", invalid: true };
  }
  return { value: value, invalid: false };
}

/**
 * observed_year / observed_month / observed_day を検証し、
 * observed_date_text を構成する。
 *   - observed_year === "before" → 全て空、dateText = "before_" + (今年-10)
 *   - observed_year が空 → 全て空、dateText = ""
 *   - observed_year が 1900..今年 の整数以外 → invalid
 *   - observed_month は 1..12（空可。年が空なら月日も空扱い）
 *   - observed_day はその月の末日まで（空可。月が空なら日も空扱い）
 *   - 未来（now より後）→ invalid
 */
function buildObservedDateText(input, now) {
  var nowYear = now.getFullYear();
  var nowMonth = now.getMonth() + 1;
  var nowDay = now.getDate();

  // フロントは number で送るが、数字文字列（"2026"）も受け付ける
  var rawYear = toIntOrRaw_(input.observed_year);

  if (rawYear === "before") {
    return { year: "", month: "", day: "", dateText: "before_" + (nowYear - 10), invalid: false };
  }

  if (rawYear === undefined || rawYear === null || rawYear === "") {
    return { year: "", month: "", day: "", dateText: "", invalid: false };
  }

  if (typeof rawYear !== "number" || !isFinite(rawYear) || Math.floor(rawYear) !== rawYear) {
    return { year: "", month: "", day: "", dateText: "", invalid: true };
  }
  var year = rawYear;
  if (year < 1900 || year > nowYear) {
    return { year: "", month: "", day: "", dateText: "", invalid: true };
  }

  var invalid = false;
  var month = "";
  var rawMonth = toIntOrRaw_(input.observed_month);
  if (rawMonth !== undefined && rawMonth !== null && rawMonth !== "") {
    if (typeof rawMonth !== "number" || !isFinite(rawMonth) || Math.floor(rawMonth) !== rawMonth ||
        rawMonth < 1 || rawMonth > 12) {
      invalid = true;
    } else {
      month = rawMonth;
      if (year === nowYear && month > nowMonth) {
        invalid = true;
      }
    }
  }

  var day = "";
  if (!invalid && month !== "") {
    var rawDay = toIntOrRaw_(input.observed_day);
    if (rawDay !== undefined && rawDay !== null && rawDay !== "") {
      var lastDay = new Date(year, month, 0).getDate();
      if (typeof rawDay !== "number" || !isFinite(rawDay) || Math.floor(rawDay) !== rawDay ||
          rawDay < 1 || rawDay > lastDay) {
        invalid = true;
      } else {
        day = rawDay;
        if (year === nowYear && month === nowMonth && day > nowDay) {
          invalid = true;
        }
      }
    }
  }

  if (invalid) {
    return { year: "", month: "", day: "", dateText: "", invalid: true };
  }

  var dateText = "";
  if (year !== "") {
    if (month === "") {
      dateText = String(year);
    } else if (day === "") {
      dateText = year + "-" + pad2_(month);
    } else {
      dateText = year + "-" + pad2_(month) + "-" + pad2_(day);
    }
  }

  return { year: year, month: month, day: day, dateText: dateText, invalid: false };
}

/** "2026" のような数字だけの文字列は数値に変換し、それ以外はそのまま返す */
function toIntOrRaw_(v) {
  if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  return v;
}

function pad2_(n) {
  return (n < 10 ? "0" : "") + n;
}

/** AREA_BOUNDS = [[minLat, minLng], [maxLat, maxLng]] の内側かどうか */
function isInArea(lat, lng) {
  var minLat = AREA_BOUNDS[0][0];
  var minLng = AREA_BOUNDS[0][1];
  var maxLat = AREA_BOUNDS[1][0];
  var maxLng = AREA_BOUNDS[1][1];
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/** 四捨五入で decimals 桁に丸める */
function roundTo(value, decimals) {
  var factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * observed_date_text の先頭7文字を年月として返す。
 * "2026-07-15" → "2026-07" / "2026" → "2026" / "before_2016" → "" / "" → ""
 */
function extractYm(text) {
  if (!text) return "";
  if (String(text).indexOf("before_") === 0) return "";
  return String(text).substring(0, 7);
}

// GAS には存在しない module を使って、Node (vm) からも純粋関数を読み込めるようにする。
// GAS 実行時は typeof module === "undefined" なのでこのブロックは無視される。
if (typeof module !== "undefined") {
  module.exports = {
    validateRecord: validateRecord,
    buildObservedDateText: buildObservedDateText,
    validateOption_: validateOption_,
    isInArea: isInArea,
    roundTo: roundTo,
    extractYm: extractYm
  };
}
