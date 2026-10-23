import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

export function TagInput({ tags, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').replace(/\s+/g, '-');
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) onChange([...tags, tag]);
    setDraft('');
  };

  const matches = draft
    ? suggestions
        .filter((s) => s.toLowerCase().includes(draft.toLowerCase().replace(/^#/, '')))
        .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
        .slice(0, 6)
    : [];

  return (
    <div className="tag-input-wrap">
      <div className="tag-input input">
        {tags.map((tag) => (
          <span key={tag} className="tag tag-removable">
            #{tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(tags.filter((t) => t !== tag))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          placeholder={tags.length ? '' : 'Add tags…'}
          onChange={(e) => {
            const value = e.target.value;
            if (value.endsWith(',')) add(value.slice(0, -1));
            else setDraft(value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {matches.length > 0 && (
        <div className="tag-suggestions">
          {matches.map((s) => (
            <button
              type="button"
              key={s}
              className="tag tag-button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
