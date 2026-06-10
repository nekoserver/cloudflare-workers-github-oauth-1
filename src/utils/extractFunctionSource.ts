const MAX_LINES = 200;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * TypeScript ソース文字列から指定した関数名の定義部分を抽出する。
 * ブレース深度を追跡して終端を検出する（文字列・テンプレートリテラル内のブレースは
 * 誤検知することがあるが、コードビューワ用途では許容範囲）。
 * 200行を超える場合は打ち切る。見つからない場合は null を返す。
 */
export function extractFunctionSource(source: string, functionName: string): string | null {
  if (!source || !functionName) return null;

  const lines = source.split('\n');
  const name = escapeRegExp(functionName);

  // 関数宣言行を検出するパターン群
  const patterns = [
    // function name( / async function name(
    new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*[(<]`),
    // const name = ( / const name = async (
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*(async\\s+)?[(]`),
    // const name = async function
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*async\\s+function`),
    // const name = function
    new RegExp(`(export\\s+)?const\\s+${name}\\s*=\\s*function`),
  ];

  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i];
    if (patterns.some(p => p.test(trimmed))) {
      // 部分一致防止: 前後が識別子文字でないことを確認
      const m = trimmed.match(new RegExp(`\\b${name}\\b`));
      if (m) {
        startLine = i;
        break;
      }
    }
  }
  if (startLine === -1) return null;

  let depth = 0;
  let foundOpen = false;
  let endLine = startLine;

  for (let i = startLine; i < lines.length && i < startLine + MAX_LINES; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') { depth++; foundOpen = true; }
      else if (ch === '}') { depth--; }
    }
    endLine = i;
    if (foundOpen && depth === 0) break;

    // ブレースなしの単行アロー関数: `const f = (x) => expr;`
    if (!foundOpen && i === startLine && line.includes('=>') && /;\s*$/.test(line)) {
      break;
    }
  }

  return lines.slice(startLine, endLine + 1).join('\n');
}
