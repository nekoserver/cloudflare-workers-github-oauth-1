import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateMentionEditorConfig, validateMentionEditorTitle } from './utils/mentionEditorConfig';

const validConfig = () => ({
  version: 1, trigger: '/', position: 'top',
  textarea: { width: { value: 40, unit: 'ch' }, height: { value: 15, unit: 'rows' } },
  tabs: [{ label: 'AI', items: ['summarize'] }],
});

describe('mention editor storage validation', () => {
  it('validates titles at the API boundary', () => {
    expect(validateMentionEditorTitle('  My config  ')).toBe('My config');
    expect(validateMentionEditorTitle('')).toBeNull();
    expect(validateMentionEditorTitle('a'.repeat(101))).toBeNull();
  });

  it('accepts a valid config and rejects malformed config', () => {
    expect(validateMentionEditorConfig(validConfig())).not.toBeNull();
    expect(validateMentionEditorConfig({ ...validConfig(), trigger: '#' })).toBeNull();
    expect(validateMentionEditorConfig({ ...validConfig(), tabs: [{ label: 'AI', items: ['has space'] }] })).not.toBeNull();
    expect(validateMentionEditorConfig({ ...validConfig(), tabs: [{ label: 'AI', items: ['has\ttab'] }] })).toBeNull();
    expect(validateMentionEditorConfig({ ...validConfig(), content: 'puts "hello"' })?.content).toBe('puts "hello"');
    expect(validateMentionEditorConfig({ ...validConfig(), content: 'x'.repeat(100_001) })).toBeNull();
  });

  it('defines user-scoped, case-insensitively unique storage', () => {
    const sql = readFileSync('migrations/0163_create_mention_editor_documents.sql', 'utf8');
    expect(sql).toContain('user_id TEXT NOT NULL');
    expect(sql).toContain('title TEXT NOT NULL COLLATE NOCASE');
    expect(sql).toContain('UNIQUE (user_id, title)');
    expect(sql).toContain('CHECK (json_valid(config_json))');
  });
});
