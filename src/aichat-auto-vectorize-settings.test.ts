import { describe, it, expect } from 'vitest';
import { resolveAutoVectorizeSettings, BGE_M3_MODEL, PLAMO_EMBEDDING_MODEL, GEMMA_EMBEDDING_MODEL } from './index';

// 対象: answer-graphの色分け・キーワード分類提案などが自動で行う
// キーワードのベクタ化(自動ベクタ化)で使う設定の解決ロジック。
//
// 故障シナリオ:
//   (1) Cookie未設定時にデフォルトが意図と異なる(自動ベクタ化OFF、
//       またはモデルがbge-m3のままになってしまう)
//   (2) 不正なモデル名がCookieに入っていた場合にそのまま使ってしまい、
//       AI呼び出しがエラーになる
//   (3) enabled=offの判定が緩く、'off'以外の値(例: 空文字や誤字)でも
//       OFF扱いにしてしまい、意図せず自動ベクタ化が止まる

describe('resolveAutoVectorizeSettings: 自動ベクタ化設定のCookie解決', () => {
  it('Cookie未設定時はenabled=true, model=plamo-embedding-1b(デフォルト)', () => {
    const settings = resolveAutoVectorizeSettings(undefined);
    expect(settings.enabled).toBe(true);
    expect(settings.model).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('aichat_auto_vectorize_enabled=off の場合はenabled=false', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_enabled=off');
    expect(settings.enabled).toBe(false);
  });

  it('aichat_auto_vectorize_enabled=on の場合はenabled=true', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_enabled=on');
    expect(settings.enabled).toBe(true);
  });

  it('aichat_auto_vectorize_model にbge-m3が入っていればそれを使う', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_model=' + BGE_M3_MODEL);
    expect(settings.model).toBe(BGE_M3_MODEL);
  });

  it('aichat_auto_vectorize_model にembeddinggemma-300mが入っていればそれを使う', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_model=' + GEMMA_EMBEDDING_MODEL);
    expect(settings.model).toBe(GEMMA_EMBEDDING_MODEL);
  });

  it('aichat_auto_vectorize_model に未対応のモデル名が入っていてもplamo-embedding-1bにフォールバックする', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_model=@cf/unknown/model');
    expect(settings.model).toBe(PLAMO_EMBEDDING_MODEL);
  });

  it('両方のCookieが同時に設定されている場合、両方とも正しく反映される', () => {
    const settings = resolveAutoVectorizeSettings('aichat_auto_vectorize_enabled=off; aichat_auto_vectorize_model=' + BGE_M3_MODEL);
    expect(settings.enabled).toBe(false);
    expect(settings.model).toBe(BGE_M3_MODEL);
  });
});
