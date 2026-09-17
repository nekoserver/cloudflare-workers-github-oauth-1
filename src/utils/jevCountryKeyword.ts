import { parseLabelCriteria, type JevLabel } from './jevEvaluation';

// jev-score(callJevApi)へ渡す`state`は、本来はAIチャットの質問文・回答文
// (文章)を想定しているが、AI分類のキーワード群を対象にJev評価を行う場合、
// keyword自体がstateになる。keywordがカタカナのみの国名(「フランス」
// 「タイ」等)だと、往路/復路の便や宿泊予約といった「旅程が既にある」
// ことを前提にした質問(このリポジトリの旅行質問集はそちら側)には
// ほとんど答えようがない(国名1語からは旅程の詳細が読み取れないため)。
// そこで、キーワードが「カタカナの国名」かどうかをここで判定し、その
// 場合だけ国名1語からでも判定できる国レベルの質問セット
// (COUNTRY_LEVEL_JEV_LABELS)に差し替える処理系を提供する。

// 既知のカタカナ国名一覧。「カタカナのみの文字列なら何でも国名として
// 扱う」と、カタカナの食品名・地名以外の一般名詞(例:「パスタ」
// 「コーヒー」)まで国名扱いしてしまう誤検出が起きるため、この一覧に
// 含まれるものだけを国名と判定する(安全側)。漢字を含む国名
// (「韓国」「中国」「台湾」等)は対象外(このリポジトリの他の処理系で
// 扱う想定)。
export const KATAKANA_COUNTRY_NAMES: readonly string[] = [
  // ヨーロッパ
  'アイスランド',
  'アイルランド',
  'イギリス',
  'イタリア',
  'ウクライナ',
  'オーストリア',
  'オランダ',
  'ギリシャ',
  'クロアチア',
  'スイス',
  'スウェーデン',
  'スペイン',
  'スロバキア',
  'スロベニア',
  'セルビア',
  'チェコ',
  'デンマーク',
  'ドイツ',
  'ノルウェー',
  'ハンガリー',
  'フィンランド',
  'フランス',
  'ブルガリア',
  'ベラルーシ',
  'ベルギー',
  'ポーランド',
  'ポルトガル',
  'マルタ',
  'モナコ',
  'ラトビア',
  'リトアニア',
  'ルーマニア',
  'ルクセンブルク',
  'ロシア',
  // 北米・中南米
  'アメリカ',
  'アルゼンチン',
  'エクアドル',
  'カナダ',
  'キューバ',
  'コスタリカ',
  'コロンビア',
  'チリ',
  'ブラジル',
  'ベネズエラ',
  'ペルー',
  'ボリビア',
  'メキシコ',
  'パナマ',
  'ジャマイカ',
  'ウルグアイ',
  'パラグアイ',
  // アジア
  'インド',
  'インドネシア',
  'カンボジア',
  'シンガポール',
  'スリランカ',
  'タイ',
  'ネパール',
  'パキスタン',
  'バングラデシュ',
  'フィリピン',
  'ブータン',
  'ベトナム',
  'マレーシア',
  'ミャンマー',
  'モンゴル',
  'ラオス',
  // 中東・中央アジア
  'イスラエル',
  'イラン',
  'イラク',
  'カタール',
  'カザフスタン',
  'クウェート',
  'トルコ',
  'ウズベキスタン',
  'ヨルダン',
  // アフリカ
  'エジプト',
  'エチオピア',
  'ガーナ',
  'ケニア',
  'ザンビア',
  'チュニジア',
  'ナイジェリア',
  'モロッコ',
  // オセアニア
  'オーストラリア',
  'ニュージーランド',
  'パラオ',
  'フィジー',
  'サモア'
] as const;

const KATAKANA_COUNTRY_NAME_SET = new Set(KATAKANA_COUNTRY_NAMES);

// カタカナ(ァ-ヶ)・長音符(ー)・繰り返し記号(ヽヾ)・中黒(・、複合国名
// 「サントメ・プリンシペ」等に必要)のみで構成される文字列かどうか。
const KATAKANA_ONLY_PATTERN = /^[ァ-ヶーヽヾ・]+$/;

export function isPureKatakana(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return KATAKANA_ONLY_PATTERN.test(trimmed);
}

/**
 * keywordがKATAKANA_COUNTRY_NAMESに登録された既知のカタカナ国名(前後の
 * 空白は無視)であれば正規化した国名を、そうでなければnullを返す。
 * 「カタカナのみ」であることと「既知の国名であること」の両方を満たす
 * 場合だけ一致とみなす(カタカナの一般名詞やカタカナを含む文章を
 * 国名と誤判定しないため)。
 */
export function matchKatakanaCountryName(text: string): string | null {
  const trimmed = text.trim();
  if (!isPureKatakana(trimmed)) return null;
  return KATAKANA_COUNTRY_NAME_SET.has(trimmed) ? trimmed : null;
}

// キーワードがカタカナの国名1語だった場合に使う、国名だけから判定できる
// 質問セット。「旅程を前提にした質問」(航空券・宿泊予約の有無など)は
// 国名1語からは答えられないため含めない。実際の各国の事実(ビザ要否等)
// はここでは判定せず、question_text/criteriaという「問い」と「0側/1側の
// 説明」だけを渡し、実際の当否判定はJev API(callJevApi)側のAIが行う。
//
// idは実DBのjev_labelsテーブル(1始まりの正整数、AUTOINCREMENT)とは
// 別の合成ラベルであることを示すため、すべて負の整数で採番している。
// jev_labelsに登録して永続化したい場合は、このidをそのままINSERTせず
// (負のidをそのままキーにすると本物のjev_labelsと衝突しうる)、
// question_text/criteriaの内容だけを使って新規INSERTすること。
export const COUNTRY_LEVEL_JEV_LABELS: JevLabel[] = [
  { id: -1, question_text: '日本国籍者がビザ(査証)無しで渡航できる国ですか?', criteria: ['ビザが必要', 'ビザ免除で渡航できる'] },
  { id: -2, question_text: '日本語以外が公用語の国ですか?', criteria: ['日本語が公用語', '日本語以外が公用語'] },
  { id: -3, question_text: '英語が公用語または広く通じる国ですか?', criteria: ['英語はあまり通じない', '英語が公用語または広く通じる'] },
  { id: -4, question_text: '通貨単位は日本円とは異なる国ですか?', criteria: ['日本円を使用する', '日本円とは異なる通貨を使う'] },
  { id: -5, question_text: '日本と陸続きで国境を接している国ですか?', criteria: ['日本と陸続きではない', '日本と陸続きで国境を接する'] },
  { id: -6, question_text: '島国(国土が海に囲まれている)ですか?', criteria: ['大陸内に位置する内陸国・陸続きの国', '国土が海に囲まれた島国'] },
  { id: -7, question_text: '自動車は右側通行の国ですか?', criteria: ['左側通行', '右側通行'] },
  { id: -8, question_text: '日本との時差は6時間以上ある国ですか?', criteria: ['時差は6時間未満', '時差は6時間以上'] },
  { id: -9, question_text: '北半球に位置する国ですか?', criteria: ['南半球に位置する', '北半球に位置する'] },
  { id: -10, question_text: 'EU(欧州連合)加盟国ですか?', criteria: ['EU非加盟国', 'EU加盟国'] },
  { id: -11, question_text: '日本の外務省が渡航に注意を要すると案内している地域を含む国ですか?', criteria: ['注意喚起の対象地域は含まれない', '注意喚起の対象地域を含む'] },
  { id: -12, question_text: '世界遺産(自然遺産・文化遺産)に登録された場所がある国ですか?', criteria: ['世界遺産の登録は無い', '世界遺産が登録されている'] },
  { id: -13, question_text: '日本からの直行便が就航している国ですか?', criteria: ['直行便は無く乗り継ぎが必要', '日本からの直行便がある'] },
  { id: -14, question_text: '通年で温暖な気候(熱帯・亜熱帯)が中心の国ですか?', criteria: ['温帯・寒帯など温暖ではない地域が中心', '熱帯・亜熱帯など温暖な地域が中心'] },
  { id: -15, question_text: '公用語の表記にラテン文字(アルファベット)を使う国ですか?', criteria: ['ラテン文字以外の文字体系を使う', 'ラテン文字(アルファベット)を使う'] },
  // ここから、旅行チェックリスト(航空券・宿泊予約等の個人の予約状況を
  // 前提にした質問集)のうち、予約状況に依存せず国名だけから判定できる
  // ものだけを選んで追加した15件。パスポート残存有効期間・電子渡航認証・
  // 生体情報採取・ハラル対応・自然災害リスク・ATM/電子決済事情・
  // 極端な日照時間・免税制度・ドローン規制・高地の有無・チップ習慣は、
  // いずれも「渡航者個人が何を予約・手配したか」ではなく「その国の制度・
  // 地理・慣習」であるため対象に含める。「航空券のキャンセル無料か」
  // 「宿泊先の予約は完了しているか」等の個人の予約状況に依存する質問は
  // 引き続き対象外(冒頭のコメント参照)。
  { id: -16, question_text: 'パスポートの残存有効期間6か月以上を入国要件とする国ですか?', criteria: ['入国要件に含まれない(または不明)', '入国要件として求められる'] },
  { id: -17, question_text: '入国にワクチン接種証明が必要な場合がある国ですか?', criteria: ['ワクチン接種証明は不要', 'ワクチン接種証明が必要な場合がある'] },
  { id: -18, question_text: '電子渡航認証(ESTA/ETA等)の事前オンライン申請が必要な国ですか?', criteria: ['電子渡航認証は不要', '電子渡航認証の事前申請が必要'] },
  { id: -19, question_text: '入国審査で指紋・顔写真の採取がある国ですか?', criteria: ['指紋・顔写真の採取は無い', '指紋・顔写真の採取がある'] },
  { id: -20, question_text: 'イスラム教徒が多数派でハラル対応が一般的な国ですか?', criteria: ['ハラル対応は一般的ではない', 'ハラル対応が一般的'] },
  { id: -21, question_text: '地震・台風など自然災害のリスクが高い地域を含む国ですか?', criteria: ['自然災害リスクが高い地域は少ない', '自然災害リスクが高い地域を含む'] },
  { id: -22, question_text: 'ATMでクレジットカードから現地通貨を引き出せる環境が一般的な国ですか?', criteria: ['ATMでの現地通貨引き出しは一般的ではない', 'ATMでの現地通貨引き出しが一般的'] },
  { id: -23, question_text: 'QRコード決済など電子決済が主流の国ですか?', criteria: ['電子決済はあまり普及していない', '電子決済が主流'] },
  { id: -24, question_text: '白夜・極夜など極端な日照時間になる地域を含む国ですか?', criteria: ['極端な日照時間の地域は無い', '白夜・極夜等の地域を含む'] },
  { id: -25, question_text: '外国人旅行者向けの免税(Tax Free)制度がある国ですか?', criteria: ['免税制度は無い', '免税制度がある'] },
  { id: -26, question_text: '娯楽用ドローンの飛行が法律で規制されている国ですか?', criteria: ['ドローン飛行の規制は無いか緩い', 'ドローン飛行が法律で規制されている'] },
  { id: -27, question_text: '標高2,500m以上の高地を国内に含む国ですか?', criteria: ['高地(2500m以上)は含まれない', '高地(2500m以上)を含む'] },
  { id: -28, question_text: 'チップを渡す習慣が一般的な国ですか?', criteria: ['チップの習慣は無い', 'チップを渡す習慣が一般的'] }
];

export type JevKeywordClassification =
  | { kind: 'katakana_country'; countryName: string; labels: JevLabel[] }
  | { kind: 'freeform'; labels: JevLabel[] };

/**
 * keywordを見て、Jev評価に使うラベル集合を選ぶ。カタカナの国名1語なら
 * 国名専用のCOUNTRY_LEVEL_JEV_LABELSに差し替え、それ以外(通常の質問文・
 * 回答文、または国名一覧に無いカタカナ語)はdefaultLabelsをそのまま通す。
 */
export function selectJevLabelsForKeyword(keyword: string, defaultLabels: JevLabel[]): JevKeywordClassification {
  const countryName = matchKatakanaCountryName(keyword);
  if (countryName) {
    return { kind: 'katakana_country', countryName, labels: COUNTRY_LEVEL_JEV_LABELS };
  }
  return { kind: 'freeform', labels: defaultLabels };
}

// ここから先は、jev_country_keyword_labels/jev_country_keyword_evaluations
// (マイグレーション0145、jev_labels/jev_evaluationsとは別テーブル)を
// 使ってJev評価を行うエンドポイントを実装する際に使う想定のヘルパー。
// index.tsの既存の/jev-scoreハンドラがjev_labelsの行をJevLabel[]に
// 組み立てている処理(SELECT id, question_text, options_json FROM
// jev_labels → parseLabelCriteriaでcriteriaを取り出す)と全く同じ形を
// jev_country_keyword_labels向けに切り出したもの。

export type JevCountryKeywordLabelRow = { id: number; question_text: string; options_json: string | null };

export type ParseCountryKeywordLabelRowsResult =
  | { ok: true; labels: JevLabel[] }
  | { ok: false; invalidLabelId: number };

/**
 * jev_country_keyword_labelsのSELECT結果をJevLabel[]へ変換する。
 * options_jsonがJev API向けのcriteria形式(2要素配列)でない行が
 * 1つでもあれば、その場で処理を止めてinvalidLabelIdを返す
 * (index.tsの/jev-scoreハンドラと同じく、不正なラベルを黙ってスキップ
 * せず呼び出し元に伝える)。
 */
export function parseCountryKeywordLabelRows(rows: JevCountryKeywordLabelRow[]): ParseCountryKeywordLabelRowsResult {
  const labels: JevLabel[] = [];
  for (const row of rows) {
    const criteria = parseLabelCriteria(row.options_json);
    if (!criteria) return { ok: false, invalidLabelId: row.id };
    labels.push({ id: row.id, question_text: row.question_text, criteria });
  }
  return { ok: true, labels };
}
