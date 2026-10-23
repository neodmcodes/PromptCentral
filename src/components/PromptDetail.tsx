import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Braces, Copy, CopyPlus, Pencil, Star, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { PromptText } from './PromptText';
import { parseVariables } from '../lib/variables';
import { plural, timeAgo } from '../lib/format';
import type { Category, Prompt } from '../types';

interface Props {
  prompt: Prompt;
  category: Category | undefined;
  onCopy: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export function PromptDetail(props: Props) {
  const { prompt, category, onCopy, onEdit, onDuplicate, onDelete, onToggleFavorite, onClose } = props;
  const [mode, setMode] = useState<'raw' | 'preview'>(() => {
    try {
      return localStorage.getItem('pc:detail-mode') === 'preview' ? 'preview' : 'raw';
    } catch {
      return 'raw';
    }
  });
  const variables = parseVariables(prompt.body);

  const switchMode = (next: 'raw' | 'preview') => {
    setMode(next);
    try {
      localStorage.setItem('pc:detail-mode', next);
    } catch {
      /* private mode */
    }
  };

  return (
    <Modal
      title={prompt.title}
      subtitle={
        <>
          {category?.name ?? 'Uncategorized'} · {plural(prompt.copyCount, 'use')} · last used {timeAgo(prompt.lastUsedAt)} ·
          edited {timeAgo(prompt.updatedAt)}
        </>
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          <div className="footer-left">
            <button className="icon-btn" onClick={onDelete} aria-label="Delete" title="Delete">
              <Trash2 size={17} />
            </button>
            <button className="icon-btn" onClick={onDuplicate} aria-label="Duplicate" title="Duplicate">
              <CopyPlus size={17} />
            </button>
            <button
              className={`icon-btn star ${prompt.favorite ? 'is-on' : ''}`}
              onClick={onToggleFavorite}
              aria-label="Favorite"
              aria-pressed={prompt.favorite}
              title={prompt.favorite ? 'Unfavorite' : 'Favorite'}
            >
              <Star size={17} fill={prompt.favorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <button className="btn btn-ghost" onClick={onEdit}>
            <Pencil size={15} /> Edit
          </button>
          <button className="btn btn-primary" onClick={onCopy} data-autofocus>
            {variables.length ? <Braces size={16} /> : <Copy size={16} />}
            {variables.length ? 'Fill & copy' : 'Copy'}
          </button>
        </>
      }
    >
      <div className="detail-toolbar">
        <div className="detail-tags">
          {prompt.tags.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
          {variables.map((v) => (
            <span key={v.name} className="var-chip">
              {v.name}
              {v.defaultValue && <span className="var-chip-default">= {v.defaultValue}</span>}
            </span>
          ))}
        </div>
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={mode === 'raw'} onClick={() => switchMode('raw')}>
            Raw
          </button>
          <button role="tab" aria-selected={mode === 'preview'} onClick={() => switchMode('preview')}>
            Preview
          </button>
        </div>
      </div>
      {mode === 'raw' ? (
        <pre className="prompt-pre prompt-pre-detail">
          <PromptText body={prompt.body} />
        </pre>
      ) : (
        <div className="markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{prompt.body}</ReactMarkdown>
        </div>
      )}
    </Modal>
  );
}
