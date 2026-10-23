import type { Store } from './db.js';

/** A few starter prompts so a fresh install shows how variables work. */
export function seedIfEmpty(store: Store): void {
  if (!store.isEmpty()) return;

  const coding = store.createCategory('Coding');
  const writing = store.createCategory('Writing');

  store.createPrompt({
    title: 'Code review a pull request',
    categoryId: coding.id,
    tags: ['review', 'github'],
    favorite: true,
    body: `Review the pull request at {{pr_url}}.

Focus on:
- Correctness bugs and edge cases
- Security issues
- Anything that would be hard to maintain

The codebase is written in {{language:TypeScript}}. Be direct, rank findings by severity, and skip style nits unless they hide a bug.`,
  });

  store.createPrompt({
    title: 'Explain this error',
    categoryId: coding.id,
    tags: ['debugging'],
    favorite: false,
    body: `I'm getting this error in a {{stack:Node.js}} project:

\`\`\`
{{error}}
\`\`\`

Explain what it means, the most likely causes, and how to fix it. Ask me for more context if you need it.`,
  });

  store.createPrompt({
    title: 'Rewrite for clarity',
    categoryId: writing.id,
    tags: ['editing'],
    favorite: false,
    body: `Rewrite the text below so it is clear and concise for {{audience:a general audience}}. Keep my meaning and tone; cut filler.

{{text}}`,
  });
}
