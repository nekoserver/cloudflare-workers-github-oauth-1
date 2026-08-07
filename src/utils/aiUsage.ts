export function extractAiUsage(raw: Record<string, unknown> | null | undefined): {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
} {
  const u = (typeof raw === 'object' && raw !== null) ? raw : {};
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
  const it = num(u['input_tokens']) ?? num(u['prompt_tokens']);
  const ot = num(u['output_tokens']) ?? num(u['completion_tokens']);
  const tt = num(u['total_tokens']) ?? (it !== null && ot !== null ? it + ot : null);
  return { input_tokens: it, output_tokens: ot, total_tokens: tt };
}
