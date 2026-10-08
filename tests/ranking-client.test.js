import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import { localDatabase } from '../backend/local-db.js';
import { RankingClient } from '../src/core/ranking-client.js';
import { RankingPanel } from '../src/ui/ranking-panel.js';
import { defaultDrawing } from '../src/core/drawing.js';
import { calculateStats } from '../src/core/stats.js';
import { GAME_VERSION } from '../src/core/ranking.js';

function backend(t) {
  const env = { DB: localDatabase(), ALLOWED_ORIGINS: 'https://test.example' };
  t.after(() => env.DB.close());
  return (url, options) => worker.fetch(new Request(url, options), env);
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}
function record() {
  const drawing = defaultDrawing();
  return {
    player: 'テスター',
    character: 'らくがき',
    version: GAME_VERSION,
    valid: true,
    level: 1,
    drawing,
    stats: calculateStats(drawing),
    splits: [8, 15, 10, 8, 20],
    total: 61,
  };
}
function connectionPanel() {
  // Exercise the real connection method without creating a DOM dialog.
  return Object.assign(Object.create(RankingPanel.prototype), {
    client: null,
    connectPromise: null,
  });
}

test('blocked localStorage getter still allows in-memory ranking authentication and reads', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is disabled', 'SecurityError');
    },
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  const request = backend(t);
  let sessions = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (new URL(url).pathname === '/session') sessions++;
    return request(url, options);
  });
  const client = new RankingClient('https://api.example');
  assert.equal(client.storage, null);
  assert.deepEqual(await client.leaderboard(), { scores: [], score: null, rank: null });
  await client.leaderboard();
  assert.equal(sessions, 1);
  assert.match(client.token, /^[a-f0-9]{64}$/);
});

test('parallel submission and ranking reads share one anonymous identity in the real backend', async (t) => {
  const request = backend(t),
    sessionStarted = deferred(),
    releaseSession = deferred(),
    submitted = deferred(),
    tokens = new Map();
  let sessions = 0;
  const authorization = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/session') {
      sessions++;
      sessionStarted.resolve();
      await releaseSession.promise;
    } else {
      authorization.push(options.headers.Authorization);
      // Make the read observe the successful write rather than its network race.
      if (options.method !== 'POST') await submitted.promise;
    }
    const response = await request(url, options);
    if (path === '/scores' && options.method === 'POST') submitted.resolve();
    return response;
  });
  const client = new RankingClient('https://api.example', {
    getItem: (key) => tokens.get(key),
    setItem: (key, value) => tokens.set(key, value),
  });
  const write = client.submit(record()),
    read = client.leaderboard();
  await sessionStarted.promise;
  releaseSession.resolve();
  const [result, ranking] = await Promise.all([write, read]);
  assert.deepEqual(result, { ok: true });
  assert.equal(sessions, 1);
  assert.equal(ranking.scores.length, 1);
  assert.equal(ranking.score.total, 61);
  assert.equal(ranking.rank, 1);
  assert.deepEqual(new Set(authorization), new Set([`Bearer ${client.token}`]));
  assert.equal(tokens.get('rakuga.ranking.https://api.example'), client.token);
  assert.equal(client.authPromise, null);
});

test('failed shared authentication clears the pending request and can be retried', async (t) => {
  const request = backend(t),
    fail = deferred();
  let sessions = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (new URL(url).pathname === '/session' && ++sessions === 1) {
      await fail.promise;
      throw new Error('通信が中断しました');
    }
    return request(url, options);
  });
  const client = new RankingClient('https://api.example', null);
  const first = client.authenticate(),
    second = client.authenticate();
  fail.resolve();
  const failures = await Promise.allSettled([first, second]);
  assert.equal(sessions, 1);
  assert.ok(failures.every((result) => result.status === 'rejected'));
  assert.equal(client.authPromise, null);
  assert.ok(!client.token);
  assert.deepEqual(await client.leaderboard(), { scores: [], score: null, rank: null });
  assert.equal(sessions, 2);
});

test('ranking keeps its authenticated identity when token persistence fails', async (t) => {
  const request = backend(t);
  let sessions = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (new URL(url).pathname === '/session') sessions++;
    return request(url, options);
  });
  const client = new RankingClient('https://api.example', {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    },
  });
  await client.submit(record());
  assert.equal((await client.leaderboard()).score.total, 61);
  assert.equal(client.storage, null);
  assert.equal(sessions, 1);
});

test('parallel initial panel connections fetch one config and return the same client', async (t) => {
  const release = deferred();
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, './ranking-config.json');
    requests++;
    await release.promise;
    return Response.json({ endpoint: 'https://api.example' });
  });
  const panel = connectionPanel(),
    first = panel.connect(),
    second = panel.connect();
  release.resolve();
  const [one, two] = await Promise.all([first, second]);
  assert.equal(requests, 1);
  assert.ok(one instanceof RankingClient);
  assert.equal(one, two);
  assert.equal(await panel.connect(), one);
  assert.equal(requests, 1);
  assert.equal(panel.connectPromise, null);
});

test('failed shared panel connection clears its promise so a retry can load config', async (t) => {
  const release = deferred();
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++requests === 1) {
      await release.promise;
      return new Response(null, { status: 503 });
    }
    return Response.json({ endpoint: 'https://api.example' });
  });
  const panel = connectionPanel(),
    first = panel.connect(),
    second = panel.connect();
  release.resolve();
  const failures = await Promise.allSettled([first, second]);
  assert.equal(requests, 1);
  assert.ok(failures.every((result) => result.status === 'rejected'));
  assert.equal(panel.client, null);
  assert.equal(panel.connectPromise, null);
  assert.ok((await panel.connect()) instanceof RankingClient);
  assert.equal(requests, 2);
});
