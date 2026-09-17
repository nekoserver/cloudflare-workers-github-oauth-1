import { describe, expect, it } from 'vitest';
import {
  COUNTRY_LEVEL_JEV_LABELS,
  isPureKatakana,
  matchKatakanaCountryName,
  parseCountryKeywordLabelRows,
  selectJevLabelsForKeyword,
  type JevKeywordClassification,
} from './utils/jevCountryKeyword';
import type { JevLabel } from './utils/jevEvaluation';

const tripLabels: JevLabel[] = [
  { id: 1, question_text: '往路と復路の便は同じ航空会社ですか?', criteria: ['異なる航空会社', '同じ航空会社'] },
  { id: 2, question_text: '直行便ですか?', criteria: ['経由便', '直行便'] },
];

describe('isPureKatakana', () => {
  it('カタカナのみの文字列はtrue', () => {
    expect(isPureKatakana('フランス')).toBe(true);
  });

  it('長音符(ー)・中黒(・)を含んでいてもtrue', () => {
    expect(isPureKatakana('ニュージーランド')).toBe(true);
    expect(isPureKatakana('サントメ・プリンシペ')).toBe(true);
  });

  it('漢字を含む国名(韓国・中国等)はfalse', () => {
    expect(isPureKatakana('韓国')).toBe(false);
    expect(isPureKatakana('大韓民国')).toBe(false);
  });

  it('カタカナと漢字/ひらがなが混在していればfalse', () => {
    expect(isPureKatakana('アラブ首長国連邦')).toBe(false);
  });

  it('空文字・空白のみはfalse', () => {
    expect(isPureKatakana('')).toBe(false);
    expect(isPureKatakana('   ')).toBe(false);
  });

  it('前後の空白はtrim後に判定する', () => {
    expect(isPureKatakana('  フランス  ')).toBe(true);
  });
});

describe('matchKatakanaCountryName', () => {
  it('既知のカタカナ国名一覧に含まれていれば正規化した国名を返す', () => {
    expect(matchKatakanaCountryName('フランス')).toBe('フランス');
    expect(matchKatakanaCountryName('  タイ  ')).toBe('タイ');
  });

  it('カタカナのみだが既知の国名一覧に無い単語はnull(食品名などの誤検出防止)', () => {
    expect(matchKatakanaCountryName('パスタ')).toBeNull();
    expect(matchKatakanaCountryName('コーヒー')).toBeNull();
  });

  it('カタカナではない(漢字を含む)国名はnull', () => {
    expect(matchKatakanaCountryName('韓国')).toBeNull();
  });

  it('国名を含む長い文章(キーワード単体ではない)はnull', () => {
    expect(matchKatakanaCountryName('フランスのおすすめ観光地はどこですか')).toBeNull();
  });
});

describe('COUNTRY_LEVEL_JEV_LABELS', () => {
  it('1件以上定義されている', () => {
    expect(COUNTRY_LEVEL_JEV_LABELS.length).toBeGreaterThan(0);
  });

  it('全ラベルがcriteria(0側/1側の2要素)を持つ(Jev API仕様、jevEvaluation.tsのparseLabelCriteriaと同じ形)', () => {
    for (const label of COUNTRY_LEVEL_JEV_LABELS) {
      expect(label.criteria).toHaveLength(2);
      expect(label.criteria.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    }
  });

  it('idはすべて負の整数(実DBのjev_labels.id、1始まりの正整数と衝突しない合成ラベルであることを示す)', () => {
    for (const label of COUNTRY_LEVEL_JEV_LABELS) {
      expect(Number.isInteger(label.id)).toBe(true);
      expect(label.id).toBeLessThan(0);
    }
  });

  it('idはすべて一意', () => {
    const ids = COUNTRY_LEVEL_JEV_LABELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('question_textはすべて一意(旅行質問集からの追加分との重複が無いことを保証)', () => {
    const texts = COUNTRY_LEVEL_JEV_LABELS.map((l) => l.question_text);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('旅行質問集(パスポート有効期間・電子渡航認証等)から国名単体で判定できる質問を追加済み', () => {
    const texts = COUNTRY_LEVEL_JEV_LABELS.map((l) => l.question_text);
    expect(texts).toContain('パスポートの残存有効期間6か月以上を入国要件とする国ですか?');
    expect(texts).toContain('電子渡航認証(ESTA/ETA等)の事前オンライン申請が必要な国ですか?');
    expect(texts).toContain('入国審査で指紋・顔写真の採取がある国ですか?');
  });

  it('個人の予約状況・旅程依存の質問(航空券・宿泊予約の有無等)は含まない', () => {
    const texts = COUNTRY_LEVEL_JEV_LABELS.map((l) => l.question_text);
    for (const text of texts) {
      expect(text).not.toMatch(/予約(は|済み)|購入済み|手配済み/);
    }
  });
});

describe('selectJevLabelsForKeyword', () => {
  it('カタカナ国名キーワードならkatakana_countryを返し、国名専用ラベルに差し替える', () => {
    const result: JevKeywordClassification = selectJevLabelsForKeyword('フランス', tripLabels);
    expect(result.kind).toBe('katakana_country');
    if (result.kind !== 'katakana_country') throw new Error('unreachable');
    expect(result.countryName).toBe('フランス');
    expect(result.labels).toBe(COUNTRY_LEVEL_JEV_LABELS);
  });

  it('カタカナ国名以外(通常の質問文・回答文)ならfreeformで元のラベルをそのまま通す', () => {
    const result = selectJevLabelsForKeyword('往路と復路の便は同じ航空会社かどうか教えてください', tripLabels);
    expect(result.kind).toBe('freeform');
    expect(result.labels).toBe(tripLabels);
  });

  it('カタカナだが国名一覧に無い語(食品名等)もfreeformとして扱う', () => {
    const result = selectJevLabelsForKeyword('パスタ', tripLabels);
    expect(result.kind).toBe('freeform');
    expect(result.labels).toBe(tripLabels);
  });

  it('空文字はfreeform(既定のラベルをそのまま返す、境界値)', () => {
    const result = selectJevLabelsForKeyword('', tripLabels);
    expect(result.kind).toBe('freeform');
    expect(result.labels).toBe(tripLabels);
  });
});

describe('parseCountryKeywordLabelRows', () => {
  it('jev_country_keyword_labelsのSELECT結果をJevLabel[]へ変換する', () => {
    const result = parseCountryKeywordLabelRows([
      { id: 10, question_text: 'ビザ免除で渡航できる国ですか?', options_json: '["ビザが必要","ビザ免除で渡航できる"]' },
      { id: 11, question_text: '通貨は日本円と異なりますか?', options_json: '["日本円を使う","日本円と異なる通貨"]' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.labels).toEqual([
      { id: 10, question_text: 'ビザ免除で渡航できる国ですか?', criteria: ['ビザが必要', 'ビザ免除で渡航できる'] },
      { id: 11, question_text: '通貨は日本円と異なりますか?', criteria: ['日本円を使う', '日本円と異なる通貨'] },
    ]);
  });

  it('options_jsonがcriteria形式(2要素配列)でない行があればその場でinvalidLabelIdを返す', () => {
    const result = parseCountryKeywordLabelRows([
      { id: 10, question_text: '正常な行', options_json: '["a","b"]' },
      { id: 99, question_text: '壊れた行', options_json: 'not a json array' },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.invalidLabelId).toBe(99);
  });

  it('rowsが空配列なら空のlabelsで成功する', () => {
    const result = parseCountryKeywordLabelRows([]);
    expect(result).toEqual({ ok: true, labels: [] });
  });
});
