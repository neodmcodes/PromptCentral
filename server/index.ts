import path from 'node:path';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApi } from './app.js';
import { createStore, openDatabase } from './db.js';
import { seedIfEmpty } from './seed.js';

const port = Number(process.env.PORT ?? 3000);
const dataDir = process.env.DATA_DIR ?? path.resolve('data');
const staticDir = process.env.STATIC_DIR ?? 'dist';
const password = process.env.APP_PASSWORD || '2511';
const sessionSecret = process.env.SESSION_SECRET || password;

if (!process.env.APP_PASSWORD) {
  console.warn('APP_PASSWORD is not set; using the default password.');
}

const db = openDatabase(path.join(dataDir, 'promptcentral.db'));
const store = createStore(db);
seedIfEmpty(store);

const app = new Hono();
app.route('/api', createApi(store, { password, sessionSecret }));

// Built frontend (production only; in dev Vite serves it).
app.use('/assets/*', async (c, next) => {
  await next();
  if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable');
});
app.use('*', serveStatic({ root: staticDir }));

let indexHtml: string | null = null;
app.get('*', (c) => {
  try {
    indexHtml ??= readFileSync(path.join(staticDir, 'index.html'), 'utf8');
  } catch {
    return c.text('Frontend not built. Run `npm run build`, or use `npm run dev` during development.', 404);
  }
  return c.html(indexHtml);
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`PromptCentral listening on http://localhost:${info.port} (data: ${dataDir})`);
});

function shutdown() {
  server.close();
  db.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
