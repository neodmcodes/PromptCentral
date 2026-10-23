import { describe, expect, it } from 'vitest';
import { fillVariables, parseVariables, splitByVariables } from './variables';

describe('parseVariables', () => {
  it('finds plain and defaulted variables in order', () => {
    expect(parseVariables('Review {{pr_url}} in {{ language : TypeScript }}')).toEqual([
      { name: 'pr_url', defaultValue: '' },
      { name: 'language', defaultValue: 'TypeScript' },
    ]);
  });

  it('dedupes repeated variables and keeps the first non-empty default', () => {
    expect(parseVariables('{{a}} {{b:x}} {{a:later}} {{b:y}}')).toEqual([
      { name: 'a', defaultValue: 'later' },
      { name: 'b', defaultValue: 'x' },
    ]);
  });

  it('allows spaces, dots and dashes in names and colons in defaults', () => {
    expect(parseVariables('{{ PR link }} {{repo.name}} {{base-branch:main}} {{time:12:30}}')).toEqual([
      { name: 'PR link', defaultValue: '' },
      { name: 'repo.name', defaultValue: '' },
      { name: 'base-branch', defaultValue: 'main' },
      { name: 'time', defaultValue: '12:30' },
    ]);
  });

  it('ignores things that are not variables', () => {
    expect(parseVariables('{{}} {{ }} { single } {{{x}}} {{:nope}}')).toEqual([{ name: 'x', defaultValue: '' }]);
  });
});

describe('fillVariables', () => {
  it('replaces every occurrence and falls back to defaults', () => {
    const body = 'Review {{pr_url}} ({{lang:Go}}). Again: {{pr_url}}';
    expect(fillVariables(body, { pr_url: 'https://x/1' })).toBe('Review https://x/1 (Go). Again: https://x/1');
  });

  it('uses an explicitly empty value instead of the default', () => {
    expect(fillVariables('[{{lang:Go}}]', { lang: '' })).toBe('[]');
  });

  it('does not re-expand braces inside filled values', () => {
    expect(fillVariables('{{a}} {{b}}', { a: '{{b}}', b: 'B' })).toBe('{{b}} B');
  });
});

describe('splitByVariables', () => {
  it('round-trips the original text', () => {
    const body = 'a {{x}} b {{y:z}} c';
    const rebuilt = splitByVariables(body)
      .map((s) => (s.type === 'text' ? s.text : s.raw))
      .join('');
    expect(rebuilt).toBe(body);
  });
});
