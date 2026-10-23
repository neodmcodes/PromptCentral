import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from './Modal';
import { PromptText } from './PromptText';
import { fillVariables, parseVariables } from '../lib/variables';
import type { Prompt } from '../types';

interface Props {
  prompt: Prompt;
  onCopy: (text: string) => Promise<void>;
  onClose: () => void;
}

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={1}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
      }}
    />
  );
}

export function FillVariablesModal({ prompt, onCopy, onClose }: Props) {
  const variables = useMemo(() => parseVariables(prompt.body), [prompt.body]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(variables.map((v) => [v.name, v.defaultValue])),
  );
  const missing = variables.filter((v) => !values[v.name]?.trim()).length;

  const copy = async () => {
    await onCopy(fillVariables(prompt.body, values));
    onClose();
  };

  return (
    <Modal
      title="Fill in the blanks"
      subtitle={prompt.title}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="footer-hint">
            {missing > 0 ? `${missing} left empty` : 'All set'} · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to copy
          </span>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={copy}>
            <Copy size={16} /> Copy prompt
          </button>
        </>
      }
    >
      <div
        className="fill-layout"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void copy();
          }
        }}
      >
        <div className="fill-fields">
          {variables.map((v, i) => (
            <label key={v.name} className="field">
              <span className="field-label">
                <code className="var-label">{v.name}</code>
                {v.defaultValue && <span className="field-hint">default: {v.defaultValue}</span>}
              </span>
              <AutoTextarea
                className="input"
                value={values[v.name] ?? ''}
                placeholder={`Enter ${v.name.replace(/[_\-.]+/g, ' ')}`}
                data-autofocus={i === 0 ? true : undefined}
                onChange={(e) => setValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="fill-preview">
          <span className="section-label">Preview</span>
          <pre className="prompt-pre">
            <PromptText body={prompt.body} values={values} />
          </pre>
        </div>
      </div>
    </Modal>
  );
}
