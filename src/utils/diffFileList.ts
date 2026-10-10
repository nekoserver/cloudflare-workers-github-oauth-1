// 統一diff形式のテキスト(fetchPrDiffが取得するPR/push/commitの.diff)から、
// 「変更されたファイルパス一覧」とその拡張子を抜き出すための純粋関数。
// ai_summary_files(処理済みファイル数・ファイルタイプ別のキーワード分布)の
// 保存元データを作るために使う。
//
// 故障シナリオ:
//   (1) diffが8000文字でtrimmedDiffに切られた後だと、末尾のファイルの
//       diff --git行が失われる → 切る前のフルテキストから抽出する
//       (呼び出し元のfetchPrDiffでスライス前のdiffに対して呼ぶこと)
//   (2) 拡張子がないファイル(Dockerfile・Makefile)やdotfile(.gitignore)は
//       拡張子として誤認識せず「(拡張子なし)」にまとめる
//   (3) 同じファイルが複数回diff --git行に出ることはない前提だが、
//       念のため重複は除く

const DIFF_GIT_LINE = /^diff --git a\/(.+) b\/(.+)$/;

/** diffテキストから変更されたファイルパス(b側)の一覧を、出現順・重複なしで返す。 */
export function parseChangedFilePaths(diffText: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const line of diffText.split('\n')) {
    const m = line.match(DIFF_GIT_LINE);
    if (!m) continue;
    const path = m[2];
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }
  return paths;
}

const NO_EXTENSION_LABEL = '(拡張子なし)';

/** ファイルパスから拡張子(小文字)を返す。拡張子がない・dotfileの場合は「(拡張子なし)」。 */
export function fileExtension(filePath: string): string {
  const fileName = filePath.split('/').pop() ?? filePath;
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx <= 0) return NO_EXTENSION_LABEL;
  return fileName.slice(dotIdx + 1).toLowerCase();
}
