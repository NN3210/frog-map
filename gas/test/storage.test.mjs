import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const code = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const recordId = 'abbfa884-a735-49eb-b5c1-f9bddbddc897';
const payload = { request_id: recordId, lat: 43.1961, lng: 141.7759, species_code: 'ezoaka', comment: '自由入力' };

function receiver() {
  const rows = [];
  const properties = new Map();
  const service = {
    create(book) {
      const cells = book.sheets[0].data[0].rowData[0].values;
      rows.push(cells.map(cell => cell.userEnteredValue.stringValue));
      return { spreadsheetId: 'frog-data' };
    },
    Values: {
      get(id, range) {
        assert.equal(id, 'frog-data');
        return { values: range.endsWith('Q1') ? rows.slice(0, 1) : rows };
      },
      append({ values }, id, range, options) {
        assert.equal(id, 'frog-data');
        assert.equal(options.valueInputOption, 'RAW');
        rows.push(...values);
        return { updates: { updatedRows: 1 } };
      }
    }
  };
  const script = vm.createContext({
    Sheets: { Spreadsheets: service },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value)
    }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: date => date.toISOString() },
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) }
  });
  vm.runInContext(code, script);
  const post = data => script.doPost({ postData: { contents: JSON.stringify(data) } });
  const get = action => script.doGet({ parameter: { action } });
  return { script, rows, get, post, service };
}

test('setup → 投稿 → 再送は同じ1行 → 公開ピンは4項目のみ', () => {
  const { script, rows, post, get } = receiver();
  assert.equal(get('ping').ok, false);
  script.setup();
  script.setup();
  assert.equal(get('ping').ok, true);
  assert.deepEqual(post(payload), { ok: true, record_id: recordId });
  assert.deepEqual(post(payload), { ok: true, record_id: recordId });
  assert.equal(rows.length, 2);
  assert.equal(rows[1][rows[0].indexOf('comment')], '');
  assert.deepEqual(get('pins'), [{ lat: 43.196, lng: 141.776, species_code: 'ezoaka', ym: '' }]);
});

test('入力拒否・書き込みエラー・列の入れ替えを保存成功と扱わない', () => {
  const { script, rows, post, get, service } = receiver();
  script.setup();
  assert.equal(post({ ...payload, website: true }).ok, false);
  assert.equal(post({ ...payload, request_id: 'x' }).ok, false);
  service.Values.append = () => { throw new Error('write failed'); };
  assert.equal(post(payload).ok, false);
  rows[0][0] = 'other';
  assert.equal(get('ping').ok, false);
  assert.equal(post(payload).ok, false);
  assert.equal(rows.length, 1);
});
