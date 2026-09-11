// ui.js — モーダル・ボトムシート・完了画面など汎用UI部品

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

export function $(id) {
  return document.getElementById(id);
}

/* ---------- 汎用モーダル ---------- */

export function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.hidden = false;
}

export function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.hidden = true;
}

export function wireModalCloseButtons() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close-modal'));
    });
  });
  document.querySelectorAll('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.hidden = true;
      }
    });
  });
}

/* ---------- 使い方モーダル ---------- */

export function initUsageModal(mapConfig) {
  const link = $('privacy-link');
  const wrap = $('privacy-link-wrap');
  if (mapConfig.privacyPolicyUrl) {
    link.href = mapConfig.privacyPolicyUrl;
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }

  $('usage-btn').addEventListener('click', () => openModal('usage-modal'));
  $('usage-ok-btn').addEventListener('click', () => closeModal('usage-modal'));

  if (mapConfig.requireConsent) {
    openModal('usage-modal');
  }
}

/* ---------- ボトムシート ---------- */

let sheetOpen = false;

export function openSheet() {
  $('sheet-backdrop').hidden = false;
  $('sheet').classList.add('open');
  $('sheet').setAttribute('aria-hidden', 'false');
  sheetOpen = true;
}

export function closeSheet() {
  $('sheet-backdrop').hidden = true;
  $('sheet').classList.remove('open');
  $('sheet').setAttribute('aria-hidden', 'true');
  sheetOpen = false;
}

export function isSheetOpen() {
  return sheetOpen;
}

export function wireSheetClose(onClose) {
  $('sheet-close').addEventListener('click', () => {
    closeSheet();
    if (onClose) onClose();
  });
  $('sheet-backdrop').addEventListener('click', () => {
    closeSheet();
    if (onClose) onClose();
  });
}

/* ---------- エラー表示 ---------- */

export function showError(msg) {
  const el = $('error-banner');
  el.textContent = msg;
  el.hidden = false;
}

export function hideError() {
  const el = $('error-banner');
  el.hidden = true;
  el.textContent = '';
}

/* ---------- 送信ボタン状態 ---------- */

export function setSubmitting(isSubmitting) {
  const btn = $('submit-btn');
  const label = $('submit-label');
  btn.disabled = isSubmitting;
  if (isSubmitting) {
    label.innerHTML = '<span class="spinner" aria-hidden="true"></span>送信中…';
  } else {
    label.textContent = 'この内容で送る';
  }
}

/* ---------- 完了画面 ---------- */

export function showCompleteScreen(mapConfig) {
  const labLink = $('lab-link');
  if (mapConfig.labPageUrl) {
    labLink.href = mapConfig.labPageUrl;
    labLink.hidden = false;
  } else {
    labLink.hidden = true;
  }
  $('complete-screen').hidden = false;
}

export function hideCompleteScreen() {
  $('complete-screen').hidden = true;
}

/* ---------- 種の詳細モーダル ---------- */

export function showSpeciesDetail(species, assetInfo) {
  const imgWrap = $('species-modal-img-wrap');
  const title = $('species-modal-title');
  const note = $('species-modal-note');
  const audioWrap = $('species-modal-audio-wrap');

  title.textContent = species.name;
  note.textContent = species.note || '';

  imgWrap.innerHTML = '';
  if (assetInfo && assetInfo.image) {
    const img = document.createElement('img');
    img.className = 'species-modal-img';
    img.loading = 'lazy';
    img.alt = species.name;
    img.src = `./assets/species/${assetInfo.image}`;
    imgWrap.appendChild(img);
  } else {
    const div = document.createElement('div');
    div.className = 'species-modal-img placeholder';
    div.textContent = species.code === 'unknown' ? '？' : species.name;
    imgWrap.appendChild(div);
  }

  audioWrap.innerHTML = '';
  if (assetInfo && assetInfo.sound) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = `./assets/sounds/${assetInfo.sound}`;
    audioWrap.appendChild(audio);
  }

  openModal('species-modal');
}
