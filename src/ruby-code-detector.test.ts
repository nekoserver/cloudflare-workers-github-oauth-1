import { describe, it, expect } from 'vitest';
import { looksLikeRubyCode } from './utils/rubyCodeDetector';

// 対象: src/utils/rubyCodeDetector.ts の looksLikeRubyCode()。kimi-codeが
// 生成したコード(言語選択UIが無く、言語情報を持たない文字列)がRubyかどうか
// を判定するヒューリスティック。POST /api/ruby-wasm/snippets の保存可否判定
// に使われる。
//
// 故障シナリオ:
//   (1) 典型的なRubyコードを誤ってRubyでないと判定する(偽陰性)
//   (2) 典型的なJS/TSコードを誤ってRubyと判定する(偽陽性)
//   (3) 空文字列・空白のみの入力でクラッシュする
//   (4) 短すぎる/シグナルの少ないコードで偶然1つのRubyっぽい単語だけ
//       (例: 文字列中の"end")含む場合に誤判定しない

describe('looksLikeRubyCode', () => {
  it('典型的なRubyのメソッド定義をRubyと判定する', () => {
    const code = [
      'def greet(name)',
      '  puts "Hello, #{name}!"',
      'end',
      '',
      'greet("world")',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(true);
  });

  it('classとattr_accessorを含むRubyコードをRubyと判定する', () => {
    const code = [
      'class Person',
      '  attr_accessor :name, :age',
      '',
      '  def initialize(name, age)',
      '    @name = name',
      '    @age = age',
      '  end',
      'end',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(true);
  });

  it('do...endブロックとeachを含むRubyコードをRubyと判定する', () => {
    const code = [
      '[1, 2, 3].each do |n|',
      '  puts n unless n.nil?',
      'end',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(true);
  });

  it('典型的なTypeScriptの関数定義をRubyでないと判定する', () => {
    const code = [
      'function greet(name: string): void {',
      '  console.log(`Hello, ${name}!`);',
      '}',
      '',
      'greet("world");',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(false);
  });

  it('アロー関数・const・importを含むJS/TSコードをRubyでないと判定する', () => {
    const code = [
      "import { readFile } from 'fs';",
      '',
      'const load = (path: string) => {',
      '  return readFile(path);',
      '};',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(false);
  });

  it('exportを含むTypeScriptのWorkerコードをRubyでないと判定する', () => {
    const code = [
      'export default {',
      '  fetch(request: Request): Response {',
      '    return new Response("Hello from a Worker!");',
      '  },',
      '};',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(false);
  });

  it('空文字列・空白のみの入力はfalseを返す(クラッシュしない)', () => {
    expect(looksLikeRubyCode('')).toBe(false);
    expect(looksLikeRubyCode('   \n  \t')).toBe(false);
  });

  it('"end"という単語を1つ含むだけのJSコードは誤判定しない', () => {
    const code = [
      "const message = 'this is the end of the function';",
      'function run() {',
      '  console.log(message);',
      '}',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(false);
  });

  it('Rubyのモジュール定義とrequireを含むコードをRubyと判定する', () => {
    const code = [
      "require 'json'",
      '',
      'module Greeter',
      '  def self.hello',
      "    puts 'hello'",
      '  end',
      'end',
    ].join('\n');
    expect(looksLikeRubyCode(code)).toBe(true);
  });
});
