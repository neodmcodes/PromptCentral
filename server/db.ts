import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Prompt {
  id: number;
  title: string;
  body: string;
  categoryId: number | null;
  tags: string[];
  favorite: boolean;
  copyCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptInput {
  title: string;
  body: string;
  categoryId: number | null;
  tags: string[];
  favorite: boolean;
}

export interface ExportData {
  app: 'promptcentral';
  version: 1;
  exportedAt: string;
  categories: { name: string }[];
  prompts: {
    title: string;
    body: string;
    category: string | null;
    tags: string[];
    favorite: boolean;
    copyCount?: number;
    lastUsedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  }[];
}

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const MIGRATIONS: string[] = [
  `
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (${NOW})
  );
  CREATE TABLE prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    favorite INTEGER NOT NULL DEFAULT 0,
    copy_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (${NOW}),
    updated_at TEXT NOT NULL DEFAULT (${NOW})
  );
  CREATE INDEX prompts_category_idx ON prompts(category_id);
  `,
];

type Row = Record<string, unknown>;

function toCategory(row: Row): Category {
  return {
    id: Number(row.id),
    name: String(row.name),
    createdAt: String(row.created_at),
  };
}

function toPrompt(row: Row): Prompt {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    tags: JSON.parse(String(row.tags)) as string[],
    favorite: Number(row.favorite) === 1,
    copyCount: Number(row.copy_count),
    lastUsedAt: row.last_used_at == null ? null : String(row.last_used_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[i]!);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
  return db;
}

function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export type Store = ReturnType<typeof createStore>;

export function createStore(db: DatabaseSync) {
  const store = {
    listCategories(): Category[] {
      return (db.prepare('SELECT * FROM categories ORDER BY name COLLATE NOCASE').all() as Row[]).map(toCategory);
    },

    getCategory(id: number): Category | null {
      const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined;
      return row ? toCategory(row) : null;
    },

    findCategoryByName(name: string): Category | null {
      const row = db.prepare('SELECT * FROM categories WHERE name = ?').get(name) as Row | undefined;
      return row ? toCategory(row) : null;
    },

    createCategory(name: string): Category {
      const { lastInsertRowid } = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
      return store.getCategory(Number(lastInsertRowid))!;
    },

    renameCategory(id: number, name: string): Category | null {
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
      return store.getCategory(id);
    },

    deleteCategory(id: number): boolean {
      return db.prepare('DELETE FROM categories WHERE id = ?').run(id).changes > 0;
    },

    listPrompts(): Prompt[] {
      return (db.prepare('SELECT * FROM prompts ORDER BY updated_at DESC').all() as Row[]).map(toPrompt);
    },

    getPrompt(id: number): Prompt | null {
      const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as Row | undefined;
      return row ? toPrompt(row) : null;
    },

    createPrompt(input: PromptInput): Prompt {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO prompts (title, body, category_id, tags, favorite) VALUES (?, ?, ?, ?, ?)')
        .run(input.title, input.body, input.categoryId, JSON.stringify(input.tags), input.favorite ? 1 : 0);
      return store.getPrompt(Number(lastInsertRowid))!;
    },

    updatePrompt(id: number, input: PromptInput): Prompt | null {
      db.prepare(
        `UPDATE prompts SET title = ?, body = ?, category_id = ?, tags = ?, favorite = ?, updated_at = ${NOW} WHERE id = ?`,
      ).run(input.title, input.body, input.categoryId, JSON.stringify(input.tags), input.favorite ? 1 : 0, id);
      return store.getPrompt(id);
    },

    /** Favoriting is not an edit, so it leaves updated_at alone. */
    setFavorite(id: number, favorite: boolean): Prompt | null {
      db.prepare('UPDATE prompts SET favorite = ? WHERE id = ?').run(favorite ? 1 : 0, id);
      return store.getPrompt(id);
    },

    deletePrompt(id: number): boolean {
      return db.prepare('DELETE FROM prompts WHERE id = ?').run(id).changes > 0;
    },

    recordCopy(id: number): Prompt | null {
      db.prepare(`UPDATE prompts SET copy_count = copy_count + 1, last_used_at = ${NOW} WHERE id = ?`).run(id);
      return store.getPrompt(id);
    },

    isEmpty(): boolean {
      const row = db.prepare('SELECT (SELECT COUNT(*) FROM prompts) + (SELECT COUNT(*) FROM categories) AS n').get() as {
        n: number;
      };
      return Number(row.n) === 0;
    },

    exportAll(): ExportData {
      const categories = store.listCategories();
      const names = new Map(categories.map((c) => [c.id, c.name]));
      return {
        app: 'promptcentral',
        version: 1,
        exportedAt: new Date().toISOString(),
        categories: categories.map((c) => ({ name: c.name })),
        prompts: store.listPrompts().map((p) => ({
          title: p.title,
          body: p.body,
          category: p.categoryId == null ? null : (names.get(p.categoryId) ?? null),
          tags: p.tags,
          favorite: p.favorite,
          copyCount: p.copyCount,
          lastUsedAt: p.lastUsedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      };
    },

    /** Merge adds everything alongside what exists; replace wipes the library first. */
    importAll(data: ExportData, mode: 'merge' | 'replace'): { categories: number; prompts: number } {
      return transaction(db, () => {
        if (mode === 'replace') {
          db.exec('DELETE FROM prompts; DELETE FROM categories;');
        }
        let categoriesAdded = 0;
        const categoryId = (name: string | null): number | null => {
          if (!name) return null;
          const existing = store.findCategoryByName(name);
          if (existing) return existing.id;
          categoriesAdded++;
          return store.createCategory(name).id;
        };
        for (const c of data.categories) categoryId(c.name);
        const insert = db.prepare(
          `INSERT INTO prompts (title, body, category_id, tags, favorite, copy_count, last_used_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, ${NOW}), COALESCE(?, ${NOW}))`,
        );
        for (const p of data.prompts) {
          insert.run(
            p.title,
            p.body,
            categoryId(p.category),
            JSON.stringify(p.tags),
            p.favorite ? 1 : 0,
            p.copyCount ?? 0,
            p.lastUsedAt ?? null,
            p.createdAt ?? null,
            p.updatedAt ?? null,
          );
        }
        return { categories: categoriesAdded, prompts: data.prompts.length };
      });
    },
  };
  return store;
}
