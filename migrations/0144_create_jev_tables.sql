CREATE TABLE IF NOT EXISTS jev_label_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_label_groups_name ON jev_label_groups(name);

CREATE TABLE IF NOT EXISTS jev_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json TEXT,
  jev_group_id INTEGER NOT NULL REFERENCES jev_label_groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jev_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  share_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT,
  jev_label_id INTEGER NOT NULL REFERENCES jev_labels(id),
  value REAL NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_evaluations_unique ON jev_evaluations(target_type, user_id, share_id, model, jev_label_id);
CREATE INDEX IF NOT EXISTS idx_jev_evaluations_share ON jev_evaluations(share_id);

INSERT OR IGNORE INTO jev_label_groups (name) VALUES
  ('事実の正確さ'),
  ('論理・整合性'),
  ('伝わりやすさ'),
  ('応答姿勢・手続き');

INSERT OR IGNORE INTO jev_labels (question_type, question_text, jev_group_id) VALUES
  ('score', '事実性(0=事実誤認がある, 1=事実として正しい)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '根拠(0=根拠・出典が不足, 1=根拠が明示されている)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '出典品質(0=出所不明・低信頼, 1=一次情報・適切な資料)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '出典整合性(0=出典が主張を支えていない, 1=主張が出典で裏付けられる)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '検証可能性(0=確認不能な主張, 1=第三者が検証可能)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '鮮度(0=情報が古い可能性, 1=最新情報に基づいている)', (SELECT id FROM jev_label_groups WHERE name = '事実の正確さ')),
  ('score', '整合性(0=文中で矛盾する, 1=前後で一貫している)', (SELECT id FROM jev_label_groups WHERE name = '論理・整合性')),
  ('score', '論理性(0=結論と根拠がつながらない, 1=推論関係が成立)', (SELECT id FROM jev_label_groups WHERE name = '論理・整合性')),
  ('score', '完全性(0=必要事項が欠落, 1=必要事項を網羅)', (SELECT id FROM jev_label_groups WHERE name = '論理・整合性')),
  ('score', '網羅性(0=重要な例外・条件を落とす, 1=主要な条件・例外を含む)', (SELECT id FROM jev_label_groups WHERE name = '論理・整合性')),
  ('score', '明確性(0=曖昧・多義的, 1=意味が一意に取れる)', (SELECT id FROM jev_label_groups WHERE name = '伝わりやすさ')),
  ('score', '具体性(0=一般化しすぎ, 1=具体的事象を説明している)', (SELECT id FROM jev_label_groups WHERE name = '伝わりやすさ')),
  ('score', '簡潔性(0=冗長・重複が多い, 1=必要十分)', (SELECT id FROM jev_label_groups WHERE name = '伝わりやすさ')),
  ('score', '定量基準(0=比較表現に基準が無い, 1=基準・単位が明示されている)', (SELECT id FROM jev_label_groups WHERE name = '伝わりやすさ')),
  ('score', '関連性(0=質問から逸れている, 1=質問に直接答えている)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き')),
  ('score', '文脈適合性(0=条件・対象を取り違える, 1=与えられた条件に沿う)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き')),
  ('score', '指示遵守(0=指定形式・条件を無視, 1=指示を満たす)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き')),
  ('score', '不確実性の明示(0=推測を断定する, 1=不明・推定を区別)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き')),
  ('score', '客観性(0=主観・憶測が混ざる, 1=客観的・検証済み)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き')),
  ('score', '再現性(0=同条件でも判定基準が揺れる, 1=同一基準で再判定可能)', (SELECT id FROM jev_label_groups WHERE name = '応答姿勢・手続き'));
