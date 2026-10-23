import { useMemo, useRef, useState } from 'react';
import { Braces, Plus } from 'lucide-react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { parseVariables } from '../lib/variables';
import type { Category, Prompt, PromptInput } from '../types';

interface Props {
  prompt: Prompt | null;
  initial?: Partial<PromptInput>;
  categories: Category[];
  allTags: string[];
  onCreateCategory: (name: string) => Promise<Category>;
  onSave: (input: PromptInput) => Promise<void>;
  onClose: () => void;
}

const NEW_CATEGORY = '__new__';

export function PromptEditor({ prompt, initial, categories, allTags, onCreateCategory, onSave, onClose }: Props) {
  const [title, setTitle] = useState(prompt?.title ?? initial?.title ?? '');
  const [body, setBody] = useState(prompt?.body ?? initial?.body ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(prompt?.categoryId ?? initial?.categoryId ?? null);
  const [tags, setTags] = useState<string[]>(prompt?.tags ?? initial?.tags ?? []);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const variables = useMemo(() => parseVariables(body), [body]);

  const insertVariable = () => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const selected = body.slice(start, end).trim();
    const name = /^[\w\-. ]+$/.test(selected) ? selected.replace(/\s+/g, '_') : 'variable';
    const token = `{{${name}}}`;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2 + name.length);
    });
  };

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      let finalCategoryId = categoryId;
      if (newCategory !== null && newCategory.trim()) {
        const existing = categories.find((c) => c.name.toLowerCase() === newCategory.trim().toLowerCase());
        finalCategoryId = existing ? existing.id : (await onCreateCategory(newCategory.trim())).id;
      }
      await onSave({ title, body, categoryId: finalCategoryId, tags, favorite: prompt?.favorite ?? false });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={prompt ? 'Edit prompt' : 'New prompt'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="footer-hint">
            <kbd>Ctrl</kbd>+<kbd>S</kbd> to save
          </span>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="prompt-form" disabled={saving}>
            {saving ? 'Saving…' : prompt ? 'Save changes' : 'Save prompt'}
          </button>
        </>
      }
    >
      <form
        id="prompt-form"
        className="editor"
        onSubmit={save}
        onKeyDown={(e) => {
          if ((e.key === 's' || e.key === 'Enter') && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
      >
        <label className="field">
          <span className="field-label">Title</span>
          <input
            className="input input-lg"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Code review a pull request"
            maxLength={200}
            data-autofocus
            required
          />
        </label>

        <div className="editor-row">
          <label className="field">
            <span className="field-label">Category</span>
            {newCategory === null ? (
              <select
                className="input"
                value={categoryId ?? ''}
                onChange={(e) => {
                  if (e.target.value === NEW_CATEGORY) setNewCategory('');
                  else setCategoryId(e.target.value ? Number(e.target.value) : null);
                }}
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
            ) : (
              <div className="inline-input">
                <input
                  className="input"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                  maxLength={60}
                  autoFocus
                />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNewCategory(null)}>
                  Cancel
                </button>
              </div>
            )}
          </label>
          <div className="field">
            <span className="field-label">Tags</span>
            <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
          </div>
        </div>

        <div className="field field-grow">
          <span className="field-label field-label-row">
            <span>Prompt</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={insertVariable}>
              <Braces size={14} /> Insert variable
            </button>
          </span>
          <textarea
            ref={bodyRef}
            className="input textarea-mono"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'Write your prompt. Use {{pr_url}} for something you fill in on copy,\nor {{language:TypeScript}} to give it a default value.'}
            spellCheck={false}
            required
          />
        </div>

        <div className="editor-vars">
          {variables.length === 0 ? (
            <span className="muted">
              No variables yet. Wrap a word in <code>{'{{ }}'}</code> to ask for it when copying.
            </span>
          ) : (
            <>
              <span className="muted">Asks for:</span>
              {variables.map((v) => (
                <span key={v.name} className="var-chip">
                  {v.name}
                  {v.defaultValue && <span className="var-chip-default">= {v.defaultValue}</span>}
                </span>
              ))}
            </>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function NewPromptButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-primary" onClick={onClick}>
      <Plus size={16} /> <span className="hide-sm">New prompt</span>
    </button>
  );
}
