import type { ExportData, PromptInput } from './db.js';

export class ValidationError extends Error {}

const MAX_TITLE = 200;
const MAX_BODY = 100_000;
const MAX_TAGS = 20;
const MAX_TAG = 40;
const MAX_CATEGORY = 60;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cleanTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new ValidationError('tags must be a list');
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') throw new ValidationError('tags must be text');
    const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, '-').slice(0, MAX_TAG);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new ValidationError(`at most ${MAX_TAGS} tags`);
  return tags;
}

export function cleanCategoryName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError('category name is required');
  const name = value.trim();
  if (name.length > MAX_CATEGORY) throw new ValidationError(`category name is longer than ${MAX_CATEGORY} characters`);
  return name;
}

function cleanTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError('title is required');
  const title = value.trim();
  if (title.length > MAX_TITLE) throw new ValidationError(`title is longer than ${MAX_TITLE} characters`);
  return title;
}

function cleanBody(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError('prompt text is required');
  if (value.length > MAX_BODY) throw new ValidationError('prompt text is too long');
  return value;
}

export function parsePromptInput(value: unknown): PromptInput {
  if (!isObject(value)) throw new ValidationError('expected a JSON object');
  const { categoryId } = value;
  if (categoryId != null && !Number.isInteger(categoryId)) throw new ValidationError('categoryId must be a number');
  return {
    title: cleanTitle(value.title),
    body: cleanBody(value.body),
    categoryId: (categoryId as number | null | undefined) ?? null,
    tags: cleanTags(value.tags),
    favorite: value.favorite === true,
  };
}

export function parseExport(value: unknown): ExportData {
  if (!isObject(value) || !Array.isArray(value.prompts)) {
    throw new ValidationError('not a PromptCentral export (missing "prompts")');
  }
  const categories = Array.isArray(value.categories) ? value.categories : [];
  return {
    app: 'promptcentral',
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date().toISOString(),
    categories: categories.map((c) => ({ name: cleanCategoryName(isObject(c) ? c.name : c) })),
    prompts: value.prompts.map((p, i) => {
      if (!isObject(p)) throw new ValidationError(`prompt #${i + 1} is not an object`);
      const optionalString = (v: unknown) => (typeof v === 'string' ? v : null);
      try {
        return {
          title: cleanTitle(p.title),
          body: cleanBody(p.body),
          category: p.category == null || p.category === '' ? null : cleanCategoryName(p.category),
          tags: cleanTags(p.tags),
          favorite: p.favorite === true,
          copyCount: Number.isInteger(p.copyCount) && (p.copyCount as number) >= 0 ? (p.copyCount as number) : 0,
          lastUsedAt: optionalString(p.lastUsedAt),
          createdAt: optionalString(p.createdAt) ?? undefined,
          updatedAt: optionalString(p.updatedAt) ?? undefined,
        };
      } catch (err) {
        if (err instanceof ValidationError) throw new ValidationError(`prompt #${i + 1}: ${err.message}`);
        throw err;
      }
    }),
  };
}
