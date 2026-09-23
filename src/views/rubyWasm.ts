import { escapeHtml } from '../utils/html';
import { getRubyWasmLoaderScript, rubyWasmBinaryCacheName } from '../utils/rubyWasmLoader';
import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

// 公式ビルド済みWASMパッケージ(CRuby WASI版)を使う。C言語のコード生成を
// 含むCRubyはこの環境ではwasm32-unknown-unknownへ自前ビルドできない
// (NOTICE.cloudflare-workers-github-oauth-1.rust-WASM.md 3節と同じ制約)。
// バイナリ本体(ruby+stdlib.wasm、4.0は非圧縮約32MB)はリポジトリに含めず、公式npm
// パッケージ(@ruby/4.0-wasm-wasi)をjsDelivr CDN経由でブラウザから直接
// 読み込む。他のwasm/*-wasmクレートのように自前Rust実装+public/wasm配下の
// 静的配信ではない、この機能固有の構成であることに注意。
// dist/esm/browser.js は"@bjorn3/browser_wasi_shim"のようなbare specifier
// (パッケージ名のみのimport)を含んでおり、import mapを使わないブラウザの
// 素のESM importでは "does not resolve to a valid URL" エラーになる。
// jsDelivrの"+esm"サフィックスはパッケージ直下(例: pkg@version+esm)では
// 依存解決済みバンドルを返すが、dist/esm/browser.jsのような任意の
// サブパスに付けても効かず生ファイルがそのまま返ってくることを実機で確認した
// (2026-08-31、修正後も同じエラーが再現)。そのためesm.sh
// (bare specifierを解決済みURLへ自動的に書き換えてくれるCDN)に切り替える。
// export: /kimi-code/markdown/:id(src/views/kimiCodeMarkdown.ts)でもRuby/WASMを
// 実行するため、同じCDN URL(バージョン固定)をここから再利用しバージョンの
// 食い違いを防ぐ。
export const RUBY_WASM_JS_URL = 'https://esm.sh/@ruby/wasm-wasi@2.10.1/dist/esm/browser.js';
export const RUBY_WASM_BINARY_URL = 'https://cdn.jsdelivr.net/npm/@ruby/4.0-wasm-wasi@2.10.1/dist/ruby+stdlib.wasm';

export type RubyWasmVersionInfo = {
  /** @ruby/{X.Y}-wasm-wasi のビルドライン(パッケージのメジャー.マイナー)。
   *  実際のCRubyパッチバージョン(例: 4.0.0)はwasmバイナリ内部にしか無く、
   *  Worker側からは(ブラウザでWASMを実行しない限り)取得できないため、
   *  ここではパッケージ名に埋め込まれたビルドラインのみを返す。 */
  rubyBuildLine: string;
  /** @ruby/wasm-wasi (jsグルーコード)およびruby+stdlib.wasmパッケージのバージョン。 */
  wasmWasiPackageVersion: string;
};

/**
 * `@ruby/{X.Y}-wasm-wasi@{version}/dist/ruby+stdlib.wasm` 形式のURLから
 * ビルドライン・パッケージバージョンを取り出す純粋関数。
 * `/neko rubyver` スラッシュコマンドが表示する内容の元データになる。
 */
export function parseRubyWasmVersionInfo(binaryUrl: string): RubyWasmVersionInfo | null {
  const match = binaryUrl.match(/@ruby\/(\d+(?:\.\d+)*)-wasm-wasi@([^/]+)\//);
  if (!match) return null;
  return { rubyBuildLine: match[1], wasmWasiPackageVersion: match[2] };
}

/** このリポジトリの/ruby-wasmページが実際に読み込んでいるRuby/WASMのバージョン情報。 */
export function getRubyWasmVersionInfo(): RubyWasmVersionInfo {
  const info = parseRubyWasmVersionInfo(RUBY_WASM_BINARY_URL);
  if (!info) {
    throw new Error(`RUBY_WASM_BINARY_URLの形式が想定と異なります: ${RUBY_WASM_BINARY_URL}`);
  }
  return info;
}

type RubyReplSnippet = {
  title: string;
  description: string;
  category: string;
  code: string;
  badges?: readonly string[];
};

/**
 * Ruby/WASM だけで完結するサンプル集。ネットワーク、ファイル、時刻など実行環境に
 * 依存する例は避け、どのブラウザでも「Run」を押して同じ結果を確認できるようにする。
 */
export const RUBY_REPL_SNIPPETS: readonly RubyReplSnippet[] = [
  { title: 'Hello, Ruby!', description: '文字列展開と配列を使った最初のプログラム。', category: '基本', code: 'language = "Ruby"\nfeatures = ["simple", "expressive", "fun"]\nputs "Hello, #{language}!"\nputs features.join(" · ")' },
  { title: 'FizzBuzz', description: '条件分岐と範囲を一度に試します。', category: '基本', code: '(1..30).each do |n|\n  word = "Fizz" if (n % 3).zero?\n  word = "#{word}Buzz" if (n % 5).zero?\n  puts word || n\nend' },
  { title: '配列パイプライン', description: 'select・map・sumをつないで集計します。', category: 'Enumerable', code: 'numbers = (1..12).to_a\nevens = numbers.select(&:even?)\nsquares = evens.map { |n| n ** 2 }\nputs "even squares: #{squares.join(", ")}"\nputs "total: #{squares.sum}"' },
  { title: '単語の頻度', description: 'scan と tally で文章を数え上げます。', category: 'Enumerable', code: 'text = "Ruby makes programmers happy, and happy programmers make things."\ncounts = text.downcase.scan(/[a-z]+/).tally\ncounts.sort_by { |word, count| [-count, word] }.each do |word, count|\n  puts "#{word.ljust(12)} #{"█" * count} #{count}"\nend' },
  { title: '成績ランキング', description: 'Hashの配列を複数条件で並べ替えます。', category: 'Enumerable', code: 'scores = [\n  { name: "Mina", score: 92 },\n  { name: "Kai", score: 78 },\n  { name: "Aoi", score: 92 },\n  { name: "Ren", score: 85 }\n]\nscores.sort_by { |row| [-row[:score], row[:name]] }.each_with_index do |row, i|\n  puts "#{i + 1}. #{row[:name]} — #{row[:score]}"\nend' },
  { title: 'グループ集計', description: '商品データをカテゴリ別に集計します。', category: 'Enumerable', code: 'items = [\n  ["book", 1800], ["food", 650], ["book", 1200],\n  ["tool", 2400], ["food", 480]\n]\nitems.group_by(&:first).sort.each do |category, rows|\n  puts "#{category}: ¥#{rows.sum { |_, price| price }}"\nend' },
  { title: 'JSON 整形', description: '標準ライブラリでJSONを解析・整形します。', category: 'データ', code: 'require "json"\nraw = %q({"name":"Ruby/WASM","features":["portable","fast"],"ready":true})\ndata = JSON.parse(raw)\ndata["features"] << "interactive"\nputs JSON.pretty_generate(data)' },
  { title: 'CSV 集計', description: '文字列内のCSVを読み、合計を求めます。', category: 'データ', code: 'source = "item,price,qty\\nApple,120,3\\nTea,450,1\\nBread,280,2"\nheader, *lines = source.lines(chomp: true).map { |line| line.split(",") }\nrows = lines.map { |values| header.zip(values).to_h }\nrows.each { |row| puts "#{row["item"]}: #{row["price"].to_i * row["qty"].to_i}円" }\nputs "合計: #{rows.sum { |row| row["price"].to_i * row["qty"].to_i }}円"' },
  { title: '正規表現で抽出', description: 'ログ風テキストからステータスを集計します。', category: '文字列', code: 'log = <<~LOG\n  200 GET /\n  404 GET /missing\n  200 POST /items\n  500 GET /error\n  200 GET /about\nLOG\ncodes = log.scan(/^([0-9]{3})/).flatten.tally\ncodes.sort.each { |code, count| puts "HTTP #{code}: #{count}" }' },
  { title: '回文チェッカー', description: '日本語や記号を含む文字列を正規化して判定します。', category: '文字列', code: 'def palindrome?(text)\n  normalized = text.downcase.gsub(/[^a-z0-9]/, "")\n  normalized == normalized.reverse\nend\n["Never odd or even", "Ruby", "A man, a plan, a canal: Panama!"].each do |text|\n  puts "#{palindrome?(text) ? "✓" : "×"} #{text}"\nend' },
  { title: 'テンプレート変換', description: 'gsub のブロックでプレースホルダーを置換します。', category: '文字列', code: 'template = "Hello, {{name}}! Welcome to {{place}}."\nvalues = { "name" => "Rubyist", "place" => "WebAssembly" }\nresult = template.gsub(/{{(\\w+)}}/) { values.fetch($1, "?") }\nputs result' },
  { title: 'クラスとメソッド', description: '小さな値オブジェクトを定義します。', category: 'オブジェクト', code: 'class Temperature\n  attr_reader :celsius\n  def initialize(celsius) = @celsius = celsius\n  def fahrenheit = celsius * 9.0 / 5 + 32\n  def to_s = format("%.1f°C / %.1f°F", celsius, fahrenheit)\nend\n[-10, 0, 20, 36.5].each { |n| puts Temperature.new(n) }' },
  { title: 'Structで注文表', description: 'Data指向のオブジェクトと集計を試します。', category: 'オブジェクト', code: 'LineItem = Struct.new(:name, :price, :quantity) do\n  def subtotal = price * quantity\nend\ncart = [LineItem.new("Coffee", 480, 2), LineItem.new("Cake", 620, 1)]\ncart.each { |item| puts "#{item.name.ljust(8)} #{item.quantity} × ¥#{item.price} = ¥#{item.subtotal}" }\nputs "TOTAL: ¥#{cart.sum(&:subtotal)}"' },
  { title: '例外処理', description: '独自例外を定義して入力値を検証します。', category: 'オブジェクト', code: 'class InvalidAge < StandardError; end\ndef ticket_price(age)\n  raise InvalidAge, "age must be positive" if age.negative?\n  age < 12 ? 600 : (age >= 65 ? 800 : 1200)\nend\n[8, 25, 70, -1].each do |age|\n  begin\n    puts "age #{age}: #{ticket_price(age)}円"\n  rescue InvalidAge => e\n    puts "age #{age}: ERROR (#{e.message})"\n  end\nend' },
  { title: '素数ジェネレーター', description: 'Enumeratorと試し割りで素数を順に生成します。', category: 'アルゴリズム', code: 'prime_numbers = Enumerator.new do |yielder|\n  candidate = 2\n  loop do\n    limit = Math.sqrt(candidate).to_i\n    yielder << candidate if (2..limit).none? { |divisor| (candidate % divisor).zero? }\n    candidate += 1\n  end\nend\n\nprimes = prime_numbers.take(15)\nputs primes.join(", ")\nputs "sum = #{primes.sum}"' },
  { title: 'パスカルの三角形', description: 'each_consで次の行を組み立てます。', category: 'アルゴリズム', code: 'row = [1]\n8.times do\n  puts row.join(" ").center(30)\n  row = [1] + row.each_cons(2).map(&:sum) + [1]\nend' },
  { title: 'メモ化フィボナッチ', description: '再帰とHashのデフォルトブロックを組み合わせます。', category: 'アルゴリズム', code: 'fib = Hash.new { |memo, n| memo[n] = n < 2 ? n : memo[n - 1] + memo[n - 2] }\nputs (0..20).map { |n| fib[n] }.join(", ")\nputs "cached entries: #{fib.size}"' },
  { title: '簡易棒グラフ', description: '数値データをターミナル風に可視化します。', category: '遊ぶ', code: 'visitors = { Mon: 12, Tue: 19, Wed: 8, Thu: 24, Fri: 17 }\nscale = visitors.values.max\nvisitors.each do |day, value|\n  bar = "█" * (value * 20 / scale)\n  puts format("%-3s | %-20s %2d", day, bar, value)\nend' },
  { title: 'パターンマッチ', description: '配列とHashをcase/inで読みやすく分類します。', category: 'Ruby 4', badges: ['構文', '中級'], code: 'events = [\n  [:login, { user: "Mika" }],\n  [:purchase, { item: "Book", price: 2400 }],\n  [:logout, { user: "Mika" }]\n]\nevents.each do |event|\n  case event\n  in [:login, { user: }]\n    puts "welcome #{user}"\n  in [:purchase, { item:, price: (2000.. => price) }]\n    puts "premium: #{item} (#{price}円)"\n  in [type, payload]\n    puts "#{type}: #{payload}"\n  end\nend' },
  { title: 'Dataで座標計算', description: '不変なDataオブジェクトでベクトルを表現します。', category: 'Ruby 4', badges: ['Data', '中級'], code: 'Point = Data.define(:x, :y) do\n  def +(other) = Point.new(x + other.x, y + other.y)\n  def length = Math.hypot(x, y)\nend\na = Point.new(3, 4)\nb = Point.new(-1, 2)\nc = a + b\nputs "#{a.inspect} length=#{a.length}"\nputs "#{a.inspect} + #{b.inspect} = #{c.inspect}"' },
  { title: '番号付きブロック', description: 'itを使うRuby 3.4+の簡潔な単一ブロック引数です。', category: 'Ruby 4', badges: ['Ruby 3.4+', '初級'], code: 'prices = [120, 350, 80, 640]\ntaxed = prices.map { it * 1.1 }\nputs taxed.map { format("¥%.0f", it) }.join(", ")\nputs "total: ¥#{taxed.sum.round}"' },
  { title: '範囲のステップ', description: 'Range#stepで目盛りと数列を組み立てます。', category: '基本', badges: ['Range', '初級'], code: 'puts "countdown: #{10.step(0, -2).to_a.join(" ")}"\nputs "degrees: #{(-90..90).step(30).to_a.join(", ")}"\nletters = ("a".."z").step(5).to_a\nputs "letters: #{letters.join(" -> ")}"' },
  { title: 'each_sliceでページ分け', description: '一列のデータを指定件数ごとに分割します。', category: 'Enumerable', badges: ['Enumerable', '初級'], code: 'products = %w[apple banana cherry donut eclair fig grape]\nproducts.each_slice(3).with_index(1) do |page, number|\n  puts "page #{number}: #{page.join(", ")}"\nend' },
  { title: '移動平均', description: 'each_consで連続する値の窓を作って平滑化します。', category: 'Enumerable', badges: ['集計', '実践'], code: 'temperatures = [18.0, 20.5, 19.0, 23.5, 25.0, 24.0]\naverages = temperatures.each_cons(3).map { |window| window.sum / window.size }\nputs averages.map.with_index(3) { |avg, day| "day #{day}: #{avg.round(1)}°C" }' },
  { title: 'filter_mapで検証', description: '変換とnilの除外を1回のパスで行います。', category: 'Enumerable', badges: ['filter_map', '実践'], code: 'inputs = ["42", "oops", "17", "", "100"]\nnumbers = inputs.filter_map do |text|\n  Integer(text, exception: false)\nend\nputs "valid: #{numbers.join(", ")}"\nputs "average: #{numbers.sum.fdiv(numbers.size).round(2)}"' },
  { title: 'zipで表を作る', description: '複数の配列を列ごとに組み合わせます。', category: 'Enumerable', badges: ['Array', '初級'], code: 'names = %w[Aoi Ren Kai]\nscores = [88, 95, 73]\ngrades = scores.map { |score| score >= 90 ? "A" : score >= 80 ? "B" : "C" }\nnames.zip(scores, grades).each do |name, score, grade|\n  puts format("%-4s %3d %s", name, score, grade)\nend' },
  { title: 'Hashの差分', description: '設定値の変更前後をキーごとに比較します。', category: 'データ', badges: ['Hash', '実践'], code: 'before = { theme: "light", locale: "ja", page_size: 20 }\nafter  = { theme: "dark", locale: "ja", page_size: 50, compact: true }\n(before.keys | after.keys).each do |key|\n  next if before[key] == after[key]\n  puts "#{key}: #{before.fetch(key, "(none)")} -> #{after.fetch(key, "(none)")}"\nend' },
  { title: 'Base64エンコード', description: 'Ruby/WASMに組み込まれたpack・unpackで文字列をBase64に往復変換します。', category: 'データ', badges: ['pack', '初級'], code: 'message = "Ruby 4 on WebAssembly 💎"\nencoded = [message].pack("m0")\ndecoded = encoded.unpack1("m0").force_encoding("UTF-8")\nputs "encoded: #{encoded}"\nputs "decoded: #{decoded}"\nputs "match: #{message == decoded}"' },
  { title: 'SHA-256ハッシュ', description: '標準ライブラリで再現可能なダイジェストを計算します。', category: 'データ', badges: ['stdlib', '暗号'], code: 'require "digest"\nwords = ["ruby", "wasm", "ruby-wasm"]\nwords.each do |word|\n  puts "#{word.ljust(10)} #{Digest::SHA256.hexdigest(word)[0, 16]}..."\nend' },
  { title: 'URIを分解', description: 'URLのスキーム、ホスト、パス、クエリを取り出します。', category: 'データ', badges: ['stdlib', 'Web'], code: 'require "uri"\nuri = URI("https://example.com/search?q=ruby%20wasm&page=2")\nputs "scheme: #{uri.scheme}"\nputs "host:   #{uri.host}"\nputs "path:   #{uri.path}"\nputs URI.decode_www_form(uri.query).map { |key, value| "#{key}=#{value}" }' },
  { title: '文字の統計', description: '文字種を数え、比率を見やすく表示します。', category: '文字列', badges: ['Regexp', '初級'], code: 'text = "Ruby 4: fast, fun & expressive!"\ngroups = { letters: /[A-Za-z]/, digits: /[0-9]/, spaces: /\\s/ }\ngroups.each do |name, pattern|\n  count = text.scan(pattern).size\n  puts format("%-8s %2d %s", name, count, "#" * count)\nend' },
  { title: 'キャメルケース変換', description: '区切り文字のある名前をlowerCamelCaseに変換します。', category: '文字列', badges: ['変換', '実践'], code: 'def camelize(text)\n  head, *tail = text.downcase.split(/[-_\\s]+/)\n  head.to_s + tail.map(&:capitalize).join\nend\n["ruby_wasm", "Hello-world", "USER display name"].each do |text|\n  puts "#{text.inspect} -> #{camelize(text)}"\nend' },
  { title: 'モジュールとミックスイン', description: '共通機能をModuleに切り出してクラスで再利用します。', category: 'オブジェクト', badges: ['Module', '中級'], code: 'module Printable\n  def label = "#{self.class}: #{name}"\nend\nclass Book\n  include Printable\n  attr_reader :name\n  def initialize(name) = @name = name\nend\nclass Album\n  include Printable\n  attr_reader :name\n  def initialize(name) = @name = name\nend\nputs [Book.new("Programming Ruby"), Album.new("Ruby")].map(&:label)' },
  { title: 'キーワード引数', description: 'デフォルト付きキーワード引数で設定を明確に渡します。', category: 'オブジェクト', badges: ['API設計', '初級'], code: 'def card(title:, width: 24, mark: "*")\n  inner = " #{title} ".center(width, mark)\n  [mark * width, inner, mark * width].join("\\n")\nend\nputs card(title: "Ruby 4")\nputs\nputs card(title: "WASM", width: 18, mark: "=")' },
  { title: 'スタック式計算機', description: '配列をスタックとして使い逆ポーランド記法を計算します。', category: 'アルゴリズム', badges: ['Stack', '中級'], code: 'tokens = %w[5 1 2 + 4 * + 3 -]\nstack = []\ntokens.each do |token|\n  if %w[+ - * /].include?(token)\n    right = stack.pop\n    left = stack.pop\n    stack << left.public_send(token, right)\n  else\n    stack << token.to_i\n  end\n  puts "#{token.ljust(2)} => #{stack.inspect}"\nend\nputs "result: #{stack.first}"' },
  { title: '二分探索', description: 'ソート済み配列を半分ずつ絞り込んで値を探します。', category: 'アルゴリズム', badges: ['探索', '中級'], code: 'def binary_search(values, target)\n  low = 0\n  high = values.length - 1\n  while low <= high\n    middle = (low + high) / 2\n    return middle if values[middle] == target\n    values[middle] < target ? low = middle + 1 : high = middle - 1\n  end\n  nil\nend\nvalues = [3, 8, 12, 17, 23, 31, 42]\n[17, 9, 42].each { |n| puts "#{n}: #{binary_search(values, n).inspect}" }' },
  { title: 'シーザー暗号', description: '英字を循環させる小さな暗号化アルゴリズムです。', category: 'アルゴリズム', badges: ['暗号', '遊ぶ'], code: 'def rotate(text, shift)\n  text.chars.map do |char|\n    next char unless char.match?(/[a-z]/i)\n    base = char >= "a" ? "a".ord : "A".ord\n    ((char.ord - base + shift) % 26 + base).chr\n  end.join\nend\nsecret = rotate("Ruby Wasm", 13)\nputs secret\nputs rotate(secret, 13)' },
  { title: '乱数を固定したサイコロ', description: 'シード付きRandomで毎回同じ結果を再現します。', category: '遊ぶ', badges: ['Random', '入門'], code: 'random = Random.new(40)\nrolls = Array.new(20) { random.rand(1..6) }\nputs "rolls: #{rolls.join(" ")}"\nrolls.tally.sort.each do |face, count|\n  puts "#{face}: #{"●" * count} (#{count})"\nend' },
  { title: 'ミニビンゴ', description: '固定シードで再現可能な3×3のカードを作ります。', category: '遊ぶ', badges: ['Array', '遊ぶ'], code: 'numbers = (1..30).to_a.sample(9, random: Random.new(4))\ncard = numbers.each_slice(3).to_a\ncard.each { |row| puts row.map { |n| format("%2d", n) }.join(" | ") }\nputs "--+----+--"\nputs "center: #{card[1][1]}"' },
];

/** 外部ライブラリを追加せず、サンプルコードを安全なHTMLへ変換して色分けする。 */
function highlightRuby(code: string): string {
  const tokens: string[] = [];
  const protectedCode = code.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*)/g, (token) => {
    const kind = token.startsWith('#') ? 'comment' : 'string';
    tokens.push(`<span class="ruby-${kind}">${escapeHtml(token)}</span>`);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  return escapeHtml(protectedCode)
    .replace(/\b(class|def|do|end|if|else|elsif|unless|begin|rescue|ensure|raise|return|yield|while|until|case|when|then|require|attr_reader)\b/g, '<span class="ruby-keyword">$1</span>')
    .replace(/\b(true|false|nil)\b/g, '<span class="ruby-literal">$1</span>')
    .replace(/(?<!\u0000)\b(\d+(?:\.\d+)?)\b(?!\u0000)/g, '<span class="ruby-number">$1</span>')
    .replace(/\u0000(\d+)\u0000/g, (_match, index) => tokens[Number(index)]);
}

function renderRubyReplSnippets(): string {
  return RUBY_REPL_SNIPPETS.map((snippet, index) => {
    const payload = JSON.stringify(snippet.code).replace(/</g, '\\u003c');
    const categoryIndex = [...new Set(RUBY_REPL_SNIPPETS.map((item) => item.category))].indexOf(snippet.category);
    return `<article class="snippet-card" data-snippet-card="${index}">
      <div class="snippet-heading"><span class="snippet-category" data-category-index="${categoryIndex}">${escapeHtml(snippet.category)}</span><h3>${escapeHtml(snippet.title)}</h3><span class="ruby4-badge">Ruby 4</span></div>
      <p>${escapeHtml(snippet.description)}</p>
      <div class="snippet-badges">${(snippet.badges || []).map((badge) => `<span>${escapeHtml(badge)}</span>`).join('')}</div>
      <div class="snippet-code-wrap"><button type="button" class="snippet-run" data-run-snippet="${index}" disabled>Run ▶︎</button><pre><code class="ruby-code">${highlightRuby(snippet.code)}</code></pre></div>
      <div class="snippet-actions"><span class="snippet-state">WASMを準備中…</span></div>
      <div class="snippet-result" data-snippet-result="${index}" hidden>
        <button type="button" class="snippet-output-close" data-close-snippet="${index}" aria-label="実行結果を折り畳む">close</button>
        <output class="snippet-output" data-snippet-output="${index}"></output>
      </div>
      <script type="application/json" data-snippet-code="${index}">${payload}</script>
    </article>`;
  }).join('\n');
}

function renderRubySampleChoices(): string {
  const categories = [...new Set(RUBY_REPL_SNIPPETS.map((snippet) => snippet.category))];
  return RUBY_REPL_SNIPPETS.map((snippet, index) => {
    const categoryIndex = categories.indexOf(snippet.category);
    const firstInCategory = RUBY_REPL_SNIPPETS.findIndex((item) => item.category === snippet.category) === index;
    return `<button type="button" class="sample-choice" data-open-sample="${index}"${firstInCategory ? ` id="sample-category-${categoryIndex}"` : ''}>
    <span class="snippet-category" data-category-index="${categoryIndex}">${escapeHtml(snippet.category)}</span>
    <span class="sample-choice-copy"><strong><span class="sample-choice-title">${escapeHtml(snippet.title)}</span> <small class="ruby4-badge">Ruby 4</small></strong><span>${escapeHtml(snippet.description)}</span></span>
  </button>`;
  }).join('\n');
}

function renderRubySampleCategoryLinks(): string {
  const counts = new Map<string, number>();
  RUBY_REPL_SNIPPETS.forEach((snippet) => counts.set(snippet.category, (counts.get(snippet.category) || 0) + 1));
  return [...counts].map(([category, count], index) =>
    `<a class="sample-category-link" data-category-index="${index}" href="#sample-category-${index}"><span>${escapeHtml(category)}</span><strong>${count}</strong></a>`
  ).join('');
}

export function getRubyWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);
  const versionInfo = getRubyWasmVersionInfo();
  const wasmCacheName = rubyWasmBinaryCacheName(versionInfo.rubyBuildLine, versionInfo.wasmWasiPackageVersion);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Ruby WASM">
  <link rel="manifest" href="/manifest-ruby-wasm.json">
  <title>Ruby (WASM) - Cloudflare Workers GitHub OAuth</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      min-height: 100vh;
    }
    .navbar {
      background: var(--navbar-bg);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px var(--navbar-shadow);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .navbar-brand { font-size: 20px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
    .user-menu { display: flex; align-items: center; gap: 12px; }
    .user-name { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
    .user-icon {
      width: 40px; height: 40px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 16px; cursor: pointer;
    }
    .user-menu-container { position: relative; }
    @media (display-mode: standalone) { .pwa-hide { display: none !important; } }
    .dropdown-menu {
      display: none;
      position: absolute;
      top: 48px;
      right: 0;
      background: var(--card-bg);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      min-width: 200px;
      overflow: hidden;
      z-index: 100;
    }
    .dropdown-menu.open { display: block; }
    .dropdown-item {
      display: block;
      padding: 12px 16px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 14px;
    }
    .dropdown-item:hover { background: var(--bg-secondary); }
    .dropdown-item.logout { color: #e53e3e; }
    .dropdown-item.switch-account { color: var(--accent-color, #667eea); }
    .container { max-width: 1120px; margin: 0 auto; padding: 32px 20px 64px; }
    .card {
      background: var(--card-bg);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      padding: 32px;
    }
    .title { font-size: 22px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; }
    .notice { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
    .wasm-status {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: inline-block;
    }
    .wasm-status.loading { background: var(--bg-secondary); color: var(--text-muted); }
    .wasm-status.ready { background: #dcfce7; color: #166534; }
    .wasm-status.error { background: #fee2e2; color: #991b1b; }
    textarea {
      width: 100%;
      min-height: 160px;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      font-size: 14px;
      font-family: 'Monaco', 'Courier New', monospace;
      resize: vertical;
      margin-bottom: 16px;
    }
    .run-btn {
      background: #667eea;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .run-btn:hover:not(:disabled) { background: #5568d3; }
    .result-block { margin-top: 20px; }
    .result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .result-label { font-size: 12px; color: var(--text-muted); }
    .output-close { border: 0; background: transparent; color: var(--text-muted); font-size: 12px; cursor: pointer; text-decoration: none; }
    .result-value {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-all;
      background: var(--bg-secondary);
      color: var(--text-secondary);
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }
    .result-value.error { color: #991b1b; }
    .theme-toggle-inline { display: flex; align-items: center; }
    .toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
    .btn-secondary {
      background: var(--bg-secondary); color: var(--text-primary);
      border: 1px solid var(--border-color); border-radius: 8px;
      padding: 12px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-secondary:hover { opacity: 0.85; }
    .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
    .save-btn { background: #16a34a; color: #fff; border: none; }
    .save-btn:hover { background: #15803d; }
    .save-note { font-size: 11px; color: var(--text-muted); margin-top: -10px; margin-bottom: 14px; }
    /* モーダルのz-indexは固定値を書かず、常にgetNextZ()で算出した値を
       JSからstyle.zIndexへ設定する(CLAUDE.mdルール26)。ここではCSS上の
       初期値だけ与えておき、実際の値は開く直前にJSで上書きする。 */
    .modal-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.5);
      align-items: center; justify-content: center;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: var(--card-bg); color: var(--text-primary); border-radius: 12px; padding: 24px;
      width: min(560px, 92vw); max-height: 84vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    .modal-box h2 {
      font-size: 16px; margin: 0 0 14px; color: var(--text-primary);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .sample-modal-box { width: min(680px, 92vw); }
    .sample-modal-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
    .sample-modal-header h2 { flex: none; margin: 2px 0 0; }
    .sample-category-links { display: flex; flex: 1; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
    .sample-category-link { display: inline-flex; align-items: center; gap: 5px; padding: 4px 7px; border-radius: 999px; background: color-mix(in srgb, var(--category-color) 18%, var(--bg-secondary)); color: var(--category-color); font-size: 10px; font-weight: 700; text-decoration: none; }
    .sample-category-link strong { min-width: 16px; padding: 1px 4px; border-radius: 999px; background: var(--category-color); color: #fff; text-align: center; }
    [data-category-index="0"] { --category-color: #e11d48; }
    [data-category-index="1"] { --category-color: #7c3aed; }
    [data-category-index="2"] { --category-color: #0284c7; }
    [data-category-index="3"] { --category-color: #0891b2; }
    [data-category-index="4"] { --category-color: #059669; }
    [data-category-index="5"] { --category-color: #d97706; }
    [data-category-index="6"] { --category-color: #db2777; }
    [data-category-index="7"] { --category-color: #4f46e5; }
    .sample-choice-list { display: grid; gap: 8px; }
    .sample-choice {
      width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 12px;
      border: 1px solid var(--border-color); border-radius: 9px; background: var(--card-bg);
      color: var(--text-primary); text-align: left; cursor: pointer;
    }
    .sample-choice:hover, .sample-choice:focus-visible { background: var(--bg-secondary); border-color: #667eea; }
    .sample-choice-copy { display: grid; gap: 4px; min-width: 0; }
    .sample-choice-copy strong { font-size: 14px; }
    .sample-choice-copy > span { color: var(--text-muted); font-size: 12px; line-height: 1.5; }
    .sample-detail-box { position: relative; width: min(640px, 92vw); padding-top: 46px; }
    .sample-detail-corner-close { position: absolute; top: 12px; right: 14px; }
    .sample-detail-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
    .sample-detail-heading h2 { margin: 0; }
    .sample-detail-description { margin: 0 0 12px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
    .sample-detail-code-wrap { position: relative; }
    .sample-detail-code { max-height: 46vh; margin: 0; padding: 14px; padding-right: 88px; overflow: auto; border: 1px solid var(--border-color); border-radius: 9px; background: #172033; color: #e7edf7; font: 12px/1.55 'Monaco', 'Courier New', monospace; tab-size: 2; }
    .sample-load-button { min-width: 42px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-weight: 700; cursor: pointer; }
    .sample-detail-result-wrap { position: relative; margin-top: 10px; padding-top: 24px; }
    .sample-detail-result-wrap[hidden] { display: none; }
    .sample-detail-result-close { position: absolute; top: 0; right: 0; border: 0; background: transparent; color: var(--text-muted); font-size: 11px; text-decoration: none; cursor: pointer; }
    .sample-detail-footer { display: flex; justify-content: center; margin-top: 18px; }
    .sample-detail-bottom-close { padding: 9px 28px; }
    .modal-snippet-list { list-style: none; padding: 0; margin: 0 0 14px; max-height: 220px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px; }
    .modal-snippet-list li { font-size: 13px; border-bottom: 1px solid var(--border-color); }
    .modal-snippet-list li:last-child { border-bottom: none; }
    /* プレースホルダー行(読み込み中・0件・エラー)。swipe行ではないので
       通常通りpaddingを持たせる。 */
    .modal-snippet-list > li:not(.snippet-swipe-row) { padding: 10px 12px; color: var(--text-muted); }
    .modal-snippet-meta { font-size: 11px; color: var(--text-muted); }
    .modal-snippet-list li.snippet-swipe-row { position: relative; overflow: hidden; padding: 0; touch-action: pan-y; }
    .snippet-swipe-content { position: relative; z-index: 1; padding: 10px 12px; background: var(--card-bg); transition: transform 0.2s ease; }
    .snippet-swipe-row.selected .snippet-swipe-content, .snippet-swipe-content:hover { background: var(--bg-secondary); }
    .snippet-delete-btn { position: absolute; inset: 0 0 0 auto; width: 72px; border: none; background: var(--danger-color); color: #fff; font-weight: 700; cursor: pointer; opacity: 0; pointer-events: none; transition: opacity 0.15s ease; }
    .snippet-swipe-row.swipe-open .snippet-delete-btn { opacity: 1; pointer-events: auto; }
    .delete-confirm-box { width: min(380px, 92vw); text-align: center; }
    .delete-confirm-box p { margin: 0 0 18px; color: var(--text-secondary); overflow-wrap: anywhere; }
    .delete-confirm-actions { display: flex; justify-content: center; gap: 10px; }
    .delete-confirm-actions button { border-radius: 8px; padding: 10px 18px; font-weight: 600; cursor: pointer; }
    .delete-confirm-ok { border: none; background: var(--danger-color); color: #fff; }
    #modalCodeTextarea { min-height: 140px; }
    #modalResultValue {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px; white-space: pre-wrap; word-break: break-all;
      background: var(--bg-secondary); color: var(--text-secondary);
      padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);
    }
    #modalResultValue.error { color: #991b1b; }
    .snippet-section { margin-top: 32px; }
    .snippet-section-header { margin-bottom: 18px; color: var(--text-primary); }
    .snippet-section-header h2 { font-size: 22px; margin-bottom: 6px; }
    .snippet-section-header p { color: var(--text-muted); font-size: 14px; line-height: 1.6; }
    .snippet-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .snippet-card { min-width: 0; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px; box-shadow: 0 5px 18px rgba(0, 0, 0, .08); }
    .snippet-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
    .snippet-heading h3 { color: var(--text-primary); font-size: 16px; }
    .snippet-category { flex: none; padding: 3px 7px; border-radius: 999px; background: color-mix(in srgb, var(--category-color) 18%, var(--bg-secondary)); color: var(--category-color); font-size: 10px; font-weight: 700; }
    .ruby4-badge { flex: none; padding: 2px 6px; border: 1px solid #a78bfa; border-radius: 999px; background: #ede9fe; color: #5b21b6; font-size: 9px; font-weight: 800; }
    .snippet-heading .ruby4-badge { margin-left: auto; }
    .snippet-card > p { min-height: 38px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
    .snippet-badges { display: flex; flex-wrap: wrap; gap: 5px; min-height: 19px; margin-top: 7px; }
    .snippet-badges span { padding: 2px 6px; border-radius: 999px; background: var(--bg-secondary); color: var(--text-muted); font-size: 9px; font-weight: 700; }
    .snippet-code-wrap { position: relative; margin: 10px 0 7px; }
    .snippet-card pre { max-height: 260px; margin: 0; padding: 14px; overflow: auto; border: 1px solid var(--border-color); border-radius: 9px; background: #172033; color: #e7edf7; font: 12px/1.55 'Monaco', 'Courier New', monospace; tab-size: 2; }
    .ruby-keyword { color: #ff7ab2; font-weight: 600; }
    .ruby-string { color: #b4f1a1; }
    .ruby-comment { color: #8290a6; font-style: italic; }
    .ruby-number { color: #ffd580; }
    .ruby-literal { color: #82aaff; font-weight: 600; }
    .snippet-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .snippet-run { position: absolute; top: 8px; right: 8px; z-index: 1; padding: 6px 10px; border: 0; border-radius: 7px; background: #667eea; color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .snippet-run:hover:not(:disabled) { background: #5568d3; }
    .snippet-run:disabled { opacity: .5; cursor: not-allowed; }
    .snippet-state { color: var(--text-muted); font-size: 11px; }
    .snippet-result { position: relative; margin-top: 12px; }
    .snippet-result[hidden] { display: none; }
    .snippet-output-close { display: block; margin: 0 0 5px auto; border: 0; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; text-decoration: none; }
    .snippet-output { display: block; padding: 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.55 'Monaco', 'Courier New', monospace; }
    .snippet-output.error { color: #991b1b; border-color: #ef4444; }
    @media (max-width: 760px) {
      .navbar { padding: 13px 16px; }
      .user-name { display: none; }
      .card { padding: 22px 18px; }
      .snippet-grid { grid-template-columns: 1fr; }
      .snippet-card > p { min-height: 0; }
    }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="navbar-brand">
      <span>💎</span>
      <span>Ruby (WASM)</span>
    </div>
    <div class="user-menu">
      ${getThemeToggleHTML()}
      <span class="user-name pwa-hide">${safeUsername}</span>
      <div class="user-menu-container pwa-hide">
        <div class="user-icon" title="${safeUsername}" onclick="toggleDropdown()">
          ${escapeHtml(username.substring(0, 2).toUpperCase())}
        </div>
        <div class="dropdown-menu" id="dropdownMenu">
          <a href="/welcome" class="dropdown-item">🏠 ホーム</a>
          <a href="/aichat" class="dropdown-item">🤖 AI チャット</a>
          <a href="/repositories" class="dropdown-item">📦 リポジトリ</a>
          <a href="/settings" class="dropdown-item">⚙️ 設定</a>
          <a href="/api-keys" class="dropdown-item">🔑 キー管理</a>
          <a href="/auth/switch" class="dropdown-item switch-account">🔄 別アカウントでログイン</a>
          <a href="/auth/logout" class="dropdown-item logout">🚪 ログアウト</a>
        </div>
      </div>
    </div>
  </nav>

  <div class="container">
    <div class="card">
      <div class="title">Ruby コード実行 (WASM)</div>
      <div class="subtitle">CRubyの公式WASM(WASI)ビルドをブラウザ上のWebAssemblyで実行します。</div>
      <div class="notice">初回はRuby本体(非圧縮約32MB)をCDNから取得します。通信状況により数十秒かかることがあります。進捗は下のステータスに出ます。2回目以降はブラウザキャッシュを使います。</div>
      <div class="wasm-status loading" id="wasmStatus">WASMモジュールを読み込み中…</div>
      <div class="toolbar">
        <button type="button" class="btn-secondary" id="openListBtn">📚 保存済みスニペット一覧</button>
        <button type="button" class="btn-secondary" id="openSamplesBtn">💎 サンプルから選ぶ</button>
      </div>
      <textarea id="inputCode" placeholder="puts 'hello world'">puts 'hello world'</textarea>
      <div class="toolbar">
        <button class="run-btn" id="runBtn" disabled>Rubyコードを実行</button>
        <button type="button" class="btn-secondary" id="clearBtn">🧹 クリア</button>
        <button type="button" class="btn-secondary save-btn" id="saveBtn" style="display:none;">💾 保存</button>
      </div>
      <div class="save-note" id="saveNote"></div>
      <div class="result-block" id="resultBlock" style="display:none;">
        <div class="result-header"><div class="result-label">実行結果</div><button type="button" class="output-close" id="resultCloseBtn" aria-label="実行結果を折り畳む">close</button></div>
        <div class="result-value" id="resultValue"></div>
      </div>
    </div>

    <section class="snippet-section" aria-labelledby="snippetTitle">
      <div class="snippet-section-header">
        <h2 id="snippetTitle">そのまま動く Ruby スニペット集</h2>
        <p>基本文法からデータ処理、オブジェクト、アルゴリズムまで ${RUBY_REPL_SNIPPETS.length} 本。各コードブロックの「Run ▶︎」からRuby/WASMで直接実行できます。</p>
      </div>
      <div class="snippet-grid">${renderRubyReplSnippets()}</div>
    </section>
  </div>

  <div class="modal-overlay" id="sampleModalOverlay" role="dialog" aria-modal="true" aria-labelledby="sampleModalTitle">
    <div class="modal-box sample-modal-box">
      <div class="sample-modal-header"><h2 id="sampleModalTitle">💎 Ruby サンプルを選ぶ</h2><nav class="sample-category-links" aria-label="カテゴリー別サンプル">${renderRubySampleCategoryLinks()}</nav><button type="button" class="modal-close" id="sampleModalCloseBtn" aria-label="閉じる">✕</button></div>
      <div class="sample-choice-list">${renderRubySampleChoices()}</div>
    </div>
  </div>

  <div class="modal-overlay" id="sampleDetailOverlay" role="dialog" aria-modal="true" aria-labelledby="sampleDetailTitle">
    <div class="modal-box sample-detail-box">
      <button type="button" class="modal-close sample-detail-corner-close" id="sampleDetailCloseBtn" aria-label="サンプルを閉じる">✕</button>
      <div class="sample-detail-heading"><button type="button" class="sample-load-button" id="sampleLoadBtn" aria-label="REPLにコピーしてサンプル選択を閉じる">▲</button><span class="snippet-category" id="sampleDetailCategory"></span><h2 id="sampleDetailTitle"></h2><span class="ruby4-badge">Ruby 4</span></div>
      <p class="sample-detail-description" id="sampleDetailDescription"></p>
      <div class="sample-detail-code-wrap"><button type="button" class="snippet-run" id="sampleRunBtn" disabled>Run ▶︎</button><pre class="sample-detail-code"><code class="ruby-code" id="sampleDetailCode"></code></pre></div>
      <div class="sample-detail-result-wrap" id="sampleDetailResultWrap" hidden><button type="button" class="sample-detail-result-close" id="sampleDetailResultCloseBtn">close</button><output class="snippet-output" id="sampleDetailResult"></output></div>
      <div class="sample-detail-footer"><button type="button" class="btn-secondary sample-detail-bottom-close" id="sampleDetailBottomCloseBtn">閉じる</button></div>
    </div>
  </div>

  <div class="modal-overlay" id="listModalOverlay">
    <div class="modal-box">
      <h2>📚 保存済みスニペット一覧 <button type="button" class="modal-close" id="listModalCloseBtn">✕</button></h2>
      <ul class="modal-snippet-list" id="modalSnippetList"><li>読み込み中…</li></ul>
      <textarea id="modalCodeTextarea" placeholder="一覧から選ぶとここにコードが読み込まれます(編集可能)"></textarea>
      <div class="toolbar" style="margin-top:10px;margin-bottom:0;">
        <button type="button" class="run-btn" id="modalRunBtn" disabled>▶ 実行</button>
      </div>
      <div class="save-note" id="modalNote"></div>
    </div>
  </div>

  <div class="modal-overlay" id="resultModalOverlay">
    <div class="modal-box">
      <h2>実行結果 <button type="button" class="modal-close" id="resultModalCloseBtn">✕</button></h2>
      <div id="modalResultValue"></div>
    </div>
  </div>

  <div class="modal-overlay" id="deleteConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="deleteConfirmTitle">
    <div class="modal-box delete-confirm-box">
      <h2 id="deleteConfirmTitle">スニペットを削除しますか？</h2>
      <p id="deleteConfirmMessage"></p>
      <div class="delete-confirm-actions">
        <button type="button" class="delete-confirm-ok" id="deleteConfirmOkBtn">削除</button>
        <button type="button" class="btn-secondary" id="deleteConfirmCancelBtn">キャンセル</button>
      </div>
    </div>
  </div>

  <script type="module">
    ${getThemeToggleScript()}

    function toggleDropdown() {
      document.getElementById('dropdownMenu').classList.toggle('open');
    }
    window.toggleDropdown = toggleDropdown;
    document.addEventListener('click', function(e) {
      var menu = document.getElementById('dropdownMenu');
      var container = document.querySelector('.user-menu-container');
      if (menu.classList.contains('open') && container && !container.contains(e.target)) {
        menu.classList.remove('open');
      }
    });

    var wasmStatus = document.getElementById('wasmStatus');
    var runBtn = document.getElementById('runBtn');
    var clearBtn = document.getElementById('clearBtn');
    var saveBtn = document.getElementById('saveBtn');
    var saveNote = document.getElementById('saveNote');
    var inputCode = document.getElementById('inputCode');
    var resultBlock = document.getElementById('resultBlock');
    var resultCloseBtn = document.getElementById('resultCloseBtn');
    var resultValue = document.getElementById('resultValue');
    var rubyVM = null;

    // 複数のモーダル・オーバーレイが同時に開いた際、後から開いた方が必ず
    // 手前に来るようz-indexを動的に算出する(固定値は書かない。CLAUDE.mdルール26)。
    function getNextZ() {
      var els = document.querySelectorAll('[style*="z-index"]');
      var max = 100;
      for (var i = 0; i < els.length; i++) {
        var z = parseInt(els[i].style.zIndex, 10);
        if (!isNaN(z) && z > max) max = z;
      }
      return max + 100;
    }

    // メインの実行エリア・モーダル双方の「実行」から共通で使う、Rubyコード
    // 実行ロジック。stdoutをキャプチャしてtoStringで文字列化する。
    function runRubyCode(code) {
      if (!rubyVM) return { ok: false, output: 'WASMモジュールを読み込み中です。しばらく待ってから再度お試しください' };
      try {
        var wrapped =
          "require 'stringio'\\n" +
          "__out = StringIO.new\\n" +
          "__orig_stdout = $stdout\\n" +
          "$stdout = __out\\n" +
          "begin\\n" +
          code + "\\n" +
          "ensure\\n" +
          "  $stdout = __orig_stdout\\n" +
          "end\\n" +
          "__out.string";
        var output = rubyVM.eval(wrapped).toString();
        return { ok: true, output: output.length > 0 ? output : '(出力なし)' };
      } catch (err) {
        return { ok: false, output: err && err.message ? err.message : String(err) };
      }
    }

    clearBtn.addEventListener('click', function() {
      inputCode.value = '';
      resultBlock.style.display = 'none';
      saveBtn.style.display = 'none';
      saveNote.textContent = '';
    });

    resultCloseBtn.addEventListener('click', function() {
      resultBlock.style.display = 'none';
    });

    runBtn.addEventListener('click', function() {
      if (!rubyVM) return;
      resultBlock.style.display = 'block';
      saveNote.textContent = '';
      var result = runRubyCode(inputCode.value);
      resultValue.classList.toggle('error', !result.ok);
      resultValue.textContent = result.output;
      // 実行結果が正常(例外なし)の場合のみ保存ボタンを表示する。新しく
      // 実行し直した分は前回保存済みとは別物なので、以前の保存成功で
      // 無効化されたままになっていても、ここで必ず有効化し直す。
      saveBtn.style.display = result.ok ? 'inline-block' : 'none';
      if (result.ok) saveBtn.disabled = false;
    });

    saveBtn.addEventListener('click', function() {
      var code = inputCode.value;
      if (!code.trim()) return;
      var saveSucceeded = false;
      saveBtn.disabled = true;
      saveNote.textContent = '保存中...';
      fetch('/api/ruby-wasm/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        // 保存ボタンはrunRubyCode()が成功した場合にのみ表示される(runBtnの
        // クリックハンドラ参照)。実際にRubyとして実行できたことを
        // サーバー側へ伝え、構文ヒューリスティックによる誤判定で保存を
        // 拒否されないようにする。
        body: JSON.stringify({ code: code, executedSuccessfully: true })
      })
        .then(function(r) { return r.json().then(function(d) { return { status: r.status, data: d }; }); })
        .then(function(res) {
          if (res.status !== 200 || !res.data || !res.data.id) {
            saveNote.textContent = '❌ 保存に失敗しました: ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
            return;
          }
          // 保存直前にこのコードは正常実行を確認済みなので、保存と同時に
          // 「動作確認済み」も記録する(手動での👍/👎操作を挟まない)。
          return fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(res.data.id) + '/verifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ verified: true })
          }).then(function() {
            saveSucceeded = true;
            saveNote.textContent = '✅ 「' + res.data.title + '」として保存し、動作確認済みとして記録しました';
          });
        })
        .catch(function(err) {
          saveNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
        })
        .then(function() {
          // 保存に成功した場合は、同じコードを誤って重複登録してしまわない
          // よう保存ボタンを無効化(グレーアウト)したままにする。失敗時
          // のみ再度押せるよう有効化する。
          if (!saveSucceeded) saveBtn.disabled = false;
        });
    });

    // ---- 保存済みスニペット一覧モーダル ----
    var openListBtn = document.getElementById('openListBtn');
    var listModalOverlay = document.getElementById('listModalOverlay');
    var listModalCloseBtn = document.getElementById('listModalCloseBtn');
    var modalSnippetList = document.getElementById('modalSnippetList');
    var modalCodeTextarea = document.getElementById('modalCodeTextarea');
    var modalRunBtn = document.getElementById('modalRunBtn');
    var modalNote = document.getElementById('modalNote');

    // ---- 全サンプル選択モーダル(開くたび、その時点で最上位レイヤーへ置く) ----
    var openSamplesBtn = document.getElementById('openSamplesBtn');
    var sampleModalOverlay = document.getElementById('sampleModalOverlay');
    var sampleModalCloseBtn = document.getElementById('sampleModalCloseBtn');
    var sampleDetailOverlay = document.getElementById('sampleDetailOverlay');
    var sampleDetailCloseBtn = document.getElementById('sampleDetailCloseBtn');
    var sampleDetailCategory = document.getElementById('sampleDetailCategory');
    var sampleDetailTitle = document.getElementById('sampleDetailTitle');
    var sampleDetailDescription = document.getElementById('sampleDetailDescription');
    var sampleDetailCode = document.getElementById('sampleDetailCode');
    var sampleDetailResultWrap = document.getElementById('sampleDetailResultWrap');
    var sampleDetailResult = document.getElementById('sampleDetailResult');
    var sampleDetailResultCloseBtn = document.getElementById('sampleDetailResultCloseBtn');
    var sampleDetailBottomCloseBtn = document.getElementById('sampleDetailBottomCloseBtn');
    var sampleLoadBtn = document.getElementById('sampleLoadBtn');
    var sampleRunBtn = document.getElementById('sampleRunBtn');
    var selectedSampleCode = '';

    // ---- 実行結果モーダル(一覧モーダルよりさらに上のレイヤー) ----
    var resultModalOverlay = document.getElementById('resultModalOverlay');
    var resultModalCloseBtn = document.getElementById('resultModalCloseBtn');
    var modalResultValue = document.getElementById('modalResultValue');
    var deleteConfirmOverlay = document.getElementById('deleteConfirmOverlay');
    var deleteConfirmMessage = document.getElementById('deleteConfirmMessage');
    var deleteConfirmOkBtn = document.getElementById('deleteConfirmOkBtn');
    var deleteConfirmCancelBtn = document.getElementById('deleteConfirmCancelBtn');
    var openSwipeRow = null;

    ${getRubyWasmLoaderScript()}
    loadRubyWasmVm('${RUBY_WASM_JS_URL}', '${RUBY_WASM_BINARY_URL}', '${wasmCacheName}', {
      expectedBuildLine: '${versionInfo.rubyBuildLine}',
      onStatus: function(text) {
        wasmStatus.textContent = text;
        wasmStatus.className = 'wasm-status loading';
      },
      onReady: function(vm, ver) {
        rubyVM = vm;
        wasmStatus.textContent = ver
          ? 'WASMモジュール読み込み完了 (' + ver + ')'
          : 'WASMモジュール読み込み完了';
        wasmStatus.className = 'wasm-status ready';
        runBtn.disabled = false;
        modalRunBtn.disabled = false;
        sampleRunBtn.disabled = false;
        document.querySelectorAll('[data-run-snippet]').forEach(function(button) {
          button.disabled = false;
          var card = button.closest('.snippet-card');
          var state = card && card.querySelector('.snippet-state');
          if (state) state.textContent = '';
        });
      },
      onError: function(err) {
        wasmStatus.textContent = 'WASMモジュールの読み込みに失敗しました: ' + (err && err.message ? err.message : String(err));
        wasmStatus.className = 'wasm-status error';
        document.querySelectorAll('.snippet-state').forEach(function(state) {
          state.textContent = 'WASMを読み込めませんでした';
        });
      }
    });

    document.querySelectorAll('[data-run-snippet]').forEach(function(button) {
      button.addEventListener('click', function() {
        var index = button.getAttribute('data-run-snippet');
        var codeNode = document.querySelector('[data-snippet-code="' + index + '"]');
        var resultPanel = document.querySelector('[data-snippet-result="' + index + '"]');
        var output = document.querySelector('[data-snippet-output="' + index + '"]');
        if (!codeNode || !resultPanel || !output) return;
        var code = JSON.parse(codeNode.textContent || '""');
        button.disabled = true;
        button.textContent = '実行中…';
        var result = runRubyCode(code);
        resultPanel.hidden = false;
        output.classList.toggle('error', !result.ok);
        output.textContent = result.output;
        button.textContent = 'Run ▶︎';
        button.disabled = !rubyVM;
      });
    });

    document.querySelectorAll('[data-close-snippet]').forEach(function(button) {
      button.addEventListener('click', function() {
        var index = button.getAttribute('data-close-snippet');
        var resultPanel = document.querySelector('[data-snippet-result="' + index + '"]');
        if (resultPanel) resultPanel.hidden = true;
      });
    });

    function openModal(overlay) {
      overlay.style.zIndex = String(getNextZ());
      overlay.classList.add('open');
    }
    function closeModal(overlay) {
      overlay.classList.remove('open');
    }

    openSamplesBtn.addEventListener('click', function() {
      openModal(sampleModalOverlay);
    });
    sampleModalCloseBtn.addEventListener('click', function() { closeModal(sampleModalOverlay); });
    sampleModalOverlay.addEventListener('click', function(e) {
      if (e.target === sampleModalOverlay) closeModal(sampleModalOverlay);
    });
    document.querySelectorAll('[data-open-sample]').forEach(function(button) {
      button.addEventListener('click', function() {
        var index = button.getAttribute('data-open-sample');
        var codeNode = document.querySelector('[data-snippet-code="' + index + '"]');
        var card = codeNode && codeNode.closest('.snippet-card');
        if (!codeNode || !card) return;
        selectedSampleCode = JSON.parse(codeNode.textContent || '""');
        sampleDetailCategory.textContent = button.querySelector('.snippet-category').textContent;
        sampleDetailCategory.setAttribute('data-category-index', button.querySelector('.snippet-category').getAttribute('data-category-index'));
        sampleDetailTitle.textContent = button.querySelector('.sample-choice-title').textContent;
        sampleDetailDescription.textContent = button.querySelector('.sample-choice-copy > span').textContent;
        sampleDetailCode.innerHTML = card.querySelector('.ruby-code').innerHTML;
        sampleDetailResultWrap.hidden = true;
        sampleDetailResult.textContent = '';
        openModal(sampleDetailOverlay);
      });
    });
    sampleDetailCloseBtn.addEventListener('click', function() { closeModal(sampleDetailOverlay); });
    sampleDetailBottomCloseBtn.addEventListener('click', function() { closeModal(sampleDetailOverlay); });
    sampleDetailResultCloseBtn.addEventListener('click', function() { sampleDetailResultWrap.hidden = true; });
    sampleDetailOverlay.addEventListener('click', function(e) {
      if (e.target === sampleDetailOverlay) closeModal(sampleDetailOverlay);
    });
    sampleRunBtn.addEventListener('click', function() {
      var result = runRubyCode(selectedSampleCode);
      sampleDetailResultWrap.hidden = false;
      sampleDetailResult.classList.toggle('error', !result.ok);
      sampleDetailResult.textContent = result.output;
    });
    sampleLoadBtn.addEventListener('click', function() {
        // 以前の入力と実行状態を一度すべて消してから、選択コードだけを入れる。
        inputCode.value = '';
        resultBlock.style.display = 'none';
        resultValue.textContent = '';
        saveBtn.style.display = 'none';
        saveNote.textContent = '';
        inputCode.value = selectedSampleCode;
        closeModal(sampleDetailOverlay);
        closeModal(sampleModalOverlay);
        inputCode.focus();
    });

    // 呼び出し側にはモーダル操作を漏らさず、ユーザーの承認結果だけを返す。
    function requestDeleteConfirmation(title) {
      deleteConfirmMessage.textContent = '「' + title + '」を削除すると元に戻せません。';
      openModal(deleteConfirmOverlay);
      return new Promise(function(resolve) {
        var settled = false;
        function finish(approved) {
          if (settled) return;
          settled = true;
          closeModal(deleteConfirmOverlay);
          deleteConfirmOkBtn.removeEventListener('click', approve);
          deleteConfirmCancelBtn.removeEventListener('click', cancel);
          deleteConfirmOverlay.removeEventListener('click', backdrop);
          resolve(approved);
        }
        function approve() { finish(true); }
        function cancel() { finish(false); }
        function backdrop(e) { if (e.target === deleteConfirmOverlay) finish(false); }
        deleteConfirmOkBtn.addEventListener('click', approve);
        deleteConfirmCancelBtn.addEventListener('click', cancel);
        deleteConfirmOverlay.addEventListener('click', backdrop);
        deleteConfirmCancelBtn.focus();
      });
    }

    // 任意の行・前面コンテンツ・アクションボタンに再利用できるスワイプ検知。
    function setupSwipeReveal(row, content, actionButton) {
      var startX = 0;
      var dragging = false;
      var moved = false;
      var buttonWidth = 72;
      function close() {
        content.style.transform = 'translateX(0)';
        row.classList.remove('swipe-open');
        if (openSwipeRow === row) openSwipeRow = null;
      }
      function start(x) { startX = x; dragging = true; moved = false; }
      function move(x) {
        if (!dragging) return;
        var dx = x - startX;
        if (Math.abs(dx) < 4) return;
        moved = true;
        var base = row.classList.contains('swipe-open') ? -buttonWidth : 0;
        content.style.transition = 'none';
        content.style.transform = 'translateX(' + Math.max(-buttonWidth, Math.min(0, base + dx)) + 'px)';
      }
      function end(x) {
        if (!dragging) return;
        dragging = false;
        content.style.transition = 'transform 0.2s ease';
        if (!moved) return;
        var dx = x - startX;
        var shouldOpen = row.classList.contains('swipe-open') ? dx < buttonWidth / 2 : -dx > 50;
        if (!shouldOpen) { close(); return; }
        if (openSwipeRow && openSwipeRow !== row) {
          openSwipeRow.classList.remove('swipe-open');
          var previous = openSwipeRow.querySelector('.snippet-swipe-content');
          if (previous) previous.style.transform = 'translateX(0)';
        }
        content.style.transform = 'translateX(-' + buttonWidth + 'px)';
        row.classList.add('swipe-open');
        openSwipeRow = row;
      }
      row.addEventListener('touchstart', function(e) { start(e.touches[0].clientX); }, { passive: true });
      row.addEventListener('touchmove', function(e) { move(e.touches[0].clientX); }, { passive: true });
      row.addEventListener('touchend', function(e) { end(e.changedTouches[0].clientX); });
      content.addEventListener('mousedown', function(e) { if (e.button === 0) start(e.clientX); });
      content.addEventListener('mousemove', function(e) { if (dragging) move(e.clientX); });
      content.addEventListener('mouseup', function(e) { end(e.clientX); });
      content.addEventListener('mouseleave', function(e) { if (dragging) end(e.clientX); });
      actionButton.addEventListener('click', function(e) { e.stopPropagation(); });
    }

    function loadModalSnippetList() {
      openSwipeRow = null;
      modalSnippetList.innerHTML = '<li>読み込み中…</li>';
      fetch('/api/ruby-wasm/snippets', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var snippets = (d && d.snippets) || [];
          modalSnippetList.innerHTML = '';
          if (snippets.length === 0) {
            modalSnippetList.innerHTML = '<li>保存済みスニペットはありません</li>';
            return;
          }
          snippets.forEach(function(s) {
            var li = document.createElement('li');
            var row = li;
            li.className = 'snippet-swipe-row';
            var deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'snippet-delete-btn';
            deleteBtn.textContent = '削除';
            deleteBtn.setAttribute('aria-label', s.title + 'を削除');
            var content = document.createElement('div');
            content.className = 'snippet-swipe-content';
            var titleSpan = document.createElement('div');
            titleSpan.textContent = s.title;
            var metaSpan = document.createElement('div');
            metaSpan.className = 'modal-snippet-meta';
            metaSpan.textContent = 'Ruby ' + s.ruby_version + ' ・ ' + s.created_at;
            content.appendChild(titleSpan);
            content.appendChild(metaSpan);
            li.appendChild(deleteBtn);
            li.appendChild(content);
            content.addEventListener('click', function() {
              Array.prototype.forEach.call(modalSnippetList.children, function(el) { el.classList.remove('selected'); });
              li.classList.add('selected');
              modalNote.textContent = '読み込み中…';
              fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(s.id), { credentials: 'same-origin' })
                .then(function(r) { return r.json().then(function(dd) { return { status: r.status, data: dd }; }); })
                .then(function(res) {
                  if (res.status === 200 && res.data && typeof res.data.code === 'string') {
                    // 選択したスニペットのコードで、リスト下のコード入力
                    // エリアを上書きする(編集可能な状態のまま)。
                    modalCodeTextarea.value = res.data.code;
                    modalNote.textContent = '「' + res.data.title + '」を読み込みました。編集してから実行することもできます';
                  } else {
                    modalNote.textContent = '❌ 読み込みに失敗しました: ' + (res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
                  }
                })
                .catch(function(err) {
                  modalNote.textContent = '❌ 通信エラー: ' + ((err && err.message) || '不明');
                });
            });
            setupSwipeReveal(li, content, deleteBtn);
            deleteBtn.addEventListener('click', function() {
              requestDeleteConfirmation(s.title).then(function(approved) {
                if (!approved) return;
                deleteBtn.disabled = true;
                modalNote.textContent = '削除中…';
                fetch('/api/ruby-wasm/snippets/' + encodeURIComponent(s.id), {
                  method: 'DELETE', credentials: 'same-origin'
                }).then(function(r) {
                  return r.json().then(function(dd) { return { status: r.status, data: dd }; });
                }).then(function(res) {
                  if (res.status !== 200 || !res.data || res.data.ok !== true) {
                    throw new Error(res.data && res.data.error ? res.data.error : 'HTTP ' + res.status);
                  }
                  row.remove();
                  modalCodeTextarea.value = '';
                  modalNote.textContent = '✅ 「' + s.title + '」を削除しました';
                  if (!modalSnippetList.children.length) modalSnippetList.innerHTML = '<li>保存済みスニペットはありません</li>';
                }).catch(function(err) {
                  deleteBtn.disabled = false;
                  modalNote.textContent = '❌ 削除に失敗しました: ' + ((err && err.message) || '不明');
                });
              });
            });
            modalSnippetList.appendChild(li);
          });
        })
        .catch(function() {
          modalSnippetList.innerHTML = '<li>一覧の取得に失敗しました</li>';
        });
    }

    openListBtn.addEventListener('click', function() {
      loadModalSnippetList();
      modalCodeTextarea.value = '';
      modalNote.textContent = '';
      openModal(listModalOverlay);
    });
    listModalCloseBtn.addEventListener('click', function() { closeModal(listModalOverlay); });
    listModalOverlay.addEventListener('click', function(e) {
      if (e.target === listModalOverlay) closeModal(listModalOverlay);
    });

    modalRunBtn.addEventListener('click', function() {
      var code = modalCodeTextarea.value;
      if (!code.trim()) {
        modalNote.textContent = '❌ コードを入力してください';
        return;
      }
      var result = runRubyCode(code);
      modalResultValue.classList.toggle('error', !result.ok);
      modalResultValue.textContent = result.output;
      // 実行結果は、一覧モーダルよりさらに上のレイヤーのモーダルに表示する。
      openModal(resultModalOverlay);
    });

    resultModalCloseBtn.addEventListener('click', function() { closeModal(resultModalOverlay); });
    resultModalOverlay.addEventListener('click', function(e) {
      if (e.target === resultModalOverlay) closeModal(resultModalOverlay);
    });
  </script>
</body>
</html>`;
}
