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

export type PromptInput = Pick<Prompt, 'title' | 'body' | 'categoryId' | 'tags' | 'favorite'>;

export type View =
  | { kind: 'all' }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'uncategorized' }
  | { kind: 'category'; id: number };

export type SortKey = 'updated' | 'used' | 'lastUsed' | 'title';
