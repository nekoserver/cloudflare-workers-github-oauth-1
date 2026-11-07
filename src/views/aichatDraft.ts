/**
 * AIチャットの入力の下書き(ページのscriptへ埋め込む)。ユーザー指定(2026-11-07)。
 *
 * 入力中の文字を、タブの切り替え(ブラウザがタブを破棄して読み込み直す場合を含む)やページの再読み込みで消さない。
 * このブラウザのlocalStorageに1件だけ保存し、送信したら消す。同じブラウザの別のタブとは同じ下書きを共有する。
 * template literalに埋め込むため、バックスラッシュのエスケープと正規表現リテラルを使わない(CLAUDE.md ルール29)。
 */
export const AICHAT_DRAFT_SCRIPT = `
    var AICHAT_DRAFT_KEY = 'aichat.draft';
    // localStorageの容量(多くのブラウザで約5MB)を下書きだけで使い切らないための上限。
    var AICHAT_DRAFT_MAX_CHARS = 100000;
    function saveAichatDraft(storage, text) {
      if (!storage) return;
      try {
        if (text) storage.setItem(AICHAT_DRAFT_KEY, String(text).slice(0, AICHAT_DRAFT_MAX_CHARS));
        else storage.removeItem(AICHAT_DRAFT_KEY);
      } catch (e) { /* 保存できない環境(プライベートモード・容量超過)では、下書きを残さないだけ */ }
    }
    function loadAichatDraft(storage) {
      if (!storage) return '';
      try { return storage.getItem(AICHAT_DRAFT_KEY) || ''; } catch (e) { return ''; }
    }
`;
