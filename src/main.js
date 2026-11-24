// main.js — エントリポイント。各モジュールを配線する。
import 'leaflet/dist/leaflet.css';
import './style.css';

import mapConfig from '../config/map.json';
import speciesList from '../config/species.json';

import {
  createMap,
  placeOrMoveTempPin,
  getTempPinLatLng,
  clearTempPin,
  toggleBaseLayer
} from './map.js';
import { initForm, resetForm, setSheetCoords } from './form.js';
import {
  $,
  wireModalCloseButtons,
  initUsageModal,
  openSheet,
  closeSheet,
  wireSheetClose,
  showCompleteScreen,
  hideCompleteScreen
} from './ui.js';

let currentLatLng = null;

function onMapClick(latlng) {
  currentLatLng = latlng;
  placeOrMoveTempPin(latlng, (newLatLng) => {
    currentLatLng = newLatLng;
    setSheetCoords(newLatLng, mapConfig.roundDecimals);
  });
  setSheetCoords(latlng, mapConfig.roundDecimals);
  openSheet();
}

// 背景（標準地図⇔航空写真）切替ボタン
function wireLayerButton() {
  const btn = $('layer-btn');
  btn.addEventListener('click', () => {
    const kind = toggleBaseLayer();
    const isPhoto = kind === 'photo';
    btn.setAttribute('aria-pressed', String(isPhoto));
    btn.setAttribute('aria-label', isPhoto ? '背景を標準地図に切り替える' : '背景を航空写真に切り替える');
    btn.textContent = isPhoto ? '地図' : '航空写真';
  });
}

function main() {
  createMap($('map'), mapConfig, onMapClick);
  if (__MOCK_API__) $('top-banner').prepend('【練習・保存なし】');

  wireModalCloseButtons();
  initUsageModal(mapConfig);
  wireSheetClose();
  wireLayerButton();

  initForm(
    { species: speciesList, speciesAssets: __SPECIES_ASSETS__, mapConfig },
    {
      getLatLng: () => currentLatLng || getTempPinLatLng(),
      onSuccess: (recordId) => {
        closeSheet();
        showCompleteScreen(mapConfig, recordId);
      }
    }
  );

  $('again-btn').addEventListener('click', () => {
    hideCompleteScreen();
    resetForm();
    clearTempPin();
    currentLatLng = null;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
