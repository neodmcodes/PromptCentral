export interface PromptVariable {
  name: string;
  defaultValue: string;
}

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'var'; name: string; defaultValue: string; raw: string };

/** Matches {{name}} and {{name:default value}}. Names: letters, digits, _, -, . and inner spaces. */
const VARIABLE = /\{\{\s*([A-Za-z0-9_][\w\-. ]*?)\s*(?::([^{}]*))?\}\}/g;

export function splitByVariables(body: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of body.matchAll(VARIABLE)) {
    const start = match.index;
    if (start > last) segments.push({ type: 'text', text: body.slice(last, start) });
    segments.push({ type: 'var', name: match[1]!, defaultValue: (match[2] ?? '').trim(), raw: match[0] });
    last = start + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) });
  return segments;
}

/** Unique variables in order of first appearance; the first non-empty default wins. */
export function parseVariables(body: string): PromptVariable[] {
  const byName = new Map<string, PromptVariable>();
  for (const segment of splitByVariables(body)) {
    if (segment.type !== 'var') continue;
    const existing = byName.get(segment.name);
    if (!existing) byName.set(segment.name, { name: segment.name, defaultValue: segment.defaultValue });
    else if (!existing.defaultValue) existing.defaultValue = segment.defaultValue;
  }
  return [...byName.values()];
}

export function fillVariables(body: string, values: Record<string, string>): string {
  const defaults = new Map(parseVariables(body).map((v) => [v.name, v.defaultValue]));
  return body.replace(VARIABLE, (_raw, name: string) => values[name] ?? defaults.get(name) ?? '');
}
