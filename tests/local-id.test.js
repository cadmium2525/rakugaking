import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localId } from '../src/core/local-id.js';
import { SaveStore, freshSave } from '../src/core/save.js';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function provider(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'crypto', descriptor);
    else delete globalThis.crypto;
  });
}
function fallbackIds(t) {
  t.mock.method(Date, 'now', () => 12345);
  t.mock.method(Math, 'random', () => 0);
  const ids = Array.from({ length: 100 }, localId);
  assert.equal(new Set(ids).size, 100);
  for (const id of ids) {
    assert.match(id, /^local-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/);
    assert.ok(id.length < 80, 'local character IDs survive save migration without truncation');
  }
}

test('secure contexts retain their native UUID implementation', (t) => {
  provider(t, { randomUUID: () => 'native-uuid' });
  assert.equal(localId(), 'native-uuid');
});

test('HTTP LAN-like contexts use getRandomValues and retain UUID version and variant bits', (t) => {
  let value = 0;
  provider(t, {
    getRandomValues(bytes) {
      bytes.fill(++value);
      return bytes;
    },
  });
  const ids = Array.from({ length: 50 }, localId);
  assert.equal(new Set(ids).size, 50);
  for (const id of ids) assert.match(id, uuidV4);
});

test('browsers without crypto create distinct bounded local IDs at the same timestamp', (t) => {
  provider(t, undefined);
  fallbackIds(t);
});

test('a throwing getRandomValues implementation falls back to distinct bounded local IDs', (t) => {
  provider(t, {
    getRandomValues() {
      throw new Error('Entropy unavailable');
    },
  });
  fallbackIds(t);
});

test('SaveStore loads, saves and reloads without randomUUID using guarded fallback storage', async (t) => {
  let entropy = 0;
  provider(t, {
    getRandomValues(bytes) {
      bytes.fill(++entropy);
      return bytes;
    },
  });
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    store = new SaveStore({ idb: null, storage, locks: { request: (_name, job) => job() } });
  const loaded = await store.load();
  assert.equal(loaded.data.version, freshSave().version);
  loaded.data.characters.push({
    ...structuredClone(loaded.data.characters[0]),
    id: localId(),
    name: 'HTTPのねこ',
  });
  loaded.data.active = loaded.data.characters[1].id;
  assert.match(await store.save(loaded.data), /^この端末に保存しました/);
  const saved = JSON.parse(values.get('rakuga.save'));
  assert.match(saved.saveId, uuidV4);
  assert.notEqual(`conflict:${saved.saveId}`, store.conflictKey);
  const reloaded = (await new SaveStore({ idb: null, storage }).load()).data;
  assert.deepEqual(reloaded.characters, saved.characters);
  assert.equal(reloaded.active, loaded.data.active);
  assert.equal(reloaded.characters[1].name, 'HTTPのねこ');
});
