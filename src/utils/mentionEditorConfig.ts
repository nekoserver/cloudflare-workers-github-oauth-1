export type MentionEditorConfig = {
  version: 1;
  trigger: '/' | '@';
  position: 'top' | 'bottom';
  textarea: {
    width: { value: number; unit: 'ch' | 'px' };
    height: { value: number; unit: 'rows' | 'px' };
  };
  tabs: Array<{ label: string; items: string[] }>;
};

export function validateMentionEditorTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const title = value.trim();
  return title.length >= 1 && title.length <= 100 ? title : null;
}

export function validateMentionEditorConfig(value: unknown): MentionEditorConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, any>;
  if (raw.version !== 1 || (raw.trigger !== '/' && raw.trigger !== '@') || (raw.position !== 'top' && raw.position !== 'bottom')) return null;
  const ranges: Record<string, Record<string, [number, number]>> = {
    width: { ch: [10, 200], px: [100, 2000] },
    height: { rows: [1, 100], px: [40, 2000] },
  };
  for (const axis of ['width', 'height']) {
    const size = raw.textarea?.[axis];
    const range = ranges[axis][size?.unit];
    if (!range || !Number.isInteger(size.value) || size.value < range[0] || size.value > range[1]) return null;
  }
  if (!Array.isArray(raw.tabs) || raw.tabs.length < 1 || raw.tabs.length > 20) return null;
  for (const tab of raw.tabs) {
    if (typeof tab?.label !== 'string' || !tab.label.trim() || tab.label.trim().length > 30) return null;
    if (!Array.isArray(tab.items) || tab.items.length < 1 || tab.items.length > 100) return null;
    // 半角スペースは候補名の一部として許可する。タブや改行など、候補の
    // 1行1件という形式を壊すその他の空白文字は引き続き拒否する。
    if (tab.items.some((item: unknown) => typeof item !== 'string' || !item || item.length > 50 || item.trim() !== item || /[^\S ]/.test(item))) return null;
  }
  return value as MentionEditorConfig;
}
