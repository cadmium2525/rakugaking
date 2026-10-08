import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, migrateSave, SaveStore } from '../src/core/save.js';
import { calculateStats } from '../src/core/stats.js';
import { GAME_VERSION } from '../src/core/ranking.js';
test('stage identity release archives 6.0 timings and preserves earned medals, characters and mute', () => {
  const raw = freshSave();
  raw.player.medals = { 1: 3, 2: 2, 3: 1, 4: 3, 5: 2 };
  raw.settings.sound = false;
  raw.records = [
    {
      version: '6.0.0',
      total: 200,
      splits: [60, 30, 30, 30, 50],
      valid: true,
      character: 'らくがきくん',
      level: 1,
      drawing: raw.characters[0].drawing,
      stats: calculateStats(raw.characters[0].drawing),
    },
  ];
  const { data } = migrateSave(raw);
  assert.equal(data.records.length, 0);
  assert.equal(data.legacyRecords.length, 1);
  assert.deepEqual(data.player.medals, raw.player.medals);
  assert.deepEqual(data.characters[0].drawing, raw.characters[0].drawing);
  assert.equal(data.settings.sound, false);
  assert.equal(migrateSave(data).data.legacyRecords.length, 1);
  delete raw.settings.sound;
  assert.equal(migrateSave(raw).data.settings.sound, true);
});
test('campaign replacement preserves characters and progression, resets replaced medals and archives 4.1 timings', () => {
  const raw = freshSave();
  delete raw.player.expeditionMedalVersion;
  raw.player.exp = 1500;
  raw.player.cleared = [1, 2, 3, 4, 5];
  raw.player.medals = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 };
  raw.records = [
    {
      version: '4.1.0',
      total: 200,
      splits: [60, 30, 30, 30, 50],
      valid: true,
      character: 'らくがきくん',
      level: 1,
      drawing: raw.characters[0].drawing,
      stats: calculateStats(raw.characters[0].drawing),
    },
  ];
  const { data } = migrateSave(raw);
  assert.equal(data.player.exp, 1500);
  assert.equal(data.player.unlocked, 5);
  assert.deepEqual(data.player.cleared, [1, 2, 3, 4, 5]);
  assert.deepEqual(data.player.medals, { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(data.characters[0].drawing, raw.characters[0].drawing);
  assert.equal(data.records.length, 0);
  assert.equal(data.legacyRecords.length, 1);
  data.player.medals[2] = 3;
  assert.equal(migrateSave(data).data.player.medals[2], 3);
});
test('field migration resets only the old stage 1 medal and archives 2.1 timings', () => {
  const raw = freshSave();
  delete raw.player.fieldMedalVersion;
  raw.player.medals = { 1: 3, 2: 2 };
  raw.player.exp = 1200;
  raw.records = [
    {
      version: '2.1.0',
      total: 90,
      splits: [20, 20, 20, 15, 15],
      valid: true,
      character: '旧コースのキャラクター',
      level: 1,
      drawing: raw.characters[0].drawing,
      stats: calculateStats(raw.characters[0].drawing),
    },
  ];
  const { data } = migrateSave(raw);
  assert.equal(data.player.medals[1], 0);
  assert.equal(data.player.medals[2], 2);
  assert.equal(data.player.exp, 1200);
  assert.equal(data.legacyRecords.length, 1);
  assert.equal(data.records.length, 0);
  data.player.medals[1] = 2;
  assert.equal(migrateSave(data).data.player.medals[1], 2);
});
test('exploration medals survive reload and malformed medal values are bounded', () => {
  const raw = freshSave();
  raw.player.medals = { 1: 3, 2: 2, 3: Infinity, 4: -1 };
  const { data } = migrateSave(raw);
  assert.deepEqual(data.player.medals, { 1: 3, 2: 2, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(migrateSave(data).data.player.medals, data.player.medals);
});
test('new courses archive old timings while preserving characters and progression', () => {
  const raw = freshSave();
  raw.player.exp = 1200;
  raw.records = [
    {
      version: '1.0.0',
      character: '旧記録',
      player: 'ゲスト',
      level: 1,
      drawing: raw.characters[0].drawing,
      stats: calculateStats(raw.characters[0].drawing),
      splits: [8, 15, 10, 8, 20],
      total: 61,
      valid: true,
    },
  ];
  const { data } = migrateSave(raw);
  assert.equal(data.best, null);
  assert.equal(data.records.length, 0);
  assert.equal(data.legacyRecords.length, 1);
  assert.equal(data.player.exp, 1200);
  assert.deepEqual(data.characters[0].drawing, raw.characters[0].drawing);
  assert.equal(migrateSave(data).data.legacyRecords.length, 1);
});
test('old saves migrate; invalid fields cannot produce NaN or impossible progression', () => {
  const old = migrateSave({ version: 1, exp: 300, unlocked: 3, drawing: {} });
  assert.equal(old.data.player.exp, 300);
  assert.equal(old.data.player.unlocked, 3);
  assert.equal(old.data.characters.length, 1);
  const bad = migrateSave({
    version: 2,
    player: { exp: Infinity, cleared: [5, 'x', 100] },
    characters: [null],
    best: 1,
  });
  assert.equal(bad.data.player.exp, 0);
  assert.equal(bad.data.player.unlocked, 1);
  assert.equal(bad.data.best, null);
  assert.equal(bad.data.characters.length, 1);
  assert.ok(migrateSave('garbage').backup);
  assert.ok(migrateSave({ version: 99 }).readOnly);
});
test('IndexedDB failure falls back and quota errors are reported without losing runtime data', async () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  const store = new SaveStore({ idb: null, storage, locks: saveLocks() });
  const loaded = await store.load();
  loaded.data.player.exp = 500;
  assert.match(await store.save(loaded.data), /保存しました/);
  const reloaded = await new SaveStore({ idb: null, storage }).load();
  assert.equal(reloaded.data.player.exp, 500);
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.match(await store.save(loaded.data), /保存できません/);
  assert.equal(loaded.data.player.exp, 500);
});
test('future saves are not overwritten', async () => {
  let written = false;
  const store = new SaveStore({
    idb: null,
    storage: { getItem: () => JSON.stringify({ version: 99 }), setItem: () => (written = true) },
  });
  await store.load();
  await store.save(freshSave());
  assert.equal(written, false);
});
test('newer fallback wins over an older recovered IndexedDB save', async () => {
  const old = { ...freshSave(), savedAt: 1 },
    recent = { ...freshSave(), savedAt: 2 };
  recent.player.exp = 777;
  const store = new SaveStore({ storage: { getItem: () => JSON.stringify(recent) } });
  store.dbRead = async () => old;
  assert.equal((await store.load()).data.player.exp, 777);
});

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
}
function saveLocks() {
  let pending = Promise.resolve();
  return {
    calls: [],
    request(name, fn) {
      this.calls.push(name);
      const job = pending.then(fn);
      pending = job.catch(() => {});
      return job;
    },
  };
}
const record = (total, character = 'らくがきくん') => {
  const drawing = freshSave().characters[0].drawing;
  return {
    version: GAME_VERSION,
    valid: true,
    character,
    level: 1,
    drawing,
    stats: calculateStats(drawing),
    splits: Array(5).fill(total / 5),
    total,
  };
};

test('a stale tab cannot overwrite another tab and its unsaved changes are backed up separately', async () => {
  const storage = memoryStorage(),
    locks = saveLocks(),
    one = new SaveStore({ idb: null, storage, locks }),
    two = new SaveStore({ idb: null, storage, locks }),
    first = (await one.load()).data,
    second = (await two.load()).data;
  first.player.exp = 500;
  first.characters.push({ ...structuredClone(first.characters[0]), id: 'new-cat', name: 'ねこ' });
  await one.save(first);
  second.settings.sound = false;
  assert.match(await two.save(second), /別のタブ.*上書きを停止/);
  const reloaded = (await new SaveStore({ idb: null, storage }).load()).data;
  assert.equal(reloaded.player.exp, 500);
  assert.equal(reloaded.characters.length, 2);
  assert.equal(reloaded.settings.sound, true);
  assert.equal(two.conflicted, true);
  let backup = JSON.parse(storage.getItem(`rakuga.save.${two.conflictKey}`));
  assert.equal(backup.settings.sound, false);
  second.player.exp = 160;
  assert.match(await two.save(second), /上書きを停止/);
  backup = JSON.parse(storage.getItem(`rakuga.save.${two.conflictKey}`));
  assert.equal(backup.player.exp, 160);
  assert.equal(JSON.parse(storage.getItem('rakuga.save')).player.exp, 500);
  const refreshed = (await two.load()).data;
  refreshed.settings.sound = false;
  assert.match(await two.save(refreshed), /保存しました/);
  assert.equal(JSON.parse(storage.getItem('rakuga.save')).characters.length, 2);
  assert.equal(JSON.parse(storage.getItem('rakuga.save')).settings.sound, false);
});

test('native-style save locks protect simultaneous fallback writers and retain both branches', async () => {
  const storage = memoryStorage(),
    locks = saveLocks(),
    one = new SaveStore({ idb: null, storage, locks }),
    two = new SaveStore({ idb: null, storage, locks }),
    first = (await one.load()).data,
    second = (await two.load()).data;
  first.player.exp = 100;
  second.player.exp = 200;
  const results = await Promise.all([one.save(first), two.save(second)]);
  assert.match(results[0], /保存しました/);
  assert.match(results[1], /上書きを停止/);
  assert.equal(JSON.parse(storage.getItem('rakuga.save')).player.exp, 100);
  assert.equal(JSON.parse(storage.getItem(`rakuga.save.${two.conflictKey}`)).player.exp, 200);
  assert.deepEqual(locks.calls, ['rakuga-save', 'rakuga-save']);
});

test('queued saves have increasing commit times and a newer fallback survives database recovery', async () => {
  const storage = memoryStorage(),
    locks = saveLocks(),
    store = new SaveStore({ storage, locks });
  let database,
    writes = 0;
  store.dbRead = async () => structuredClone(database);
  store.dbWrite = async (snapshot) => {
    if (++writes === 2) throw new Error('QuotaExceededError');
    database = structuredClone(snapshot);
  };
  const data = (await store.load()).data,
    originalNow = Date.now;
  Date.now = () => 1700000000000;
  try {
    data.player.exp = 100;
    const first = store.save(data);
    data.player.exp = 200;
    const second = store.save(data);
    assert.ok((await Promise.all([first, second])).every((result) => /保存しました/.test(result)));
    const fallback = JSON.parse(storage.getItem('rakuga.save'));
    assert.equal(database.player.exp, 100);
    assert.equal(fallback.player.exp, 200);
    assert.equal(database.savedAt, 1700000000000);
    assert.equal(fallback.savedAt, database.savedAt + 1);
    assert.equal(fallback.saveRevision, database.saveRevision + 1);
    const recovered = new SaveStore({ storage, locks });
    recovered.dbRead = async () => structuredClone(database);
    recovered.dbWrite = async (snapshot) => {
      database = structuredClone(snapshot);
    };
    const latest = (await recovered.load()).data;
    assert.equal(latest.player.exp, 200);
    latest.player.exp = 300;
    await recovered.save(latest);
    assert.equal(database.savedAt, fallback.savedAt + 1);
    const final = new SaveStore({ storage });
    final.dbRead = async () => structuredClone(database);
    assert.equal((await final.load()).data.player.exp, 300);
  } finally {
    Date.now = originalNow;
  }
});

test('old equal-time fallback saves win the tie instead of restoring the older database branch', async () => {
  const database = { ...freshSave(), savedAt: 100 },
    fallback = { ...freshSave(), savedAt: 100 },
    storage = memoryStorage();
  database.player.exp = 100;
  fallback.player.exp = 200;
  storage.setItem('rakuga.save', JSON.stringify(fallback));
  const store = new SaveStore({ storage });
  store.dbRead = async () => database;
  assert.equal((await store.load()).data.player.exp, 200);
});

test('conflict backup failure cannot touch the latest main save or discard the runtime draft', async () => {
  const storage = memoryStorage(),
    one = new SaveStore({ idb: null, storage, locks: saveLocks() }),
    two = new SaveStore({ idb: null, storage }),
    first = (await one.load()).data,
    draft = (await two.load()).data;
  first.player.exp = 500;
  await one.save(first);
  const main = storage.getItem('rakuga.save');
  draft.characters[0].name = '未保存のねこ';
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.match(await two.save(draft), /この画面に残っています/);
  assert.equal(storage.getItem('rakuga.save'), main);
  assert.equal(draft.characters[0].name, '未保存のねこ');
});

test('without shared locks an unavailable database cannot let simultaneous fallbacks overwrite main', async () => {
  const storage = memoryStorage(),
    one = new SaveStore({ idb: null, storage, locks: null }),
    two = new SaveStore({ idb: null, storage, locks: null }),
    first = (await one.load()).data,
    second = (await two.load()).data;
  first.player.exp = 500;
  first.characters.push({ ...structuredClone(first.characters[0]), id: 'cat', name: 'ねこ' });
  second.settings.sound = false;
  const messages = await Promise.all([one.save(first), two.save(second)]);
  assert.ok(messages.every((message) => /保存できません/.test(message)));
  assert.equal(storage.getItem('rakuga.save'), undefined);
  assert.equal(JSON.parse(storage.getItem(`rakuga.save.${one.conflictKey}`)).characters.length, 2);
  assert.equal(JSON.parse(storage.getItem(`rakuga.save.${two.conflictKey}`)).settings.sound, false);
});

test('a temporary database read failure protects main without marking the tab stale and can retry', async () => {
  const storage = memoryStorage(),
    store = new SaveStore({ storage, locks: saveLocks() });
  let database = { ...freshSave(), savedAt: 1 },
    readable = true;
  store.dbRead = async () => {
    if (!readable) throw new Error('Temporarily unavailable');
    return structuredClone(database);
  };
  store.dbWrite = async (data, key = 'main') => {
    if (key === 'main') database = structuredClone(data);
  };
  const data = (await store.load()).data;
  data.player.exp = 500;
  readable = false;
  assert.match(await store.save(data), /保存の状態を確認できません/);
  assert.equal(store.conflicted, false);
  assert.equal(database.player.exp, 0);
  assert.equal(storage.getItem('rakuga.save'), undefined);
  readable = true;
  assert.match(await store.save(data), /保存しました/);
  assert.equal(database.player.exp, 500);
});

test('an unreadable database branch cannot be overtaken by an older fallback even if it failed at initial load', async () => {
  const storage = memoryStorage(),
    locks = saveLocks(),
    old = { ...freshSave(), savedAt: 1, saveRevision: 1 };
  storage.setItem('rakuga.save', JSON.stringify(old));
  let database;
  const one = new SaveStore({ storage, locks }),
    two = new SaveStore({ idb: {}, storage, locks });
  one.dbRead = async () => structuredClone(database);
  one.dbWrite = async (snapshot, key = 'main') => {
    if (key === 'main') database = structuredClone(snapshot);
  };
  two.dbRead = async () => {
    throw new Error('Database read denied');
  };
  two.dbWrite = async () => {
    throw new Error('Database write denied');
  };
  const first = (await one.load()).data,
    second = (await two.load()).data;
  first.player.exp = 500;
  first.characters.push({ ...structuredClone(first.characters[0]), id: 'cat', name: 'ねこ' });
  await one.save(first);
  second.settings.sound = false;
  assert.match(await two.save(second), /保存の状態を確認できません/);
  assert.equal(JSON.parse(storage.getItem('rakuga.save')).saveRevision, 1);
  assert.equal(two.conflicted, false);
  const recovered = new SaveStore({ storage });
  recovered.dbRead = async () => structuredClone(database);
  const latest = (await recovered.load()).data;
  assert.equal(latest.player.exp, 500);
  assert.equal(latest.characters.length, 2);
});

test('migration preserves a current best outside recent history and editor-compatible record names', () => {
  const raw = freshSave();
  delete raw.bestVersion;
  delete raw.bestRecord;
  raw.records = Array.from({ length: 20 }, () => record(150, '<ねこ>'));
  raw.best = 100;
  const migrated = migrateSave(raw).data;
  assert.equal(migrated.best, 100);
  assert.equal(migrated.bestRecord, null);
  assert.equal(migrated.bestVersion, GAME_VERSION);
  assert.equal(migrated.records[0].character, '<ねこ>');
  assert.equal(migrateSave(JSON.parse(JSON.stringify(migrated))).data.best, 100);
  raw.bestRecord = record(100, '<ねこ>');
  assert.equal(migrateSave(raw).data.bestRecord.character, '<ねこ>');
  raw.records = [record(100, '<ねこ>')];
  raw.records[0].version = '6.0.0';
  raw.bestRecord = null;
  const old = migrateSave(raw).data;
  assert.equal(old.best, null);
  assert.equal(old.legacyRecords[0].character, '<ねこ>');
});
