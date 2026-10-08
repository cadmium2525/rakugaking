import { defaultDrawing } from './drawing.js';
import { sanitizeDrawing } from './shape.js';
import { newPlayer } from './progression.js';
import { GAME_VERSION } from './ranking.js';
import { calculateStats } from './stats.js';
import { restoreLocalRecords, validateLocalRecord } from './records.js';
import { localId } from './local-id.js';
export const SAVE_VERSION = 4;
const finite = (v, min, max, fallback) =>
  Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export function freshSave() {
  const drawing = defaultDrawing();
  return {
    version: SAVE_VERSION,
    player: { ...newPlayer(), fieldMedalVersion: 1, expeditionMedalVersion: 1 },
    characters: [{ id: 'starter', name: 'らくがきくん', drawing, stats: calculateStats(drawing) }],
    active: 'starter',
    records: [],
    legacyRecords: [],
    best: null,
    bestRecord: null,
    bestVersion: null,
    settings: { quality: 'medium', sound: true },
  };
}
export function migrateSave(raw) {
  if (!raw) return { data: freshSave(), notice: '' };
  if (typeof raw !== 'object' || Array.isArray(raw))
    return {
      data: freshSave(),
      notice: '破損したセーブを退避し、新しいデータで起動しました。',
      backup: true,
    };
  if (raw.version > SAVE_VERSION)
    return {
      data: freshSave(),
      notice: '新しいバージョンのセーブです。元データを保護するため保存を停止しています。',
      readOnly: true,
    };
  let notice = '';
  if (raw.version === 1) {
    raw = {
      version: 2,
      player: {
        exp: raw.exp || 0,
        cleared: Array.from(
          { length: Math.max(0, Math.min(4, (raw.unlocked || 1) - 1)) },
          (_, i) => i + 1,
        ),
      },
      characters: [{ id: 'legacy', name: raw.name || 'らくがき', drawing: raw.drawing }],
      active: 'legacy',
      records: [],
      settings: raw.settings,
    };
    notice = '旧セーブを新しい形式へ移行しました。';
  }
  if (raw.version === 2) raw = { ...raw, version: 3 };
  if (raw.version === 3) raw = { ...raw, version: 4 };
  if (raw.version !== 4)
    return {
      data: freshSave(),
      notice: 'セーブ形式を確認できません。元データは退避しました。',
      backup: true,
    };
  const data = freshSave();
  data.player.exp = Math.floor(finite(raw.player?.exp, 0, 200000, 0));
  data.player.medals = {};
  for (let id = 1; id <= 5; id++)
    data.player.medals[id] = Math.floor(finite(raw.player?.medals?.[id], 0, 3, 0));
  if (raw.player?.fieldMedalVersion !== 1) data.player.medals[1] = 0;
  if (raw.player?.expeditionMedalVersion !== 1)
    for (let id = 2; id <= 5; id++) data.player.medals[id] = 0;
  data.player.cleared = [
    ...new Set(
      (Array.isArray(raw.player?.cleared) ? raw.player.cleared : []).filter(
        (n) => Number.isInteger(n) && n >= 1 && n <= 5,
      ),
    ),
  ];
  data.player.unlocked = 1;
  while (data.player.unlocked < 5 && data.player.cleared.includes(data.player.unlocked))
    data.player.unlocked++;
  const characters = (Array.isArray(raw.characters) ? raw.characters : [])
    .slice(0, 24)
    .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
    .map((c) => ({
      id: c.id.slice(0, 80),
      name: c.name.slice(0, 20) || 'ななし',
      drawing: sanitizeDrawing(c.drawing),
      stats: calculateStats(c.drawing),
    }));
  data.characters = characters.filter((c, i) => characters.findIndex((x) => x.id === c.id) === i);
  if (!data.characters.length) data.characters = freshSave().characters;
  data.active = data.characters.some((c) => c.id === raw.active)
    ? raw.active
    : data.characters[0].id;
  Object.assign(data, restoreLocalRecords(raw));
  data.legacyRecords = [
    ...(Array.isArray(raw.legacyRecords) ? raw.legacyRecords : []),
    ...(Array.isArray(raw.records)
      ? raw.records.filter((r) =>
          ['1.0.0', '2.0.0', '2.1.0', '3.0.0', '4.0.0', '4.1.0', '5.0.0', '6.0.0'].includes(
            r?.version,
          ),
        )
      : []),
  ]
    .filter(
      (r) =>
        validateLocalRecord({ ...r, version: GAME_VERSION, player: r?.player || 'ゲスト' })
          .length === 0,
    )
    .slice(-20);
  if (data.legacyRecords.length && !raw.legacyRecords?.length)
    notice =
      'ゲームの更新に伴い、旧タイムは退避して新しいベストを別に記録します。キャラクターと進行はそのままです。';
  data.settings.quality = ['low', 'medium', 'high'].includes(raw.settings?.quality)
    ? raw.settings.quality
    : 'medium';
  data.settings.sound = raw.settings?.sound !== false;
  return { data, notice };
}
export class SaveStore {
  constructor(options = {}) {
    try {
      this.idb = Object.hasOwn(options, 'idb') ? options.idb : globalThis.indexedDB;
    } catch {
      this.idb = null;
    }
    try {
      this.storage = Object.hasOwn(options, 'storage') ? options.storage : globalThis.localStorage;
    } catch {
      this.storage = null;
    }
    this.db = null;
    this.mode = 'indexeddb';
    this.readOnly = false;
    this.pending = Promise.resolve();
    this.loaded = false;
    this.expected = null;
    this.lastSavedAt = 0;
    this.saveRevision = 0;
    this.conflicted = false;
    this.databaseKnown = false;
    this.conflictKey = `conflict:${localId()}`;
    try {
      this.locks = Object.hasOwn(options, 'locks') ? options.locks : globalThis.navigator?.locks;
    } catch {
      this.locks = null;
    }
  }
  async open() {
    if (this.db) return this.db;
    if (!this.idb) throw new Error('IndexedDB unavailable');
    return new Promise((resolve, reject) => {
      let finished = false;
      const request = this.idb.open('rakuga-db', 1);
      const timer = setTimeout(() => {
        finished = true;
        reject(new Error('IndexedDB timeout'));
      }, 1500);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('saves'))
          request.result.createObjectStore('saves');
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        finished = true;
        reject(new Error('IndexedDB blocked'));
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (finished) {
          request.result.close();
          return;
        }
        this.db = request.result;
        this.db.onversionchange = () => {
          this.db.close();
          this.db = null;
        };
        resolve(this.db);
      };
    });
  }
  async dbRead() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('saves').objectStore('saves').get('main');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async dbWrite(data, key = 'main', expected) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      const saves = tx.objectStore('saves');
      let conflict;
      if (expected !== undefined) {
        const request = saves.get('main');
        request.onsuccess = () => {
          const latest = chooseSave(request.result, this.readFallback());
          if (saveIdentity(latest) !== expected) {
            conflict = new SaveConflict();
            tx.abort();
          } else saves.put(data, key);
        };
      } else saves.put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(conflict || tx.error || new Error('aborted'));
    });
  }
  async load() {
    let raw,
      notice = '';
    try {
      raw = await this.dbRead();
      this.databaseKnown = true;
    } catch {
      this.mode = 'localstorage';
      notice = 'IndexedDBが使えないため代替保存を使用します。';
    }
    let localText;
    try {
      localText = this.storage?.getItem('rakuga.save');
      if (localText) {
        const local = JSON.parse(localText);
        raw = chooseSave(raw, local);
      }
    } catch {
      notice = '代替セーブを読み込めません。破損データを退避します。';
      try {
        if (localText) this.storage?.setItem('rakuga.save.backup', localText);
      } catch {
        notice += ' 退避できないため代替セーブの上書きを停止します。';
        this.readOnly = true;
      }
      if (this.mode !== 'indexeddb') this.mode = 'memory';
    }
    const result = migrateSave(raw);
    this.readOnly = this.readOnly || !!result.readOnly;
    if (result.backup) {
      try {
        if (this.mode === 'indexeddb') await this.dbWrite(raw, 'backup');
        else this.storage?.setItem('rakuga.save.backup', JSON.stringify(raw));
      } catch {
        notice += ' 破損データの退避にも失敗しました。';
        this.readOnly = true;
      }
    }
    this.expected = saveIdentity(raw);
    this.lastSavedAt = savedNumber(raw?.savedAt);
    this.saveRevision = savedNumber(raw?.saveRevision);
    this.conflicted = false;
    this.loaded = true;
    return { data: result.data, notice: result.notice || notice };
  }
  readFallback() {
    try {
      const text = this.storage?.getItem('rakuga.save');
      return text ? JSON.parse(text) : undefined;
    } catch {
      return undefined;
    }
  }
  async readLatest() {
    let raw;
    this.databaseReadable = false;
    try {
      raw = await this.dbRead();
      this.databaseReadable = true;
      this.databaseKnown = true;
    } catch {
      // A failed database can still have a readable localStorage fallback.
    }
    return chooseSave(raw, this.readFallback());
  }
  async backupSnapshot(snapshot) {
    let backedUp = false;
    try {
      await this.dbWrite(snapshot, this.conflictKey);
      backedUp = true;
    } catch {
      try {
        if (this.storage) {
          this.storage.setItem(`rakuga.save.${this.conflictKey}`, JSON.stringify(snapshot));
          backedUp = true;
        }
      } catch {
        // Keep the unsaved character and progression in the current app.
      }
    }
    return backedUp;
  }
  async preserveConflict(snapshot) {
    this.conflicted = true;
    const backedUp = await this.backupSnapshot(snapshot);
    return (
      '別のタブで保存が更新されたため、このタブからの上書きを停止しました。' +
      (backedUp ? '未保存データは退避しました。' : '未保存データはこの画面に残っています。') +
      'このタブの落書きは残し、新しいタブで最新データを開いてください。'
    );
  }
  async preserveUnavailable(snapshot, reason) {
    const backedUp = await this.backupSnapshot(snapshot);
    return `保存できません。${reason}${backedUp ? '未保存データは退避しました。' : '未保存データはこの画面に残っています。'}`;
  }
  save(data) {
    const snapshot = structuredClone(data);
    const job = this.pending.then(async () => {
      const write = async () => {
        if (!this.loaded) await this.load();
        if (this.readOnly) return '元のセーブを保護するため保存していません。';
        if (this.conflicted) return this.preserveConflict(snapshot);
        const latest = await this.readLatest();
        if (!this.databaseReadable && (this.databaseKnown || this.idb))
          return this.preserveUnavailable(
            snapshot,
            '保存の状態を確認できません。もう一度保存してください。',
          );
        if (saveIdentity(latest) !== this.expected) return this.preserveConflict(snapshot);
        snapshot.savedAt = Math.max(Date.now(), this.lastSavedAt + 1);
        snapshot.saveRevision = this.saveRevision + 1;
        snapshot.saveId = localId();
        if (this.mode === 'indexeddb' || (!this.locks?.request && this.databaseReadable)) {
          try {
            // The comparison and put share a readwrite transaction. Another tab
            // cannot slip a newer main save between these two operations.
            await this.dbWrite(snapshot, 'main', this.expected);
            this.committed(snapshot);
            return 'この端末に保存しました';
          } catch (error) {
            if (error instanceof SaveConflict) return this.preserveConflict(snapshot);
            this.mode = 'localstorage';
          }
        }
        if (!this.locks?.request)
          return this.preserveUnavailable(snapshot, 'この環境では安全な共有保存を利用できません。');
        // Native Web Locks serialize the database-to-fallback transition too.
        // Recheck after a failed database write before touching the fallback.
        const fallbackLatest = await this.readLatest();
        if (!this.databaseReadable && (this.databaseKnown || this.idb))
          return this.preserveUnavailable(
            snapshot,
            '保存の状態を確認できません。もう一度保存してください。',
          );
        if (saveIdentity(fallbackLatest) !== this.expected) return this.preserveConflict(snapshot);
        try {
          if (!this.storage) throw new Error('Storage unavailable');
          this.storage.setItem('rakuga.save', JSON.stringify(snapshot));
          this.mode = 'localstorage';
          this.committed(snapshot);
          return 'この端末に保存しました（代替保存）';
        } catch {
          this.mode = 'memory';
          return '保存できません。容量・ブラウザ設定を確認してください。このタブ内でのみ保持します。';
        }
      };
      return this.locks?.request ? this.locks.request('rakuga-save', write) : write();
    });
    this.pending = job.catch(() => {});
    return job;
  }
  committed(snapshot) {
    this.expected = saveIdentity(snapshot);
    this.lastSavedAt = snapshot.savedAt;
    this.saveRevision = snapshot.saveRevision;
  }
}

const savedNumber = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
const saveIdentity = (raw) => (raw === undefined || raw === null ? null : JSON.stringify(raw));
function chooseSave(database, fallback) {
  if (!database) return fallback;
  if (!fallback) return database;
  const dbRevision = savedNumber(database.saveRevision),
    fallbackRevision = savedNumber(fallback.saveRevision);
  if (dbRevision && fallbackRevision && dbRevision !== fallbackRevision)
    return fallbackRevision > dbRevision ? fallback : database;
  return savedNumber(fallback.savedAt) >= savedNumber(database.savedAt) ? fallback : database;
}
class SaveConflict extends Error {
  constructor() {
    super('A newer save belongs to another tab');
    this.name = 'SaveConflict';
  }
}
