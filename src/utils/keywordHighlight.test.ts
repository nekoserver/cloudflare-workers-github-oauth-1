// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getKeywordHighlightScript } from './keywordHighlight';

// 対象: AIチャットの「詳細プレビュー」モーダルと「画像添付会話のプレビュー」
// モーダルの両方が使う、キーワードハイライトのクライアント側JS
// (applyKeywordHighlight/clearKeywordHighlights)を共通化した本体。
// 元は src/views/aichat.ts に直書きされていたコードをそのまま移植したもので、
// 移植によって挙動が変わっていないことを保証する。
//
// 故障シナリオ:
//   (1) 移植時のtemplate literalエスケープの取り扱いが変わり、正規表現が
//       壊れる、またはスクリプト自体が構文エラーになる(CLAUDE.mdルール29)
//   (2) 複数キーワード(配列)を渡した際にOR結合されない
//   (3) clearKeywordHighlightsで<mark>を元のテキストに戻せず、
//       ハイライトのON/OFF切り替えができなくなる

describe('getKeywordHighlightScript', () => {
  it('スクリプトに構文エラーが無い', () => {
    const script = getKeywordHighlightScript();
    expect(() => new Function(script)).not.toThrow();
  });

  it('applyKeywordHighlight/clearKeywordHighlights関数を含む', () => {
    const script = getKeywordHighlightScript();
    expect(script).toContain('function applyKeywordHighlight(el, keyword)');
    expect(script).toContain('function clearKeywordHighlights(container)');
  });

  function evalScript() {
    const script = getKeywordHighlightScript();
    // eslint-disable-next-line no-new-func
    const fn = new Function(script + '; return { applyKeywordHighlight: applyKeywordHighlight, clearKeywordHighlights: clearKeywordHighlights };');
    return fn() as {
      applyKeywordHighlight: (el: HTMLElement, keyword: string | string[]) => void;
      clearKeywordHighlights: (container: HTMLElement) => void;
    };
  }

  it('(DOM実動作) 単一キーワードを<mark class="kw-highlight">で囲む', () => {
    const { applyKeywordHighlight } = evalScript();
    const div = document.createElement('div');
    div.textContent = 'ねこはかわいい';
    applyKeywordHighlight(div, 'ねこ');
    const marks = div.querySelectorAll('.kw-highlight');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('ねこ');
  });

  it('(DOM実動作) 複数キーワード(配列)をOR結合でハイライトする', () => {
    const { applyKeywordHighlight } = evalScript();
    const div = document.createElement('div');
    div.textContent = 'ねことねずみと鳥';
    applyKeywordHighlight(div, ['ねこ', '鳥']);
    const marks = Array.from(div.querySelectorAll('.kw-highlight')).map((m) => m.textContent);
    expect(marks).toEqual(['ねこ', '鳥']);
  });

  it.each(['&', '&&', 'a&b', '&や|', 'a&b|c', '|', 'a|', '.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '[', ']', String.fromCharCode(92), '(a+)+$'])('正規表現の記号 %s を文字としてハイライトする', (keyword) => {
    const { applyKeywordHighlight, clearKeywordHighlights } = evalScript();
    const div = document.createElement('div');
    const text = '前 ' + keyword + ' 後';
    div.textContent = text;
    applyKeywordHighlight(div, keyword);
    expect(Array.from(div.querySelectorAll('.kw-highlight'), (mark) => mark.textContent)).toEqual([keyword]);
    expect(div.textContent).toBe(text);
    clearKeywordHighlights(div);
    expect(div.textContent).toBe(text);
  });

  it('記号を含む複数キーワードでも空文字や別の文字に一致しない', () => {
    const { applyKeywordHighlight } = evalScript();
    const div = document.createElement('div');
    div.textContent = 'a|b [ねこ] cXd c.d';
    applyKeywordHighlight(div, ['a|b', '[ねこ]', 'c.d', '']);
    expect(Array.from(div.querySelectorAll('.kw-highlight'), (mark) => mark.textContent)).toEqual(['a|b', '[ねこ]', 'c.d']);
  });

  it('(DOM実動作) clearKeywordHighlightsで<mark>を元のテキストに戻す', () => {
    const { applyKeywordHighlight, clearKeywordHighlights } = evalScript();
    const div = document.createElement('div');
    div.textContent = 'ねこはかわいい';
    applyKeywordHighlight(div, 'ねこ');
    expect(div.querySelectorAll('.kw-highlight').length).toBe(1);
    clearKeywordHighlights(div);
    expect(div.querySelectorAll('.kw-highlight').length).toBe(0);
    expect(div.textContent).toBe('ねこはかわいい');
  });

  it('keywordが空文字・空配列の場合は何もしない', () => {
    const { applyKeywordHighlight } = evalScript();
    const div = document.createElement('div');
    div.textContent = 'ねこはかわいい';
    applyKeywordHighlight(div, '');
    applyKeywordHighlight(div, []);
    expect(div.querySelectorAll('.kw-highlight').length).toBe(0);
    expect(div.textContent).toBe('ねこはかわいい');
  });
});
