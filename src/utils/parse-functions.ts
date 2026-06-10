export type FunctionInfo = {
  name: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
};

export type CallerInfo = {
  callerFile: string;
  callerLine: number;
};

const FUNC_RE = /^(export\s+)?(async\s+)?function\s+(\w+)\s*[<(]/;
const ARROW_RE = /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(/;

export function parseFunctions(source: string): FunctionInfo[] {
  const lines = source.split('\n');
  const results: FunctionInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.length > 0 && (raw[0] === ' ' || raw[0] === '\t')) continue;

    let name: string | null = null;
    let isExported = false;
    let isAsync = false;

    const fm = raw.match(FUNC_RE);
    if (fm) {
      isExported = !!fm[1];
      isAsync = !!fm[2];
      name = fm[3];
    }

    if (!name) {
      const am = raw.match(ARROW_RE);
      if (am) {
        isExported = !!am[1];
        name = am[2];
        isAsync = !!am[3];
      }
    }

    if (!name) continue;

    results.push({
      name,
      startLine: i + 1,
      endLine: findEndLine(lines, i),
      isExported,
      isAsync,
    });
  }

  return results;
}

function findEndLine(lines: string[], startIdx: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let j = startIdx; j < lines.length; j++) {
    for (const ch of lines[j]) {
      if (ch === '{') { depth++; foundOpen = true; }
      else if (ch === '}') depth--;
    }
    // 行の途中で一時的に depth 0 になるケース（`}): string {` 等の
    // 複数行引数オブジェクト型）を誤検出しないよう、判定は行末で行う
    if (foundOpen && depth <= 0) return j + 1;
  }
  return startIdx + 1;
}

export function findCallers(
  targetName: string,
  files: Map<string, string>,
  excludeFile: string
): CallerInfo[] {
  const callers: CallerInfo[] = [];
  const pattern = new RegExp(`\\b${targetName}\\s*\\(`, 'g');

  for (const [filePath, source] of files) {
    if (filePath === excludeFile) continue;
    const lines = source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        callers.push({ callerFile: filePath, callerLine: i + 1 });
      }
    }
  }

  return callers;
}
