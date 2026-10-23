import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Menu, Search, X } from 'lucide-react';
import { api } from '../api';
import { copyText } from '../lib/clipboard';
import { parseVariables } from '../lib/variables';
import { ConfirmDialog, TextInputDialog } from './Modal';
import { FillVariablesModal } from './FillVariablesModal';
import { NewPromptButton, PromptEditor } from './PromptEditor';
import { PromptCard } from './PromptCard';
import { PromptDetail } from './PromptDetail';
import { SettingsModal } from './SettingsModal';
import { Sidebar } from './Sidebar';
import { useToast } from './Toasts';
import type { Category, Prompt, PromptInput, SortKey, View } from '../types';

type Dialog =
  | { kind: 'edit'; prompt: Prompt | null; initial?: Partial<PromptInput> }
  | { kind: 'fill'; prompt: Prompt }
  | { kind: 'settings' }
  | { kind: 'category'; category: Category | null }
  | { kind: 'confirm'; title: string; message: React.ReactNode; confirmLabel: string; onConfirm: () => void };

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'Recently edited',
  used: 'Most used',
  lastUsed: 'Recently used',
  title: 'A–Z',
};

function readSort(): SortKey {
  try {
    const value = localStorage.getItem('pc:sort');
    if (value && value in SORT_LABELS) return value as SortKey;
  } catch {
    /* storage unavailable */
  }
  return 'updated';
}

export function Workspace({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ kind: 'all' });
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>(readSort);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const openDialog = (d: Dialog) => setDialogs((list) => [...list, d]);
  const closeDialog = () => setDialogs((list) => list.slice(0, -1));

  const fail = useCallback((err: unknown) => toast(err instanceof Error ? err.message : String(err), 'error'), [toast]);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.prompts(), api.categories()]);
      setPrompts(p);
      setCategories(c);
      setLoaded(true);
    } catch (err) {
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      localStorage.setItem('pc:sort', sort);
    } catch {
      /* storage unavailable */
    }
  }, [sort]);

  const replacePrompt = (p: Prompt) => setPrompts((list) => list.map((x) => (x.id === p.id ? p : x)));

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prompts) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [prompts]);

  const visible = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const list = prompts.filter((p) => {
      if (view.kind === 'favorites' && !p.favorite) return false;
      if (view.kind === 'recent' && !p.lastUsedAt) return false;
      if (view.kind === 'uncategorized' && p.categoryId !== null) return false;
      if (view.kind === 'category' && p.categoryId !== view.id) return false;
      if (activeTags.length && !activeTags.every((t) => p.tags.includes(t))) return false;
      if (terms.length) {
        const category = p.categoryId ? (categoryById.get(p.categoryId)?.name ?? '') : '';
        const haystack = `${p.title}\n${p.body}\n${p.tags.join(' ')}\n${category}`.toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      return true;
    });
    const effectiveSort: SortKey = view.kind === 'recent' ? 'lastUsed' : sort;
    const compare: Record<SortKey, (a: Prompt, b: Prompt) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      used: (a, b) => b.copyCount - a.copyCount || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''),
      lastUsed: (a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    // Favorites stay pinned at the top, except in the "recently used" view where order is the point.
    return list.sort(
      (a, b) => (view.kind === 'recent' ? 0 : Number(b.favorite) - Number(a.favorite)) || compare[effectiveSort](a, b),
    );
  }, [prompts, view, query, activeTags, sort, categoryById]);

  // Keyboard shortcuts: "/" search, "n" new prompt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (dialogs.length || detailId !== null || target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'n') {
        e.preventDefault();
        openDialog({ kind: 'edit', prompt: null });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialogs.length, detailId]);

  // Actions

  const finishCopy = async (prompt: Prompt, text: string) => {
    try {
      await copyText(text);
      toast('Copied to clipboard');
    } catch {
      toast('Could not copy. Your browser blocked clipboard access.', 'error');
      return;
    }
    api.recordCopy(prompt.id).then(replacePrompt).catch(() => {});
  };

  const startCopy = (prompt: Prompt) => {
    if (parseVariables(prompt.body).length) openDialog({ kind: 'fill', prompt });
    else void finishCopy(prompt, prompt.body);
  };

  const toggleFavorite = async (prompt: Prompt) => {
    replacePrompt({ ...prompt, favorite: !prompt.favorite });
    try {
      replacePrompt(await api.setFavorite(prompt.id, !prompt.favorite));
    } catch (err) {
      replacePrompt(prompt);
      fail(err);
    }
  };

  const savePrompt = async (existing: Prompt | null, input: PromptInput) => {
    if (existing) {
      replacePrompt(await api.updatePrompt(existing.id, input));
      toast('Prompt saved');
    } else {
      const created = await api.createPrompt(input);
      setPrompts((list) => [created, ...list]);
      toast('Prompt created');
    }
  };

  const createCategory = async (name: string) => {
    const category = await api.createCategory(name);
    setCategories((list) => [...list, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category;
  };

  const deletePrompt = (prompt: Prompt) =>
    openDialog({
      kind: 'confirm',
      title: 'Delete prompt?',
      message: (
        <>
          <strong>{prompt.title}</strong> will be gone for good.
        </>
      ),
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api.deletePrompt(prompt.id);
          setPrompts((list) => list.filter((p) => p.id !== prompt.id));
          setDetailId(null);
          toast('Prompt deleted');
        } catch (err) {
          fail(err);
        }
      },
    });

  const deleteCategory = (category: Category) =>
    openDialog({
      kind: 'confirm',
      title: 'Delete category?',
      message: (
        <>
          <strong>{category.name}</strong> will be removed. Its prompts stay, just without a category.
        </>
      ),
      confirmLabel: 'Delete category',
      onConfirm: async () => {
        try {
          await api.deleteCategory(category.id);
          setCategories((list) => list.filter((c) => c.id !== category.id));
          setPrompts((list) => list.map((p) => (p.categoryId === category.id ? { ...p, categoryId: null } : p)));
          if (view.kind === 'category' && view.id === category.id) setView({ kind: 'all' });
        } catch (err) {
          fail(err);
        }
      },
    });

  const logout = async () => {
    await api.logout().catch(() => {});
    onLogout();
  };

  const toggleTag = (tag: string) =>
    setActiveTags((list) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]));

  const detail = detailId !== null ? prompts.find((p) => p.id === detailId) : undefined;

  const heading =
    view.kind === 'all'
      ? 'All prompts'
      : view.kind === 'favorites'
        ? 'Favorites'
        : view.kind === 'recent'
          ? 'Recently used'
          : view.kind === 'uncategorized'
            ? 'Uncategorized'
            : (categoryById.get(view.id)?.name ?? 'Category');

  const filtersActive = query || activeTags.length > 0;

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        view={view}
        onView={(v) => {
          setView(v);
          setSidebarOpen(false);
        }}
        prompts={prompts}
        categories={categories}
        tags={tagCounts}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        onNewCategory={() => openDialog({ kind: 'category', category: null })}
        onRenameCategory={(category) => openDialog({ kind: 'category', category })}
        onDeleteCategory={deleteCategory}
        onSettings={() => openDialog({ kind: 'settings' })}
        onLogout={logout}
      />
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="search">
            <Search size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
              placeholder="Search prompts"
              aria-label="Search prompts"
            />
            {query ? (
              <button className="icon-btn icon-btn-sm" onClick={() => setQuery('')} aria-label="Clear search">
                <X size={14} />
              </button>
            ) : (
              <kbd className="search-kbd">/</kbd>
            )}
          </div>
          <NewPromptButton
            onClick={() =>
              openDialog({
                kind: 'edit',
                prompt: null,
                initial: { categoryId: view.kind === 'category' ? view.id : null },
              })
            }
          />
        </header>

        <div className="content">
          <div className="content-head">
            <div>
              <h1>{heading}</h1>
              <p className="muted">
                {visible.length} {visible.length === 1 ? 'prompt' : 'prompts'}
                {activeTags.map((t) => (
                  <button key={t} className="tag tag-button is-active filter-chip" onClick={() => toggleTag(t)}>
                    #{t} <X size={11} />
                  </button>
                ))}
              </p>
            </div>
            {view.kind !== 'recent' && (
              <label className="sort">
                <ArrowDownUp size={14} />
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {!loaded ? null : visible.length === 0 ? (
            <div className="empty">
              <span className="empty-mark">{'{{ }}'}</span>
              {prompts.length === 0 ? (
                <>
                  <h2>No prompts yet</h2>
                  <p className="muted">Save the prompts you keep retyping. Add {'{{variables}}'} for the parts that change.</p>
                  <NewPromptButton onClick={() => openDialog({ kind: 'edit', prompt: null })} />
                </>
              ) : filtersActive ? (
                <>
                  <h2>Nothing matches</h2>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setQuery('');
                      setActiveTags([]);
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <h2>Nothing here yet</h2>
              )}
            </div>
          ) : (
            <div className="grid">
              {visible.map((p) => (
                <PromptCard
                  key={p.id}
                  prompt={p}
                  category={p.categoryId ? categoryById.get(p.categoryId) : undefined}
                  onOpen={() => setDetailId(p.id)}
                  onCopy={() => startCopy(p)}
                  onToggleFavorite={() => toggleFavorite(p)}
                  onTagClick={toggleTag}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {detail && (
        <PromptDetail
          prompt={detail}
          category={detail.categoryId ? categoryById.get(detail.categoryId) : undefined}
          onClose={() => setDetailId(null)}
          onCopy={() => startCopy(detail)}
          onEdit={() => openDialog({ kind: 'edit', prompt: detail })}
          onDuplicate={() =>
            openDialog({
              kind: 'edit',
              prompt: null,
              initial: { title: `${detail.title} (copy)`, body: detail.body, categoryId: detail.categoryId, tags: detail.tags },
            })
          }
          onDelete={() => deletePrompt(detail)}
          onToggleFavorite={() => toggleFavorite(detail)}
        />
      )}

      {dialogs.map((d, i) => {
        const key = `${d.kind}-${i}`;
        switch (d.kind) {
          case 'edit':
            return (
              <PromptEditor
                key={key}
                prompt={d.prompt}
                initial={d.initial}
                categories={categories}
                allTags={tagCounts.map(([t]) => t)}
                onCreateCategory={createCategory}
                onSave={(input) => savePrompt(d.prompt, input)}
                onClose={closeDialog}
              />
            );
          case 'fill':
            return (
              <FillVariablesModal key={key} prompt={d.prompt} onCopy={(text) => finishCopy(d.prompt, text)} onClose={closeDialog} />
            );
          case 'settings':
            return <SettingsModal key={key} onImported={load} onClose={closeDialog} />;
          case 'category':
            return (
              <TextInputDialog
                key={key}
                title={d.category ? 'Rename category' : 'New category'}
                label="Name"
                initialValue={d.category?.name}
                submitLabel={d.category ? 'Rename' : 'Create'}
                onSubmit={async (name) => {
                  if (d.category) {
                    const updated = await api.renameCategory(d.category.id, name);
                    setCategories((list) =>
                      list.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
                    );
                  } else {
                    const created = await createCategory(name);
                    setView({ kind: 'category', id: created.id });
                  }
                }}
                onClose={closeDialog}
              />
            );
          case 'confirm':
            return (
              <ConfirmDialog
                key={key}
                title={d.title}
                message={d.message}
                confirmLabel={d.confirmLabel}
                danger
                onConfirm={d.onConfirm}
                onClose={closeDialog}
              />
            );
        }
      })}
    </div>
  );
}
