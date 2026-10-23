import { beforeEach, describe, expect, it } from 'vitest';
import { createApi } from './app.js';
import { createStore, openDatabase, type Store } from './db.js';
import { seedIfEmpty } from './seed.js';

let store: Store;
let api: ReturnType<typeof createApi>;
let cookie: string;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return api.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(async () => {
  store = createStore(openDatabase(':memory:'));
  api = createApi(store, { password: '2511', sessionSecret: 'test-secret' });
  cookie = '';
  const res = await call('POST', '/login', { password: '2511' });
  cookie = res.headers.get('set-cookie')!.split(';')[0]!;
});

describe('auth', () => {
  it('rejects requests without a session', async () => {
    cookie = '';
    expect((await call('GET', '/prompts')).status).toBe(401);
    expect(await (await call('GET', '/session')).json()).toEqual({ authenticated: false });
  });

  it('rejects a wrong password and rate-limits repeated failures', async () => {
    cookie = '';
    const headers = { 'x-forwarded-for': '203.0.113.9' };
    expect((await call('POST', '/login', { password: 'nope' }, headers)).status).toBe(401);
    for (let i = 0; i < 9; i++) await call('POST', '/login', { password: 'nope' }, headers);
    expect((await call('POST', '/login', { password: '2511' }, headers)).status).toBe(429);
    expect((await call('POST', '/login', { password: '2511' }, { 'x-forwarded-for': '198.51.100.1' })).status).toBe(200);
  });

  it('accepts the session cookie', async () => {
    expect(await (await call('GET', '/session')).json()).toEqual({ authenticated: true });
    expect((await call('GET', '/prompts')).status).toBe(200);
  });
});

describe('prompts', () => {
  it('creates, updates, favorites, copies and deletes a prompt', async () => {
    const category = await (await call('POST', '/categories', { name: 'Coding' })).json();
    const created = await (
      await call('POST', '/prompts', {
        title: ' Review ',
        body: 'Review {{pr_url}}',
        categoryId: category.id,
        tags: ['#review', 'Review', 'git hub'],
      })
    ).json();
    expect(created).toMatchObject({ title: 'Review', categoryId: category.id, tags: ['review', 'git-hub'], copyCount: 0 });

    const updated = await (await call('PUT', `/prompts/${created.id}`, { ...created, title: 'Review PR' })).json();
    expect(updated.title).toBe('Review PR');

    const favorite = await (await call('PUT', `/prompts/${created.id}/favorite`, { favorite: true })).json();
    expect(favorite.favorite).toBe(true);
    expect(favorite.updatedAt).toBe(updated.updatedAt);

    const copied = await (await call('POST', `/prompts/${created.id}/copy`)).json();
    expect(copied.copyCount).toBe(1);
    expect(copied.lastUsedAt).toBeTruthy();

    expect((await call('DELETE', `/prompts/${created.id}`)).status).toBe(204);
    expect((await call('GET', `/prompts/${created.id}`)).status).toBe(404);
  });

  it('validates input', async () => {
    expect((await call('POST', '/prompts', { title: '', body: 'x' })).status).toBe(400);
    expect((await call('POST', '/prompts', { title: 'x', body: '   ' })).status).toBe(400);
    expect((await call('POST', '/prompts', { title: 'x', body: 'y', categoryId: 999 })).status).toBe(400);
  });

  it('keeps prompts when their category is deleted', async () => {
    const category = await (await call('POST', '/categories', { name: 'Temp' })).json();
    const prompt = await (await call('POST', '/prompts', { title: 't', body: 'b', categoryId: category.id })).json();
    expect((await call('DELETE', `/categories/${category.id}`)).status).toBe(204);
    expect((await (await call('GET', `/prompts/${prompt.id}`)).json()).categoryId).toBeNull();
  });

  it('rejects duplicate category names', async () => {
    await call('POST', '/categories', { name: 'Coding' });
    expect((await call('POST', '/categories', { name: 'coding' })).status).toBe(409);
  });
});

describe('import / export', () => {
  it('round-trips the library', async () => {
    seedIfEmpty(store);
    const exported = await (await call('GET', '/export')).json();
    expect(exported.prompts).toHaveLength(3);

    const merged = await (await call('POST', '/import?mode=merge', exported)).json();
    expect(merged).toEqual({ categories: 0, prompts: 3 });
    expect(await (await call('GET', '/prompts')).json()).toHaveLength(6);

    await call('POST', '/import?mode=replace', exported);
    const prompts = await (await call('GET', '/prompts')).json();
    expect(prompts).toHaveLength(3);
    expect(await (await call('GET', '/categories')).json()).toHaveLength(2);
  });

  it('rejects files that are not exports', async () => {
    expect((await call('POST', '/import', { hello: 'world' })).status).toBe(400);
    expect((await call('POST', '/import', { prompts: [{ title: 'x' }] })).status).toBe(400);
  });
});
