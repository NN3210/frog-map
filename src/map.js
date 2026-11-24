// map.js — Leaflet 地図・仮ピンまわり
import L from 'leaflet';

const TEMP_PIN_SVG =
  '<div class="frog-temp-pin">' +
  '<svg viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 29 17 29s17-16.3 17-29C34 7.6 26.4 0 17 0z" fill="#1b6b3a"/>' +
  '<circle cx="17" cy="17" r="7" fill="#ffffff"/>' +
  '</svg></div>';

const tempPinIcon = L.divIcon({
  html: TEMP_PIN_SVG,
  className: '',
  iconSize: [34, 46],
  iconAnchor: [17, 46]
});

// 背景タイル（どちらも地理院タイル。外部接続先は増やさない）
const GSI_ATTRIBUTION =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';
const BASE_LAYERS = {
  std: {
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    maxNativeZoom: 18
  },
  photo: {
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    maxNativeZoom: 18
  }
};

let mapInstance = null;
let tempMarker = null;
let baseLayers = null; // { std: L.TileLayer, photo: L.TileLayer }
let currentBase = 'std';

/**
 * 地図を初期化する。
 * @param {HTMLElement} container
 * @param {object} mapConfig config/map.json
 * @param {(latlng:{lat:number,lng:number}) => void} onMapClick タップで仮ピンを打つときに呼ばれる
 */
export function createMap(container, mapConfig, onMapClick) {
  mapInstance = L.map(container, {
    center: mapConfig.center,
    zoom: mapConfig.zoom,
    minZoom: mapConfig.minZoom,
    maxZoom: mapConfig.maxZoom,
    zoomControl: true
  });

  baseLayers = {};
  for (const key of Object.keys(BASE_LAYERS)) {
    baseLayers[key] = L.tileLayer(BASE_LAYERS[key].url, {
      maxZoom: mapConfig.maxZoom,
      maxNativeZoom: BASE_LAYERS[key].maxNativeZoom,
      attribution: GSI_ATTRIBUTION
    });
  }
  currentBase = 'std';
  baseLayers[currentBase].addTo(mapInstance);

  mapInstance.on('click', (e) => {
    onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
  });

  return mapInstance;
}

/**
 * 背景を切り替える。
 * @param {'std'|'photo'} kind 'std'=標準地図 / 'photo'=航空写真（全国最新写真）
 */
export function setBaseLayer(kind) {
  if (!mapInstance || !baseLayers || !baseLayers[kind] || kind === currentBase) return;
  mapInstance.removeLayer(baseLayers[currentBase]);
  currentBase = kind;
  baseLayers[currentBase].addTo(mapInstance);
}

/** 標準地図⇔航空写真をトグルし、切替後の種別を返す。 */
export function toggleBaseLayer() {
  setBaseLayer(currentBase === 'std' ? 'photo' : 'std');
  return currentBase;
}

export function getBaseLayer() {
  return currentBase;
}

/**
 * 仮ピンを立てる／既にあれば移動する。
 * @param {{lat:number,lng:number}} latlng
 * @param {(latlng:{lat:number,lng:number}) => void} onDragEnd ドラッグ終了時に呼ばれる
 */
export function placeOrMoveTempPin(latlng, onDragEnd) {
  if (!mapInstance) return;
  if (tempMarker) {
    tempMarker.setLatLng(latlng);
    return;
  }
  tempMarker = L.marker(latlng, {
    icon: tempPinIcon,
    draggable: true,
    autoPan: true,
    keyboard: false
  }).addTo(mapInstance);

  tempMarker.on('dragend', () => {
    const ll = tempMarker.getLatLng();
    onDragEnd({ lat: ll.lat, lng: ll.lng });
  });
}

export function getTempPinLatLng() {
  if (!tempMarker) return null;
  const ll = tempMarker.getLatLng();
  return { lat: ll.lat, lng: ll.lng };
}

export function clearTempPin() {
  if (tempMarker && mapInstance) {
    mapInstance.removeLayer(tempMarker);
  }
  tempMarker = null;
}
