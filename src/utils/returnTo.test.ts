import { describe, it, expect } from 'vitest';
import { validateReturnTo } from './returnTo';

describe('validateReturnTo - オープンリダイレクト防止', () => {

  // =====================================================
  // 許可されるケース
  // =====================================================

  it('/repositories は許可される', () => {
    expect(validateReturnTo('/repositories')).toBe('/repositories');
  });

  it('/repositories?modal=create は許可される', () => {
    expect(validateReturnTo('/repositories?modal=create')).toBe('/repositories?modal=create');
  });

  it('/welcome は許可される', () => {
    expect(validateReturnTo('/welcome')).toBe('/welcome');
  });

  it('/settings は許可される', () => {
    expect(validateReturnTo('/settings')).toBe('/settings');
  });

  // =====================================================
  // 拒否されるケース: 攻撃パターン
  // =====================================================

  it('絶対 URL は拒否される（オープンリダイレクト）', () => {
    expect(validateReturnTo('https://evil.com')).toBeNull();
  });

  it('protocol-relative URL は拒否される', () => {
    expect(validateReturnTo('//evil.com')).toBeNull();
  });

  it('パストラバーサルは拒否される', () => {
    expect(validateReturnTo('/repositories/../admin')).toBeNull();
  });

  it('許可リスト外のパスは拒否される', () => {
    expect(validateReturnTo('/admin')).toBeNull();
  });

  it('空文字は null を返す', () => {
    expect(validateReturnTo('')).toBeNull();
  });

  it('undefined は null を返す', () => {
    expect(validateReturnTo(undefined)).toBeNull();
  });

  it('null は null を返す', () => {
    expect(validateReturnTo(null)).toBeNull();
  });

  it('javascript: スキームは拒否される', () => {
    expect(validateReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('data: スキームは拒否される', () => {
    expect(validateReturnTo('data:text/html,<script>alert(1)</script>')).toBeNull();
  });
});
