import { GAME_VERSION, validateRecord } from './ranking.js';

const localNameOK = (name) =>
  typeof name === 'string' && name.trim().length > 0 && name.length <= 20;

// Local names are displayed as text and follow the editor's name policy.
// Public ranking submissions keep validateRecord's separate name restrictions.
export function validateLocalRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['記録がありません'];
  const player = record.player ?? 'ゲスト',
    errors = validateRecord({ ...record, player: 'ゲスト', character: 'らくがき' });
  if (!localNameOK(player) || !localNameOK(record.character))
    errors.push('名前は1〜20文字で入力してください');
  return errors;
}

const validTime = (time) => Number.isFinite(time) && time >= 20 && time <= 18000;

export function restoreLocalRecords(raw = {}) {
  const source = Array.isArray(raw?.records) ? raw.records : [],
    valid = source.filter((record) => validateLocalRecord(record).length === 0),
    savedBest = validateLocalRecord(raw?.bestRecord).length === 0 ? raw.bestRecord : null;
  let bestRecord = savedBest;
  // Choose the best before trimming recent history. The retained full record is
  // independent of the 20-slot ring and must validate under the current ruleset.
  for (const record of valid)
    if (!bestRecord || record.total < bestRecord.total) bestRecord = record;

  const currentVersionEvidence =
      raw?.bestVersion === undefined
        ? valid.length > 0 && source.every((record) => record?.version === GAME_VERSION)
        : raw.bestVersion === GAME_VERSION,
    compatibleBest =
      raw?.bestRecord == null && currentVersionEvidence && validTime(raw?.best) ? raw.best : null;
  const best =
    bestRecord && compatibleBest !== null
      ? Math.min(bestRecord.total, compatibleBest)
      : (bestRecord?.total ?? compatibleBest);
  // Pre-patch saves only retained a scalar best. Keep it when its ruleset is
  // known, without fabricating a full record from a slower recent run.
  if (bestRecord && bestRecord.total !== best) bestRecord = null;
  return {
    records: valid.slice(-20),
    bestRecord,
    best,
    bestVersion: best === null ? null : GAME_VERSION,
  };
}

export function addLocalRecord(state, record) {
  return restoreLocalRecords({
    ...state,
    records: [...(Array.isArray(state?.records) ? state.records : []), record],
  });
}
