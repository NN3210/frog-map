// form.js — 投稿シートの中身（種カード・観察時期・各プルダウン・送信）
import { $, escapeHtml, showSpeciesDetail, showError, hideError, setSubmitting } from './ui.js';
import { roundTo, resolveSource, submitRecord } from './api.js';

const ERROR_MESSAGES = {
  closed: '投稿の受付は終了しました',
  not_configured: '送信先が未設定です（管理者向け）',
  network: '保存を確認できませんでした。この画面を閉じずに、電波の良いところでもう一度送ってください。',
  server_error: '保存先を確認できませんでした。時間をおいて再送してください。続く場合は係員にお知らせください。',
  http_error: '電波の良いところでもう一度お試しください',
  unknown: '電波の良いところでもう一度お試しください',
  invalid: '入力内容を確認して、もう一度送ってください。'
};

let selectedSpeciesCode = '';
let speciesList = [];
let speciesAssets = {};

/* ---------- 種カード ---------- */

function renderSpeciesCards() {
  const container = $('species-cards');
  container.innerHTML = '';
  for (const sp of speciesList) {
    const asset = speciesAssets[sp.code] || {};
    const card = document.createElement('div');
    card.className = 'species-card';
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('tabindex', '0');
    card.dataset.code = sp.code;

    const thumb = document.createElement('div');
    if (asset.image) {
      thumb.className = 'species-thumb';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = sp.name;
      img.src = `./assets/species/${asset.image}`;
      thumb.appendChild(img);
    } else {
      thumb.className = 'species-thumb placeholder' + (sp.code === 'unknown' ? ' unknown' : '');
      thumb.textContent = sp.code === 'unknown' ? '？' : sp.name;
    }
    card.appendChild(thumb);

    const name = document.createElement('div');
    name.className = 'species-name';
    name.textContent = sp.name;
    card.appendChild(name);

    if (sp.note) {
      const note = document.createElement('div');
      note.className = 'species-note';
      note.textContent = sp.note;
      card.appendChild(note);
    }

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'species-detail-btn';
    detailBtn.textContent = 'くわしく';
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSpeciesDetail(sp, asset);
    });
    card.appendChild(detailBtn);

    const badge = document.createElement('span');
    badge.className = 'check-badge';
    badge.textContent = '✓';
    badge.setAttribute('aria-hidden', 'true');
    card.appendChild(badge);

    card.addEventListener('click', () => selectSpecies(sp.code));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSpecies(sp.code);
      }
    });

    container.appendChild(card);
  }
}

function selectSpecies(code) {
  selectedSpeciesCode = code;
  $('species-cards').querySelectorAll('.species-card').forEach((el) => {
    const checked = el.dataset.code === code;
    el.setAttribute('aria-checked', checked ? 'true' : 'false');
  });
}

/* ---------- 観察時期セレクト ---------- */

const YEAR_BACK = 10;

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function populateYearSelect() {
  const sel = $('obs-year');
  sel.innerHTML = '';
  const now = new Date();
  const currentYear = now.getFullYear();

  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = '未選択';
  sel.appendChild(optEmpty);

  for (let y = currentYear; y >= currentYear - YEAR_BACK; y--) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = `${y}年`;
    sel.appendChild(opt);
  }

  const optBefore = document.createElement('option');
  optBefore.value = 'before';
  optBefore.textContent = 'もっと前';
  sel.appendChild(optBefore);
}

function populateMonthSelect() {
  const yearSel = $('obs-year');
  const monthSel = $('obs-month');
  const yearVal = yearSel.value;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  monthSel.innerHTML = '';
  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = '未選択';
  monthSel.appendChild(optEmpty);

  if (!yearVal || yearVal === 'before') {
    optEmpty.textContent = yearVal === 'before' ? '—' : '先に年';
    monthSel.value = '';
    monthSel.disabled = true;
    return;
  }
  monthSel.disabled = false;

  const maxMonth = Number(yearVal) === currentYear ? currentMonth : 12;
  for (let m = 1; m <= maxMonth; m++) {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = `${m}月`;
    monthSel.appendChild(opt);
  }
}

function populateDaySelect() {
  const yearSel = $('obs-year');
  const monthSel = $('obs-month');
  const daySel = $('obs-day');
  const yearVal = yearSel.value;
  const monthVal = monthSel.value;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  daySel.innerHTML = '';
  const optEmpty = document.createElement('option');
  optEmpty.value = '';
  optEmpty.textContent = '未選択';
  daySel.appendChild(optEmpty);

  if (!yearVal || yearVal === 'before' || !monthVal) {
    optEmpty.textContent = yearVal === 'before' ? '—' : '先に月';
    daySel.value = '';
    daySel.disabled = true;
    return;
  }
  daySel.disabled = false;

  const y = Number(yearVal);
  const m = Number(monthVal);
  let maxDay = daysInMonth(y, m);
  if (y === currentYear && m === currentMonth) {
    maxDay = Math.min(maxDay, currentDay);
  }
  for (let d = 1; d <= maxDay; d++) {
    const opt = document.createElement('option');
    opt.value = String(d);
    opt.textContent = `${d}日`;
    daySel.appendChild(opt);
  }
}

function initDateSelects() {
  populateYearSelect();
  populateMonthSelect();
  populateDaySelect();

  $('obs-year').addEventListener('change', () => {
    populateMonthSelect();
    populateDaySelect();
  });
  $('obs-month').addEventListener('change', () => {
    populateDaySelect();
  });
}

function resetDateSelects() {
  $('obs-year').value = '';
  populateMonthSelect();
  populateDaySelect();
}

/* ---------- ひとこと欄（enableComment） ---------- */

function initCommentField(mapConfig) {
  $('comment-field').hidden = !mapConfig.enableComment;
}

/* ---------- ペイロード ---------- */

/** select の値を数値に。空は ''、'before' はそのまま（GAS 側の契約: DESIGN §3.1） */
function dateValue(id) {
  const v = $(id).value;
  if (v === '' || v === 'before') return v;
  return Number(v);
}

function buildPayload(latlng, mapConfig) {
  return {
    lat: roundTo(latlng.lat, mapConfig.roundDecimals),
    lng: roundTo(latlng.lng, mapConfig.roundDecimals),
    species_code: selectedSpeciesCode || '',
    observed_year: dateValue('obs-year'),
    observed_month: dateValue('obs-month'),
    observed_day: dateValue('obs-day'),
    count_category: $('count-category').value,
    method: $('method').value,
    confidence: $('confidence').value,
    habitat: $('habitat').value,
    comment: mapConfig.enableComment ? $('comment').value.slice(0, 100) : '',
    source: resolveSource(mapConfig.defaultSource),
    app_version: __APP_VERSION__,
    website: Boolean($('website').value)
  };
}

/* ---------- 公開 API ---------- */

export function initForm(config, callbacks) {
  speciesList = config.species;
  speciesAssets = config.speciesAssets || {};
  renderSpeciesCards();
  initDateSelects();
  initCommentField(config.mapConfig);

  const form = $('frog-form');
  let lastPayload = '';
  let requestId;
  let submitting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    hideError();

    const latlng = callbacks.getLatLng();
    if (!latlng) {
      showError('地図をタップして場所を選んでください');
      return;
    }

    const payload = buildPayload(latlng, config.mapConfig);
    const serialized = JSON.stringify(payload);
    if (lastPayload !== serialized) {
      requestId = newRequestId();
      lastPayload = serialized;
    }
    submitting = true;
    setSubmitting(true);
    try {
      const result = await submitRecord({ ...payload, request_id: requestId }, config.mapConfig.gasUrl);
      if (result.ok) {
        lastPayload = '';
        callbacks.onSuccess(result.record_id);
      } else {
        showError(ERROR_MESSAGES[result.error] || ERROR_MESSAGES.unknown);
      }
    } finally {
      submitting = false;
      setSubmitting(false);
    }
  });
}

// 一件ごとの受付番号。端末には保存せず、同じ入力の再送時だけ再使用する。
function newRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function setSheetCoords(latlng, decimals) {
  $('sheet-coords').textContent = `緯度 ${latlng.lat.toFixed(decimals)} / 経度 ${latlng.lng.toFixed(decimals)}`;
}

export function resetForm() {
  selectedSpeciesCode = '';
  $('species-cards').querySelectorAll('.species-card').forEach((el) => {
    el.setAttribute('aria-checked', 'false');
  });
  resetDateSelects();
  $('count-category').value = '';
  $('method').value = '';
  $('confidence').value = '';
  $('habitat').value = '';
  if ($('comment')) $('comment').value = '';
  $('website').value = '';
  hideError();
}
