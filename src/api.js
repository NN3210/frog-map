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

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, credentials: 'omit', signal: controller.signal });
    if (!res.ok) throw new Error('http_error');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** mock: 600ms 後に成功を返す */
function mockSubmit(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ ok: true, record_id: payload.request_id });
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
    const data = await fetchJson(
      gasUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        referrerPolicy: 'no-referrer'
      },
      45000
    );
    if (data && data.ok === true && data.record_id && data.record_id === payload.request_id) {
      return { ok: true, record_id: data.record_id };
    }
    return { ok: false, error: (data && data.error) || 'unknown' };
  } catch (e) {
    return { ok: false, error: e.message === 'http_error' ? 'http_error' : 'network' };
  }
}
