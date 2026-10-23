import { Clock, Folder, FolderPlus, Inbox, Layers, LogOut, Pencil, Settings, Star, Trash2 } from 'lucide-react';
import type { Category, Prompt, View } from '../types';

interface Props {
  view: View;
  onView: (view: View) => void;
  prompts: Prompt[];
  categories: Category[];
  tags: [string, number][];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onNewCategory: () => void;
  onRenameCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onSettings: () => void;
  onLogout: () => void;
  open: boolean;
}

function same(a: View, b: View) {
  return a.kind === b.kind && (a.kind !== 'category' || (b.kind === 'category' && a.id === b.id));
}

export function Sidebar(props: Props) {
  const { view, onView, prompts, categories, tags, activeTags, onToggleTag, open } = props;
  const counts = new Map<number | null, number>();
  for (const p of prompts) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);

  const item = (target: View, icon: React.ReactNode, label: string, count?: number) => (
    <button className={`nav-item ${same(view, target) ? 'is-active' : ''}`} onClick={() => onView(target)}>
      {icon}
      <span className="nav-label">{label}</span>
      {count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );

  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">{'{ }'}</span>
        <span className="brand-name">PromptCentral</span>
      </div>

      <nav className="nav-section">
        {item({ kind: 'all' }, <Layers size={16} />, 'All prompts', prompts.length)}
        {item({ kind: 'favorites' }, <Star size={16} />, 'Favorites', prompts.filter((p) => p.favorite).length)}
        {item({ kind: 'recent' }, <Clock size={16} />, 'Recently used', prompts.filter((p) => p.lastUsedAt).length)}
      </nav>

      <div className="nav-section">
        <div className="nav-heading">
          <span>Categories</span>
          <button className="icon-btn icon-btn-sm" onClick={props.onNewCategory} aria-label="New category" title="New category">
            <FolderPlus size={15} />
          </button>
        </div>
        {categories.map((c) => (
          <div key={c.id} className="nav-row">
            {item({ kind: 'category', id: c.id }, <Folder size={16} />, c.name, counts.get(c.id) ?? 0)}
            <div className="nav-row-actions">
              <button className="icon-btn icon-btn-sm" onClick={() => props.onRenameCategory(c)} aria-label={`Rename ${c.name}`}>
                <Pencil size={13} />
              </button>
              <button className="icon-btn icon-btn-sm" onClick={() => props.onDeleteCategory(c)} aria-label={`Delete ${c.name}`}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {(counts.get(null) ?? 0) > 0 && item({ kind: 'uncategorized' }, <Inbox size={16} />, 'Uncategorized', counts.get(null))}
        {categories.length === 0 && <p className="nav-empty">No categories yet.</p>}
      </div>

      {tags.length > 0 && (
        <div className="nav-section">
          <div className="nav-heading">
            <span>Tags</span>
          </div>
          <div className="nav-tags">
            {tags.map(([tag, n]) => (
              <button
                key={tag}
                className={`tag tag-button ${activeTags.includes(tag) ? 'is-active' : ''}`}
                onClick={() => onToggleTag(tag)}
                title={`${n} prompt${n === 1 ? '' : 's'}`}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sidebar-foot">
        <button className="nav-item" onClick={props.onSettings}>
          <Settings size={16} />
          <span className="nav-label">Import / export</span>
        </button>
        <button className="nav-item" onClick={props.onLogout}>
          <LogOut size={16} />
          <span className="nav-label">Log out</span>
        </button>
      </div>
    </aside>
  );
}
