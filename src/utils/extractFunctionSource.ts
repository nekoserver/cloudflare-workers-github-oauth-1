function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * TypeScript ソース文字列から指定した関数名の定義部分を抽出する。
 * ブレース深度を追跡して終端を検出する（文字列・テンプレートリテラル内のブレースは
 * 誤検知することがあるが、コードビューワ用途では許容範囲）。
 *
 * @param maxLines 抽出する最大行数。null で上限なし。デフォルト 10000。
 *                 見つからない場合は null を返す。
 */
export function extractFunctionSource(
  source: string,
  functionName: string,
  maxLines: number | null = 10000,
): string | null {
  if (!source || !functionName) return null;

  const lines = source.split('\n');
  const name = escapeRegExp(functionName);

  const patterns = [
    new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*[(<]`),
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*(async\\s+)?[(]`),
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*async\\s+function`),
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*function`),
  ];

  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (patterns.some(p => p.test(lines[i]))) {
      if (lines[i].match(new RegExp(`\\b${name}\\b`))) {
        startLine = i;
        break;
      }
    }
  }
  if (startLine === -1) return null;

  const limit = maxLines === null ? lines.length : startLine + maxLines;
  let depth = 0;
  let foundOpen = false;
  let endLine = startLine;

  for (let i = startLine; i < lines.length && i < limit; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      else if (ch === '}') { depth--; }
    }
    endLine = i;
    if (foundOpen && depth === 0) break;

    if (!foundOpen && i === startLine && line.includes('=>') && /;\s*$/.test(line)) {
      break;
    }
  }

  return lines.slice(startLine, endLine + 1).join('\n');
}
