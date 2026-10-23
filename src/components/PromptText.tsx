import { useMemo } from 'react';
import { splitByVariables } from '../lib/variables';

/** Prompt text with {{variables}} highlighted. With `values`, shows the filled-in result instead. */
export function PromptText({ body, values }: { body: string; values?: Record<string, string> }) {
  const segments = useMemo(() => splitByVariables(body), [body]);
  return (
    <>
      {segments.map((s, i) => {
        if (s.type === 'text') return <span key={i}>{s.text}</span>;
        if (!values) {
          return (
            <span key={i} className="var-token" title={s.defaultValue ? `Default: ${s.defaultValue}` : undefined}>
              {s.raw}
            </span>
          );
        }
        const value = values[s.name] ?? s.defaultValue;
        return value ? (
          <mark key={i} className="var-filled">
            {value}
          </mark>
        ) : (
          <span key={i} className="var-empty">
            {s.name}
          </span>
        );
      })}
    </>
  );
}
