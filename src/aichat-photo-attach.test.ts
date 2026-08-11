// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: AIチャットページ(/aichat)の投稿フォーム左側に設置した「＋」ボタンによる
// 写真添付機能(src/views/aichat.ts)。ボタン押下でファイル選択が開き、選択した画像を
// プレビュー表示した上で、送信時にAPIへ画像(data URL)を渡す一連のUI挙動を検証する。
//
// 故障シナリオ:
//   (1) 「＋」ボタンが投稿フォームの右側や外側に配置され、要件(左側配置)を満たさない
//   (2) 対応していない画像形式・巨大すぎるファイルをそのまま送信してしまう
//   (3) 画像を選択してもプレビューが表示されない/取り消しボタンが効かない
//   (4) テキストが空でも画像だけなら送信できるべきなのに、テキスト必須のガードで弾かれる
//   (5) 送信後も添付画像の状態(pendingImageDataUrl)が残り、次の送信に誤って混入する
//   (6) ユーザーの発言バブルに添付画像が表示されない

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('/aichat ページ: 投稿フォームの「＋」写真添付ボタン(HTML構造)', () => {
  const html = buildPage();

  it('chatForm 内に chatAttachBtn が存在し、chatInput より前(左側)に配置されている', () => {
    const formIdx = html.indexOf('id="chatForm"');
    const attachIdx = html.indexOf('id="chatAttachBtn"');
    const inputIdx = html.indexOf('id="chatInput"');
    expect(formIdx).toBeGreaterThan(-1);
    expect(attachIdx).toBeGreaterThan(-1);
    expect(inputIdx).toBeGreaterThan(-1);
    expect(formIdx).toBeLessThan(attachIdx);
    expect(attachIdx).toBeLessThan(inputIdx);
  });

  it('chatAttachBtn は type="button"(送信ボタンとして誤動作しない)', () => {
    const idx = html.indexOf('id="chatAttachBtn"');
    const tagStart = html.lastIndexOf('<button', idx);
    const tag = html.slice(tagStart, idx + 30);
    expect(tag).toContain('type="button"');
  });

  it('隠しファイル入力(chatImageInput)が image/* のみ受け付ける', () => {
    expect(html).toContain('id="chatImageInput"');
    const idx = html.indexOf('id="chatImageInput"');
    const tagStart = html.lastIndexOf('<input', idx);
    const tag = html.slice(tagStart, idx + 80);
    expect(tag).toContain('type="file"');
    expect(tag).toContain('accept="image/*"');
  });

  it('画像プレビュー行(chatImagePreviewRow)は既定で非表示', () => {
    const idx = html.indexOf('id="chatImagePreviewRow"');
    expect(idx).toBeGreaterThan(-1);
    const tagStart = html.lastIndexOf('<div', idx);
    const tag = html.slice(tagStart, idx + 60);
    expect(tag).toContain('display:none');
  });

  it('プレビュー取り消しボタン(chatImagePreviewRemove)が存在する', () => {
    expect(html).toContain('id="chatImagePreviewRemove"');
  });
});

describe('validateAttachedImageFile: クライアント側の画像バリデーション', () => {
  function loadValidator(html: string) {
    const src = extractFunctionSource(html, 'validateAttachedImageFile');
    expect(src, 'validateAttachedImageFile が生成HTMLから見つからない').toBeTruthy();
    const fn = new Function(
      'ALLOWED_IMAGE_TYPES', 'MAX_IMAGE_FILE_BYTES',
      `${src}\nreturn validateAttachedImageFile;`
    );
    return fn(['image/png', 'image/jpeg', 'image/webp', 'image/gif'], 6 * 1024 * 1024);
  }

  it('png/jpeg/webp/gifかつ6MB以内であればエラーなし(null)', () => {
    const validate = loadValidator(buildPage());
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(validate({ type, size: 1024 })).toBeNull();
    }
  });

  it('対応していない形式(svg等)はエラーメッセージを返す', () => {
    const validate = loadValidator(buildPage());
    const err = validate({ type: 'image/svg+xml', size: 100 });
    expect(err).toBeTruthy();
    expect(err).toContain('対応していない画像形式');
  });

  it('6MBを超えるファイルはサイズ超過のエラーメッセージを返す', () => {
    const validate = loadValidator(buildPage());
    const err = validate({ type: 'image/png', size: 6 * 1024 * 1024 + 1 });
    expect(err).toContain('サイズが大きすぎます');
  });

  it('ファイルが未選択(null/undefined)の場合もエラーを返す(例外にしない)', () => {
    const validate = loadValidator(buildPage());
    expect(validate(null)).toBeTruthy();
  });
});

describe('appendBubble: ユーザーバブルへの添付画像表示', () => {
  function loadAppendBubble(html: string) {
    const src = extractFunctionSource(html, 'appendBubble');
    expect(src, 'appendBubble が生成HTMLから見つからない').toBeTruthy();
    document.body.innerHTML = '<div id="chatLog"></div>';
    const fn = new Function(
      'chatLog', 'buildAssistantBubble',
      `${src}\nreturn appendBubble;`
    );
    const chatLog = document.getElementById('chatLog')!;
    const buildAssistantBubble = () => document.createElement('div');
    const appendBubble = fn(chatLog, buildAssistantBubble);
    return { appendBubble, chatLog };
  }

  it('imageDataUrlを渡すとchat-bubble-image画像がテキストより前に挿入される', () => {
    const { appendBubble } = loadAppendBubble(buildPage());
    const el = appendBubble('この画像は何?', 'user', null, null, null, 'data:image/png;base64,AAAA');
    const img = el.querySelector('img.chat-bubble-image');
    expect(img).not.toBeNull();
    expect((img as HTMLImageElement).src).toContain('data:image/png;base64,AAAA');
    expect(el.textContent).toContain('この画像は何?');
  });

  it('imageDataUrlを渡さない場合は画像要素を作らない(既存挙動を壊さない)', () => {
    const { appendBubble } = loadAppendBubble(buildPage());
    const el = appendBubble('こんにちは', 'user');
    expect(el.querySelector('img.chat-bubble-image')).toBeNull();
    expect(el.textContent).toContain('こんにちは');
  });

  it('テキストが空で画像のみの場合、テキスト用の子要素を作らない', () => {
    const { appendBubble } = loadAppendBubble(buildPage());
    const el = appendBubble('', 'user', null, null, null, 'data:image/png;base64,AAAA');
    expect(el.querySelector('img.chat-bubble-image')).not.toBeNull();
    expect(el.textContent).toBe('');
  });
});

describe('/aichat ページ: 送信処理(chatForm submit)の写真添付対応', () => {
  const html = buildPage();
  const submitIdx = html.indexOf("chatForm.addEventListener('submit'");

  it('submitハンドラが存在する', () => {
    expect(submitIdx).toBeGreaterThan(-1);
  });

  it('テキストが空でも添付画像があれば送信をスキップしない(早期returnの条件にattachedImageが含まれる)', () => {
    const block = html.slice(submitIdx, submitIdx + 600);
    expect(block).toMatch(/if \(!msg && !attachedImage\) return;/);
  });

  it('送信時にpendingImageDataUrlをpayload.imageとして含める', () => {
    const block = html.slice(submitIdx, submitIdx + 900);
    expect(block).toContain('var attachedImage = pendingImageDataUrl;');
    expect(block).toContain('payload.image = attachedImage;');
  });

  it('送信直後にclearAttachedImage()で添付状態をリセットする(次の送信に混入しない)', () => {
    const block = html.slice(submitIdx, submitIdx + 900);
    expect(block).toContain('clearAttachedImage();');
  });

  it('ユーザーの発言バブルにappendBubbleでattachedImageを渡している', () => {
    const block = html.slice(submitIdx, submitIdx + 600);
    expect(block).toContain("appendBubble(msg, 'user', null, null, null, attachedImage);");
  });

  it('画像添付時のみpayload.preferMoondreamにaichatPreferMoondream設定値を含める(画像なしでは含めない)', () => {
    const block = html.slice(submitIdx, submitIdx + 900);
    const ifBlockMatch = block.match(/if \(attachedImage\) \{[\s\S]*?\n\s*\}/);
    expect(ifBlockMatch, 'if (attachedImage) { ... } ブロックが見つからない').not.toBeNull();
    expect(ifBlockMatch![0]).toContain('payload.image = attachedImage;');
    expect(ifBlockMatch![0]).toContain('payload.preferMoondream = aichatPreferMoondream;');
  });
});

describe('/aichat ページ: script タグに構文エラーがない(写真添付機能追加後)', () => {
  it('全<script>ブロックがnew Functionでパース可能', () => {
    const html = buildPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
