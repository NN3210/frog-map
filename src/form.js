// form.js — 投稿シートの中身（種カード・観察時期・各プルダウン・送信）
import { $, escapeHtml, showSpeciesDetail, showError, hideError, setSubmitting } from './ui.js';
import { roundTo, resolveSource, submitRecord } from './api.js';

const ERROR_MESSAGES = {
  closed: '投稿の受付は終了しました',
  not_configured: '送信先が未設定です（管理者向け）',
  network: '電波の良いところでもう一度お試しください',
  http_error: '電波の良いところでもう一度お試しください',
  unknown: '電波の良いところでもう一度お試しください',
  invalid: '電波の良いところでもう一度お試しください'
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
    website: $('website').value
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const latlng = callbacks.getLatLng();
    if (!latlng) {
      showError('地図をタップして場所を選んでください');
      return;
    }

    const payload = buildPayload(latlng, config.mapConfig);
    setSubmitting(true);
    const result = await submitRecord(payload, config.mapConfig.gasUrl);
    setSubmitting(false);

    if (result.ok) {
      callbacks.onSuccess();
    } else {
      showError(ERROR_MESSAGES[result.error] || ERROR_MESSAGES.unknown);
    }
  });
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
