// api.js — GAS との通信・値の丸め・検証まわり

const SOURCE_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** 小数点以下 n 桁に丸める */
export function roundTo(value, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** URL の ?src= を検証し、不正・無しなら defaultSource を返す */
export function resolveSource(defaultSource) {
  try {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    if (src && SOURCE_RE.test(src)) return src;
  } catch (e) {
    // ignore
  }
  return defaultSource;
}

function timeoutFetch(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** mock: 600ms 後に成功を返す */
function mockSubmit(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, record_id: 'mock-' + Math.random().toString(36).slice(2, 10) });
    }, 600);
  });
}

function mockPins() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        { lat: 43.196, lng: 141.776, species_code: 'amagaeru', ym: '2026-06' },
        { lat: 43.21, lng: 141.82, species_code: 'ezoaka', ym: '2026-04' },
        { lat: 43.15, lng: 141.7, species_code: 'tonosama', ym: '2026' },
        { lat: 43.18, lng: 141.9, species_code: 'unknown', ym: '' }
      ]);
    }, 600);
  });
}

/**
 * 投稿を送信する。
 * @returns {Promise<{ok:true, record_id:string}|{ok:false, error:string}>}
 */
export async function submitRecord(payload, gasUrl) {
  if (__MOCK_API__) {
    return mockSubmit(payload);
  }
  if (!gasUrl) {
    return { ok: false, error: 'not_configured' };
  }
  try {
    const res = await timeoutFetch(
      gasUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      },
      15000
    );
    if (!res.ok) {
      return { ok: false, error: 'http_error' };
    }
    const data = await res.json();
    if (data && data.ok) {
      return { ok: true, record_id: data.record_id };
    }
    return { ok: false, error: (data && data.error) || 'unknown' };
  } catch (e) {
    return { ok: false, error: 'network' };
  }
}

/**
 * 公開ピンを取得する。取得失敗時は例外を投げる（呼び出し側で握りつぶす）。
 */
export async function fetchPublicPins(gasUrl) {
  if (__MOCK_API__) {
    return mockPins();
  }
  if (!gasUrl) {
    throw new Error('gasUrl not configured');
  }
  const url = gasUrl + (gasUrl.includes('?') ? '&' : '?') + 'action=pins';
  const res = await timeoutFetch(url, { method: 'GET' }, 15000);
  if (!res.ok) throw new Error('http_error');
  return res.json();
}
