import type { Category, Prompt, PromptInput } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && url !== '/login') onUnauthorized();
    throw new ApiError((data as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  session: () => request<{ authenticated: boolean }>('GET', '/session'),
  login: (password: string) => request<{ authenticated: boolean }>('POST', '/login', { password }),
  logout: () => request<{ authenticated: boolean }>('POST', '/logout'),

  categories: () => request<Category[]>('GET', '/categories'),
  createCategory: (name: string) => request<Category>('POST', '/categories', { name }),
  renameCategory: (id: number, name: string) => request<Category>('PATCH', `/categories/${id}`, { name }),
  deleteCategory: (id: number) => request<void>('DELETE', `/categories/${id}`),

  prompts: () => request<Prompt[]>('GET', '/prompts'),
  createPrompt: (input: PromptInput) => request<Prompt>('POST', '/prompts', input),
  updatePrompt: (id: number, input: PromptInput) => request<Prompt>('PUT', `/prompts/${id}`, input),
  setFavorite: (id: number, favorite: boolean) => request<Prompt>('PUT', `/prompts/${id}/favorite`, { favorite }),
  recordCopy: (id: number) => request<Prompt>('POST', `/prompts/${id}/copy`),
  deletePrompt: (id: number) => request<void>('DELETE', `/prompts/${id}`),

  exportAll: () => request<unknown>('GET', '/export'),
  importAll: (data: unknown, mode: 'merge' | 'replace') =>
    request<{ categories: number; prompts: number }>('POST', `/import?mode=${mode}`, data),
};
