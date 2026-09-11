/**
 * kimi-code(/kimi-code)で生成されたコードがRubyかどうかを判定するヒューリスティック。
 * kimi-codeには言語選択UIが無く、生成されたコード文字列だけが手元にあるため、
 * 構文パターンの出現数で判定するしかない(構文解析ではなく正規表現ベースの
 * 簡易判定)。
 *
 * 故障シナリオ(必ず発生しうる誤判定):
 *   - 偽陰性: 極端に短いRubyコード(例: "puts 1"だけ)や、Rubyらしい構文を
 *     ほとんど使わないコードはRubyと判定されないことがある
 *   - 偽陽性: コメントや文字列リテラルの中に"def"や"end"を含むJS/TSコードを
 *     誤ってRubyと判定する可能性がゼロではない
 * 対処方針: 誤判定によるデータ破損(Ruby以外のコードをruby_wasm_snippetsへ
 * 保存してしまう)を避けるため、サーバー側(POST /api/ruby-wasm/snippets)で
 * このisRubyCode()の判定結果をそのまま信頼せず必ず再検証し、Rubyと判定
 * できなかった場合は保存を拒否して理由をレスポンスに含める(握りつぶさない)。
 */

type RubySignal = { pattern: RegExp; weight: number };

// Ruby特有の構文。出現すれば+weightする。1つの正規表現につき出現有無のみを見る
// (同じ行が何度あってもカウントは1回、大量の"puts"連呼だけで判定が偏らないようにする)。
const RUBY_SIGNALS: RubySignal[] = [
  { pattern: /^\s*end\s*$/m, weight: 2 }, // ブロック終端の"end"単独行
  { pattern: /\bdef\s+[a-zA-Z_][a-zA-Z0-9_?!]*/, weight: 2 }, // メソッド定義
  { pattern: /\bputs\b/, weight: 1 },
  { pattern: /\brequire(_relative)?\s+['"]/, weight: 1 },
  { pattern: /\bmodule\s+[A-Z]\w*/, weight: 1 },
  { pattern: /\bclass\s+[A-Z]\w*(\s*<\s*[A-Z]\w*)?\s*$/m, weight: 1 },
  { pattern: /#\{[^}]*\}/, weight: 2 }, // 文字列内挿(Rubyの#{...})
  { pattern: /\bdo\s*\|[^|]*\|/, weight: 2 }, // ブロック引数付きdo
  { pattern: /=begin\b/, weight: 2 }, // ブロックコメント開始
  { pattern: /\bnil\b/, weight: 1 },
  { pattern: /\bunless\b/, weight: 1 },
  { pattern: /\belsif\b/, weight: 2 }, // Rubyにしか無い綴り
  { pattern: /\battr_(accessor|reader|writer)\b/, weight: 2 },
  { pattern: /\.each\s+do\b/, weight: 1 },
];

// JS/TS特有の構文。出現すれば-weightする。
const NON_RUBY_SIGNALS: RubySignal[] = [
  { pattern: /\bfunction\s*[a-zA-Z_]*\s*\(/, weight: 2 },
  { pattern: /\b(const|let)\s+[a-zA-Z_$][\w$]*\s*=/, weight: 1 },
  { pattern: /\bimport\s+.+\s+from\s+['"]/, weight: 2 },
  { pattern: /\bexport\s+(default\s+)?(function|class|const)\b/, weight: 2 },
  { pattern: /^\s*\/\//m, weight: 1 }, // JSスタイルの行コメント
  { pattern: /=>\s*\{/, weight: 1 }, // アロー関数
];

function countMatchingSignals(code: string, signals: RubySignal[]): number {
  return signals.reduce((score, signal) => (signal.pattern.test(code) ? score + signal.weight : score), 0);
}

/**
 * コード文字列がRubyらしいかどうかを判定する。しきい値は「Ruby特有の
 * シグナルがJS/TS特有のシグナルより明確に優勢(差が2以上)」とし、
 * 1つのシグナルだけで誤判定しないようにしている。
 */
export function looksLikeRubyCode(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const rubyScore = countMatchingSignals(trimmed, RUBY_SIGNALS);
  const nonRubyScore = countMatchingSignals(trimmed, NON_RUBY_SIGNALS);
  return rubyScore >= 2 && rubyScore - nonRubyScore >= 2;
}
