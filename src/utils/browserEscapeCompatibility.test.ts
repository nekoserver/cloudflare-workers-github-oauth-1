import { describe, expect, it } from 'vitest';
import { getMarkdownParserScript } from './markdownRenderer';
import { getRepositoriesPage } from '../views/repositories';

function extractFunction(source: string, name: string): (value: unknown) => string {
  const match = source.match(new RegExp(`function ${name}\\((s(?:tr)?)\\) \\{([\\s\\S]*?)\\n\\s*\\}`));
  if (!match) throw new Error(`Could not find ${name}`);
  return new Function('value', `var ${name} = function(${match[1]}) {${match[2]}}; return ${name}(value);`) as (value: unknown) => string;
}

describe('browser-side escape compatibility fixture', () => {
  const markdownEsc = extractFunction(getMarkdownParserScript(), 'esc');
  const repositoriesEsc = extractFunction(getRepositoriesPage({
    username: 'fixture', repositories: [], commitHistoryPageSize: 20,
  }), 'escHtml');

  it.each([
    ['five HTML-sensitive characters', `&<>"'`, `&amp;&lt;&gt;&quot;'`, `&amp;&lt;&gt;&quot;'`],
    ['empty string', '', '', ''],
    ['null-like value', null, TypeError, 'null'],
  ])('%s', (_label, input, markdownExpected, repositoriesExpected) => {
    if (markdownExpected === TypeError) expect(() => markdownEsc(input)).toThrow(TypeError);
    else expect(markdownEsc(input)).toBe(markdownExpected);
    expect(repositoriesEsc(input)).toBe(repositoriesExpected);
  });
});
