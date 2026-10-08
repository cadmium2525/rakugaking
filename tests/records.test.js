import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDrawing } from '../src/core/drawing.js';
import { calculateStats } from '../src/core/stats.js';
import { APP_VERSION, GAME_VERSION, validateRecord } from '../src/core/ranking.js';
import { addLocalRecord, restoreLocalRecords, validateLocalRecord } from '../src/core/records.js';
import { freshSave, migrateSave } from '../src/core/save.js';

const fixture = (total = 100, changes = {}) => {
  const drawing = defaultDrawing();
  return {
    id: `run-${total}`,
    version: GAME_VERSION,
    character: 'らくがきくん',
    level: 1,
    drawing,
    stats: calculateStats(drawing),
    splits: Array(5).fill(total / 5),
    total,
    valid: true,
    ...changes,
  };
};

test('the all-time best full record survives 21 slower runs and serialized reload while recent history stays at 20', () => {
  let state = addLocalRecord({}, fixture(100, { id: 'fastest' }));
  for (let index = 0; index < 21; index++)
    state = addLocalRecord(state, fixture(150 + index, { id: `slow-${index}` }));
  assert.equal(state.records.length, 20);
  assert.equal(state.records[0].id, 'slow-1');
  assert.ok(state.records.every((record) => record.id !== 'fastest'));
  assert.equal(state.best, 100);
  assert.equal(state.bestRecord.id, 'fastest');
  assert.deepEqual(validateLocalRecord(state.bestRecord), []);
  assert.equal(state.bestVersion, GAME_VERSION);
  const restored = restoreLocalRecords(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.best, 100);
  assert.equal(restored.bestRecord.id, 'fastest');
  assert.equal(restored.records.length, 20);
  const improved = addLocalRecord(restored, fixture(95, { id: 'new-fastest' }));
  assert.equal(improved.best, 95);
  assert.equal(improved.bestRecord.id, 'new-fastest');
});

test('a pre-patch current-ruleset scalar best survives without inventing a faster full record', () => {
  const old = {
      records: Array.from({ length: 20 }, (_, index) => fixture(150, { id: `old-${index}` })),
      best: 100,
    },
    migrated = restoreLocalRecords(old);
  assert.equal(migrated.best, 100);
  assert.equal(migrated.bestRecord, null);
  assert.equal(migrated.bestVersion, GAME_VERSION);
  const next = addLocalRecord(migrated, fixture(160));
  assert.equal(next.best, 100);
  assert.equal(next.bestRecord, null);
  const reloaded = restoreLocalRecords(JSON.parse(JSON.stringify(next)));
  assert.equal(reloaded.best, 100);
  assert.equal(reloaded.bestVersion, GAME_VERSION);
  const improved = addLocalRecord(reloaded, fixture(90));
  assert.equal(improved.best, 90);
  assert.equal(improved.bestRecord.total, 90);
});

test('restoration selects a valid best before trimming an oversized recent history', () => {
  const records = [fixture(100), ...Array.from({ length: 21 }, () => fixture(150))],
    restored = restoreLocalRecords({ records });
  assert.equal(restored.records.length, 20);
  assert.ok(restored.records.every((record) => record.total === 150));
  assert.equal(restored.best, 100);
  assert.equal(restored.bestRecord.total, 100);
});

test('unknown, old or mixed ruleset versions cannot transfer their scalar or full best into current records', () => {
  const current = fixture(150),
    old = fixture(50, { version: '6.0.0' });
  for (const raw of [
    { best: 50 },
    { best: 50, records: [old] },
    { best: 50, records: [old, current] },
    { best: 50, bestVersion: '6.0.0', records: [current] },
    { best: 50, bestRecord: old, records: [current] },
  ]) {
    const state = restoreLocalRecords(raw);
    assert.equal(state.best, raw.records?.includes(current) ? 150 : null);
    assert.ok(state.records.every((record) => record.version === GAME_VERSION));
    assert.notEqual(state.bestRecord?.version, '6.0.0');
  }
});

test('malformed and interrupted records cannot replace a validated current best', () => {
  const state = addLocalRecord({}, fixture(100));
  for (const record of [
    fixture(90, { valid: false }),
    fixture(90, { stats: { speed: 999 } }),
    fixture(90, { drawing: {} }),
    fixture(90, { splits: [1, 2] }),
    fixture(90, { level: 21 }),
    fixture(90, { version: '6.0.0' }),
  ]) {
    const next = addLocalRecord(state, record);
    assert.equal(next.best, 100);
    assert.equal(next.bestRecord.total, 100);
    assert.equal(next.records.length, 1);
  }
  for (const best of [NaN, Infinity, -1, 19, 18001])
    assert.equal(restoreLocalRecords({ records: [fixture(150)], best }).best, 150);
  const forged = restoreLocalRecords({
    records: [fixture(150)],
    best: 80,
    bestVersion: GAME_VERSION,
    bestRecord: fixture(80, { stats: { speed: 999 } }),
  });
  assert.equal(forged.best, 150);
  assert.equal(forged.bestRecord.total, 150);
});

test('editor-compatible local character names retain their exact text without relaxing public ranking validation', () => {
  const record = fixture(100, { character: '<ねこ>', player: '<ぼく>' }),
    copy = JSON.parse(JSON.stringify(record));
  assert.deepEqual(validateLocalRecord(record), []);
  assert.ok(validateRecord(record).some((error) => error.includes('名前')));
  const state = restoreLocalRecords({ records: [record] }),
    reloaded = restoreLocalRecords(JSON.parse(JSON.stringify(state)));
  assert.equal(reloaded.records[0].character, '<ねこ>');
  assert.equal(reloaded.records[0].player, '<ぼく>');
  assert.equal(reloaded.bestRecord.character, '<ねこ>');
  assert.deepEqual(record, copy, 'local validation does not rewrite the original names');
  assert.deepEqual(validateLocalRecord(fixture(100, { character: '<ねこ>' })), []);
  for (const character of ['', ' ', '長'.repeat(21)])
    assert.ok(validateLocalRecord(fixture(100, { character })).length > 0);
});

test('an internal TAB in an editor name survives local history, best-record storage and save migration exactly', () => {
  const name = 'ね\tこ',
    record = fixture(100, { character: name }),
    current = addLocalRecord({}, record);
  assert.equal(name.trim(), name, 'the editor keeps internal whitespace');
  assert.deepEqual(validateLocalRecord(record), []);
  assert.ok(
    validateRecord({ ...record, player: 'ゲスト' }).some((error) => error.includes('名前')),
  );
  const raw = { ...freshSave(), ...current },
    migrated = migrateSave(JSON.parse(JSON.stringify(raw))).data,
    restored = restoreLocalRecords(JSON.parse(JSON.stringify(migrated)));
  assert.equal(migrated.records[0].character, name);
  assert.equal(migrated.bestRecord.character, name);
  assert.equal(restored.records[0].character, name);
  assert.equal(restored.bestRecord.character, name);
  assert.equal(restored.best, 100);
  assert.deepEqual(validateLocalRecord(fixture(100, { character: 'ね\u0000こ' })), []);
});

test('local name allowance still validates times, shapes and stats when archiving an older record', () => {
  const legacy = fixture(100, { character: '<ねこ>', version: '6.0.0' });
  assert.ok(validateLocalRecord(legacy).length > 0);
  assert.deepEqual(validateLocalRecord({ ...legacy, version: GAME_VERSION }), []);
  assert.ok(validateLocalRecord({ ...legacy, version: GAME_VERSION, total: 1 }).length > 0);
});

test('the app patch version changes independently of compatible ranking ruleset records', () => {
  assert.equal(APP_VERSION, '7.0.1');
  assert.equal(GAME_VERSION, '7.0.0');
  assert.deepEqual(validateLocalRecord(fixture()), []);
  assert.deepEqual(validateRecord({ ...fixture(), player: 'ゲスト' }), []);
  assert.deepEqual(restoreLocalRecords(null), {
    records: [],
    bestRecord: null,
    best: null,
    bestVersion: null,
  });
});
