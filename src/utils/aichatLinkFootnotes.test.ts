import { describe, expect, it } from 'vitest';
import { convertAnswerLinksToFootnotes } from './aichatLinkFootnotes';

describe('convertAnswerLinksToFootnotes', () => {
  it('リンクが1つもない場合は入力をそのまま返す(末尾に区切り線等を追加しない)', () => {
    const md = '普通の回答文です。リンクはありません。';
    expect(convertAnswerLinksToFootnotes(md)).toBe(md);
  });

  it('単一のリンクを通し番号に置き換え、末尾に一覧を追記する', () => {
    const md = '詳細は[公式ドキュメント](https://example.com/docs)を参照してください。';
    const result = convertAnswerLinksToFootnotes(md);
    expect(result).toContain('詳細は[1](https://example.com/docs)を参照してください。');
    expect(result).not.toContain('公式ドキュメント');
    expect(result).toContain('1. [https://example.com/docs](https://example.com/docs)');
  });

  it('同一URLが複数回出現する場合は重複させず同じ番号を使う', () => {
    const md = '[こちら](https://example.com/a)を見てください。もう一度[ここ](https://example.com/a)も見てください。';
    const result = convertAnswerLinksToFootnotes(md);
    expect(result).toContain('[1](https://example.com/a)を見てください。もう一度[1](https://example.com/a)も見てください。');
    // 一覧には1件だけ(重複なし)。一覧の1行は[url](url)の形でURLを2回含むため、
    // 出現回数は本文2箇所(各1回)+一覧1行(2回)=4回になる。
    const footerMatches = result.match(/https:\/\/example\.com\/a/g) || [];
    expect(footerMatches.length).toBe(4);
    expect(result).toContain('1. [https://example.com/a](https://example.com/a)');
    expect(result).not.toContain('2. [https://example.com/a]');
  });

  it('複数の異なるURLは出現順に通し番号を振る', () => {
    const md = '[B](https://b.example.com)の次に[A](https://a.example.com)、再び[B](https://b.example.com)。';
    const result = convertAnswerLinksToFootnotes(md);
    expect(result).toContain('[1](https://b.example.com)の次に[2](https://a.example.com)、再び[1](https://b.example.com)。');
    const footerStart = result.indexOf('---');
    const footer = result.slice(footerStart);
    expect(footer.indexOf('1. [https://b.example.com]')).toBeLessThan(footer.indexOf('2. [https://a.example.com]'));
  });

  it('画像記法(![alt](url))は変換せず、番号付けの対象にも含めない', () => {
    const md = '![サンプル画像](https://example.com/img.png)\n\n[リンク](https://example.com/page)';
    const result = convertAnswerLinksToFootnotes(md);
    expect(result).toContain('![サンプル画像](https://example.com/img.png)');
    expect(result).toContain('[1](https://example.com/page)');
    // 画像のURLが一覧に紛れ込んでいない
    expect(result).not.toContain('https://example.com/img.png)\n\n1.');
    const footerStart = result.indexOf('---');
    expect(result.slice(footerStart)).not.toContain('img.png');
  });

  it('一覧はMarkdownの番号付きリストとして改行区切りで並ぶ(縦並び)', () => {
    const md = '[one](https://1.example.com) [two](https://2.example.com) [three](https://3.example.com)';
    const result = convertAnswerLinksToFootnotes(md);
    const footer = result.slice(result.indexOf('---'));
    const lines = footer.split('\n').filter((l) => l.trim() !== '' && l.trim() !== '---');
    expect(lines).toEqual([
      '1. [https://1.example.com](https://1.example.com)',
      '2. [https://2.example.com](https://2.example.com)',
      '3. [https://3.example.com](https://3.example.com)',
    ]);
  });
});
