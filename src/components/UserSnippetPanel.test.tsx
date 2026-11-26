import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserSnippetPanel } from './UserSnippetPanel';
import { createSnippetStore } from '../model/userSnippets';

describe('user snippet library panel', () => {
  it('renders an accessible summary and does not disclose bodies while closed', () => {
    const store = createSnippetStore(null);
    store.mutate({ kind: 'create', item: { prefix: 'my_helper', name: 'Example helper', description: '',
      body: 'print("local private example");', enabled: true } }, 0);
    const html = renderToStaticMarkup(<UserSnippetPanel available={false} store={store} />);
    expect(html).toContain('User Scarp snippets');
    expect(html).toContain('1 / 32 snippets');
    expect(html).toContain('currently disabled');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('local private example');
    expect(html).not.toContain('my_helper');
  });
});
