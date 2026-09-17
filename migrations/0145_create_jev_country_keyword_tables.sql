CREATE TABLE IF NOT EXISTS jev_country_keyword_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_text TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jev_country_keyword_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL,
  user_id TEXT NOT NULL,
  jev_country_keyword_label_id INTEGER NOT NULL REFERENCES jev_country_keyword_labels(id),
  value REAL NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_country_keyword_evaluations_unique ON jev_country_keyword_evaluations(user_id, keyword, jev_country_keyword_label_id);
CREATE INDEX IF NOT EXISTS idx_jev_country_keyword_evaluations_keyword ON jev_country_keyword_evaluations(keyword);

INSERT OR IGNORE INTO jev_country_keyword_labels (question_text, options_json) VALUES
  ('日本国籍者がビザ(査証)無しで渡航できる国ですか?', '["ビザが必要","ビザ免除で渡航できる"]'),
  ('日本語以外が公用語の国ですか?', '["日本語が公用語","日本語以外が公用語"]'),
  ('英語が公用語または広く通じる国ですか?', '["英語はあまり通じない","英語が公用語または広く通じる"]'),
  ('通貨単位は日本円とは異なる国ですか?', '["日本円を使用する","日本円とは異なる通貨を使う"]'),
  ('日本と陸続きで国境を接している国ですか?', '["日本と陸続きではない","日本と陸続きで国境を接する"]'),
  ('島国(国土が海に囲まれている)ですか?', '["大陸内に位置する内陸国・陸続きの国","国土が海に囲まれた島国"]'),
  ('自動車は右側通行の国ですか?', '["左側通行","右側通行"]'),
  ('日本との時差は6時間以上ある国ですか?', '["時差は6時間未満","時差は6時間以上"]'),
  ('北半球に位置する国ですか?', '["南半球に位置する","北半球に位置する"]'),
  ('EU(欧州連合)加盟国ですか?', '["EU非加盟国","EU加盟国"]'),
  ('日本の外務省が渡航に注意を要すると案内している地域を含む国ですか?', '["注意喚起の対象地域は含まれない","注意喚起の対象地域を含む"]'),
  ('世界遺産(自然遺産・文化遺産)に登録された場所がある国ですか?', '["世界遺産の登録は無い","世界遺産が登録されている"]'),
  ('日本からの直行便が就航している国ですか?', '["直行便は無く乗り継ぎが必要","日本からの直行便がある"]'),
  ('通年で温暖な気候(熱帯・亜熱帯)が中心の国ですか?', '["温帯・寒帯など温暖ではない地域が中心","熱帯・亜熱帯など温暖な地域が中心"]'),
  ('公用語の表記にラテン文字(アルファベット)を使う国ですか?', '["ラテン文字以外の文字体系を使う","ラテン文字(アルファベット)を使う"]');
