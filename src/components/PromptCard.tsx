import { Braces, Copy, Star } from 'lucide-react';
import { PromptText } from './PromptText';
import { parseVariables } from '../lib/variables';
import { plural, timeAgo } from '../lib/format';
import type { Category, Prompt } from '../types';

interface Props {
  prompt: Prompt;
  category: Category | undefined;
  onOpen: () => void;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onTagClick: (tag: string) => void;
}

export function PromptCard({ prompt, category, onOpen, onCopy, onToggleFavorite, onTagClick }: Props) {
  const varCount = parseVariables(prompt.body).length;
  const snippet = prompt.body.length > 600 ? `${prompt.body.slice(0, 600)}…` : prompt.body;

  return (
    <article className="card" onClick={onOpen}>
      <header className="card-head">
        <span className="card-category">{category?.name ?? 'Uncategorized'}</span>
        <button
          className={`icon-btn star ${prompt.favorite ? 'is-on' : ''}`}
          aria-label={prompt.favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={prompt.favorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
        >
          <Star size={16} fill={prompt.favorite ? 'currentColor' : 'none'} />
        </button>
      </header>
      <h3 className="card-title">{prompt.title}</h3>
      <pre className="card-snippet">
        <PromptText body={snippet} />
      </pre>
      {prompt.tags.length > 0 && (
        <div className="card-tags">
          {prompt.tags.map((tag) => (
            <button
              key={tag}
              className="tag tag-button"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      <footer className="card-foot">
        <span className="card-meta" title={prompt.lastUsedAt ? `Last used ${timeAgo(prompt.lastUsedAt)}` : 'Never copied'}>
          {prompt.copyCount > 0 ? `${plural(prompt.copyCount, 'use')} · ${timeAgo(prompt.lastUsedAt)}` : 'Not used yet'}
        </span>
        <button
          className="btn btn-copy"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
        >
          {varCount > 0 ? (
            <>
              <Braces size={14} /> Fill & copy
            </>
          ) : (
            <>
              <Copy size={14} /> Copy
            </>
          )}
        </button>
      </footer>
    </article>
  );
}
