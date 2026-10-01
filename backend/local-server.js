import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import worker from './worker.js';
import { localDatabase } from './local-db.js';
mkdirSync('.local', { recursive: true });
const env = {
  DB: localDatabase('.local/ranking.sqlite'),
  ALLOWED_ORIGINS: 'http://127.0.0.1:5186,http://127.0.0.1:5174,http://127.0.0.1:4173',
};
const server = createServer(async (req, res) => {
  try {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 500000) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const request = new Request(`http://127.0.0.1:8787${req.url}`, {
      method: req.method,
      headers: req.headers,
      ...(body.length ? { body } : {}),
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end();
  }
});
server.listen(8787, '127.0.0.1', () =>
  console.log('Local ranking API http://127.0.0.1:8787 (SQLite; not public)'),
);
