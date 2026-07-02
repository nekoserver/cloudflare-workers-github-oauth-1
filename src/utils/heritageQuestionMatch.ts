/**
 * AIチャットの質問文が「世界遺産名」で始まるかどうかを判定する。
 *
 * 単純に最初の「〜」の区間を抽出する方式（indexOf('「') から次の '」' まで）だと、
 * 「神宿る島」宗像・沖ノ島と関連遺産群 のように世界遺産名自体に「」が
 * 入れ子で含まれるケースで、内側の閉じ括弧を誤って終端と判定してしまい
 * 名前が途中で切れて一致判定に失敗する。
 * 既知の世界遺産名候補と直接前方一致で比較することでこれを回避する。
 */
export function questionStartsWithHeritageBracket(question: string, heritageName: string): boolean {
  if (!question || !heritageName) return false;
  return question.startsWith('「' + heritageName + '」');
}

/**
 * 1件の質問文に対して、候補となる世界遺産名のうち実際に前方一致するものを全て返す。
 */
export function findMatchingHeritageNames(question: string, heritageNames: string[]): string[] {
  return heritageNames.filter((name) => questionStartsWithHeritageBracket(question, name));
}
