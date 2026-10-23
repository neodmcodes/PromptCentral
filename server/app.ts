import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { LoginLimiter, SESSION_COOKIE, safeEqual, sessionToken } from './auth.js';
import type { Store } from './db.js';
import { ValidationError, cleanCategoryName, parseExport, parsePromptInput } from './validate.js';

export interface AppConfig {
  password: string;
  sessionSecret: string;
}

function clientKey(c: Context): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'local';
}

function isHttps(c: Context): boolean {
  return c.req.header('x-forwarded-proto') === 'https' || new URL(c.req.url).protocol === 'https:';
}

function idParam(c: Context): number {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) throw new ValidationError('invalid id');
  return id;
}

async function jsonBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ValidationError('expected a JSON body');
  }
}

export function createApi(store: Store, config: AppConfig) {
  const token = sessionToken(config.sessionSecret);
  const limiter = new LoginLimiter();
  const api = new Hono();

  api.onError((err, c) => {
    if (err instanceof ValidationError) return c.json({ error: err.message }, 400);
    if (err instanceof Error && /UNIQUE constraint failed: categories\.name/.test(err.message)) {
      return c.json({ error: 'a category with that name already exists' }, 409);
    }
    console.error(err);
    return c.json({ error: 'something went wrong' }, 500);
  });

  const isAuthed = (c: Context) => safeEqual(getCookie(c, SESSION_COOKIE) ?? '', token);

  api.get('/health', (c) => c.json({ ok: true }));

  api.get('/session', (c) => c.json({ authenticated: isAuthed(c) }));

  api.post('/login', async (c) => {
    const key = clientKey(c);
    if (limiter.isBlocked(key)) {
      return c.json({ error: 'Too many attempts. Try again in a few minutes.' }, 429);
    }
    const body = (await jsonBody(c)) as { password?: unknown } | null;
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!safeEqual(password, config.password)) {
      limiter.recordFailure(key);
      return c.json({ error: 'Wrong password.' }, 401);
    }
    limiter.reset(key);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: isHttps(c),
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return c.json({ authenticated: true });
  });

  api.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ authenticated: false });
  });

  api.use('*', async (c, next) => {
    if (!isAuthed(c)) return c.json({ error: 'not logged in' }, 401);
    await next();
  });

  // Categories

  api.get('/categories', (c) => c.json(store.listCategories()));

  api.post('/categories', async (c) => {
    const body = (await jsonBody(c)) as { name?: unknown } | null;
    return c.json(store.createCategory(cleanCategoryName(body?.name)), 201);
  });

  api.patch('/categories/:id', async (c) => {
    const body = (await jsonBody(c)) as { name?: unknown } | null;
    const category = store.renameCategory(idParam(c), cleanCategoryName(body?.name));
    return category ? c.json(category) : c.json({ error: 'category not found' }, 404);
  });

  api.delete('/categories/:id', (c) =>
    store.deleteCategory(idParam(c)) ? c.body(null, 204) : c.json({ error: 'category not found' }, 404),
  );

  // Prompts

  const checkCategory = (categoryId: number | null) => {
    if (categoryId != null && !store.getCategory(categoryId)) throw new ValidationError('that category does not exist');
  };

  api.get('/prompts', (c) => c.json(store.listPrompts()));

  api.get('/prompts/:id', (c) => {
    const prompt = store.getPrompt(idParam(c));
    return prompt ? c.json(prompt) : c.json({ error: 'prompt not found' }, 404);
  });

  api.post('/prompts', async (c) => {
    const input = parsePromptInput(await jsonBody(c));
    checkCategory(input.categoryId);
    return c.json(store.createPrompt(input), 201);
  });

  api.put('/prompts/:id', async (c) => {
    const id = idParam(c);
    const input = parsePromptInput(await jsonBody(c));
    checkCategory(input.categoryId);
    const prompt = store.updatePrompt(id, input);
    return prompt ? c.json(prompt) : c.json({ error: 'prompt not found' }, 404);
  });

  api.put('/prompts/:id/favorite', async (c) => {
    const body = (await jsonBody(c)) as { favorite?: unknown } | null;
    const prompt = store.setFavorite(idParam(c), body?.favorite === true);
    return prompt ? c.json(prompt) : c.json({ error: 'prompt not found' }, 404);
  });

  api.post('/prompts/:id/copy', (c) => {
    const prompt = store.recordCopy(idParam(c));
    return prompt ? c.json(prompt) : c.json({ error: 'prompt not found' }, 404);
  });

  api.delete('/prompts/:id', (c) =>
    store.deletePrompt(idParam(c)) ? c.body(null, 204) : c.json({ error: 'prompt not found' }, 404),
  );

  // Backup

  api.get('/export', (c) => {
    const date = new Date().toISOString().slice(0, 10);
    c.header('Content-Disposition', `attachment; filename="promptcentral-${date}.json"`);
    return c.json(store.exportAll());
  });

  api.post('/import', async (c) => {
    const mode = c.req.query('mode') === 'replace' ? 'replace' : 'merge';
    const data = parseExport(await jsonBody(c));
    return c.json(store.importAll(data, mode));
  });

  api.notFound((c) => c.json({ error: 'not found' }, 404));

  return api;
}
