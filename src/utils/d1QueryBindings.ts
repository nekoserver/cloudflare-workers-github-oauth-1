export type D1QueryBindingValue = string | number | null;

export type D1BindingValidationResult =
  | { ok: true; values: D1QueryBindingValue[] }
  | { ok: false; error: string };

export function getD1BindingCount(sql: string): number {
  let nextAnonymousIndex = 1;
  let highestIndex = 0;
  let quote: "'" | '"' | '`' | ']' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      const closing = quote === ']' ? ']' : quote;
      if (char === closing) {
        if (next === closing && quote !== ']') index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`' || char === '[') {
      quote = char === '[' ? ']' : char;
      continue;
    }
    if (char !== '?') continue;

    let digits = '';
    while (/\d/.test(sql[index + 1] ?? '')) {
      digits += sql[index + 1];
      index += 1;
    }
    const bindingIndex = digits ? Number(digits) : nextAnonymousIndex;
    highestIndex = Math.max(highestIndex, bindingIndex);
    nextAnonymousIndex = Math.max(nextAnonymousIndex, bindingIndex + 1);
  }
  return highestIndex;
}

export function validateD1BindingValues(input: unknown, expectedCount: number): D1BindingValidationResult {
  const values = input === undefined ? [] : input;
  if (!Array.isArray(values)) {
    return { ok: false, error: 'バインド値はJSON配列で指定してください。' };
  }
  if (values.length !== expectedCount) {
    return {
      ok: false,
      error: `このSQLには${expectedCount}個のバインド値が必要です（受信: ${values.length}個）。`,
    };
  }
  const normalized: D1QueryBindingValue[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) {
      normalized.push(value);
      continue;
    }
    if (typeof value === 'boolean') {
      normalized.push(value ? 1 : 0);
      continue;
    }
    return {
      ok: false,
      error: `バインド値${index + 1}は文字列・数値・真偽値・nullのいずれかで指定してください。`,
    };
  }
  return { ok: true, values: normalized };
}
