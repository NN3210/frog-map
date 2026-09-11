// map.js — Leaflet 地図・仮ピン・公開ピンまわり
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

let mapInstance = null;
let tempMarker = null;

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

  L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
    maxZoom: mapConfig.maxZoom,
    attribution:
      '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
  }).addTo(mapInstance);

  mapInstance.on('click', (e) => {
    onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
  });

  return mapInstance;
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

/**
 * 公開ピンを circleMarker で表示する。
 * @param {Array<{lat:number,lng:number,species_code:string,ym:string}>} pins
 * @param {Map<string,object>} speciesByCode
 */
export function renderPublicPins(pins, speciesByCode) {
  if (!mapInstance || !Array.isArray(pins)) return;
  for (const pin of pins) {
    if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') continue;
    const sp = speciesByCode.get(pin.species_code);
    const color = (sp && sp.color) || '#888888';
    const name = (sp && sp.name) || pin.species_code || '不明';
    const marker = L.circleMarker([pin.lat, pin.lng], {
      radius: 6,
      color: color,
      weight: 1,
      fillColor: color,
      fillOpacity: 0.7
    }).addTo(mapInstance);
    const ymText = pin.ym ? pin.ym : '時期不明';
    marker.bindPopup(`<strong>${escapeHtml(name)}</strong><br>観察年月: ${escapeHtml(ymText)}`);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
