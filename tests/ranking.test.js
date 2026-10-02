import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import { localDatabase } from '../backend/local-db.js';
import { defaultDrawing } from '../src/core/drawing.js';
import { calculateStats } from '../src/core/stats.js';
import { validateRecord } from '../src/core/ranking.js';
const fixture = () => ({
  player: 'テスター',
  character: 'らくがき',
  version: '2.0.0',
  valid: true,
  level: 1,
  drawing: defaultDrawing(),
  stats: calculateStats(defaultDrawing()),
  splits: [8, 15, 10, 8, 20],
  total: 61,
});
test('ranking rejects invalid times, malformed arrays, nonfinite values and forged stats', () => {
  assert.deepEqual(validateRecord(fixture()), []);
  for (const change of [
    { total: 1 },
    { splits: {} },
    { splits: [1, 2] },
    { total: NaN },
    { level: 999 },
    { valid: false },
    { stats: { speed: 999 } },
    { drawing: {} },
    { player: '<script>' },
  ])
    assert.ok(validateRecord({ ...fixture(), ...change }).length > 0);
});
test('real SQLite integration: auth, create best, top 100, own rank, reject worse and forged records', async () => {
  const env = { DB: localDatabase(), ALLOWED_ORIGINS: 'https://test.example' };
  const request = (path, method = 'GET', body, token) =>
    worker.fetch(
      new Request(`https://api.example${path}`, {
        method,
        headers: {
          Origin: 'https://test.example',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      env,
    );
  assert.equal((await request('/scores', 'POST', fixture())).status, 401);
  const { token } = await (await request('/session', 'POST')).json();
  assert.equal(token.length, 64);
  assert.equal((await request('/scores', 'POST', fixture(), token)).status, 200);
  assert.equal(
    (await request('/scores', 'POST', { ...fixture(), stats: { speed: 999 } }, token)).status,
    422,
  );
  assert.equal(
    (
      await request(
        '/scores',
        'POST',
        { ...fixture(), total: 66, splits: [9, 16, 11, 9, 21] },
        token,
      )
    ).status,
    200,
  );
  assert.equal((await (await request('/me', 'GET', null, token)).json()).score.total, 61);
  for (let i = 0; i < 105; i++)
    await env.DB.prepare(
      'INSERT INTO scores(uid,player,character,level,total,splits,stats,shape_hash,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
    )
      .bind(`other-${i}`, 'Other', 'Body', 1, 30 + i, '[]', '{}', 'test', '2.0.0', 1)
      .run();
  const top = await (await request('/scores')).json();
  assert.equal(top.scores.length, 100);
  assert.equal(top.scores[0].total, 30);
  const me = await (await request('/me', 'GET', null, token)).json();
  assert.equal(me.rank, 32);
  await env.DB.prepare('UPDATE scores SET flagged=1 WHERE uid=?').bind('other-0').run();
  assert.equal((await (await request('/me', 'GET', null, token)).json()).rank, 31);
  assert.equal(
    (
      await worker.fetch(
        new Request('https://api.example/scores', { headers: { Origin: 'https://evil.example' } }),
        env,
      )
    ).status,
    403,
  );
  env.DB.close();
});
