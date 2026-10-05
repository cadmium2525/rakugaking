import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshSave, migrateSave, SaveStore } from '../src/core/save.js';
import { calculateStats } from '../src/core/stats.js';
test('combat release archives 5.0 timings and preserves earned medals, characters and mute', () => {
  const raw = freshSave();
  raw.player.medals = { 1: 3, 2: 2, 3: 1, 4: 3, 5: 2 };
  raw.settings.sound = false;
  raw.records = [
    {
      version: '5.0.0',
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
  const store = new SaveStore({ idb: null, storage });
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
