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
  { title: 'sqlx-d1出力アダプタ', description: 'sqlx-d1のSectionOutcome形式を解析し、取得に成功した各テーブルの行数を表示します。', category: 'データ', badges: ['sqlx-d1', 'JSON', '相互運用'], code: 'require "json"\n# rust-worker-sqlx-d1の /sqlx-d1-examples/data が返すJSONの形。\n# migration 0161適用後はapi_endpoint_statsもokとして取得できる。\nraw = %q({\n  "user_sessions": {"status":"ok","rows":[{"user_id":"octocat","timezone":"JST"},{"user_id":"nyaon","timezone":"UTC"}]},\n  "api_endpoint_stats": {"status":"ok","rows":[{"endpoint":"GET /api/user","status_code":200,"count":42}]},\n  "commit_agent_log_page": {"status":"ok","rows":[{"repo_full_name":"nekoserver/rust-worker-sqlx-d1","pr_number":54}]}\n})\nreport = JSON.parse(raw)\nreport.each do |section, outcome|\n  rows = outcome.fetch("rows")\n  puts "#{section}: #{rows.size}件"\nend' },
  { title: 'sqlx-d1ページング応答', description: 'sqlx-d1で取得したカーソル付きページを読み、次ページの有無と行を安全に表示します。', category: 'データ', badges: ['sqlx-d1', 'ページング', 'JSON'], code: 'require "json"\nraw = %q({"rows":[{"id":103,"message":"deploy"},{"id":102,"message":"test"}],"next_cursor":"102","has_more":true})\npage = JSON.parse(raw)\npage.fetch("rows").each do |row|\n  puts "##{row.fetch("id")}: #{row.fetch("message")}"\nend\nputs page["has_more"] ? "next: #{page.fetch("next_cursor")}" : "last page"' },
  { title: 'sqlx-d1集計行の変換', description: 'GROUP BYクエリの文字列・数値・NULLをRubyの型へ変換して集計レポートを作ります。', category: 'データ', badges: ['sqlx-d1', '集計', 'NULL'], code: 'require "json"\nraw = %q([{"status_code":200,"request_count":128,"average_ms":12.5},{"status_code":500,"request_count":3,"average_ms":null}])\nrows = JSON.parse(raw)\ntotal = rows.sum { |row| row.fetch("request_count") }\nrows.each do |row|\n  average = row["average_ms"] ? format("%.1f ms", row["average_ms"]) : "計測なし"\n  puts "HTTP #{row.fetch("status_code")}: #{row.fetch("request_count")}件 / #{average}"\nend\nputs "total: #{total}件"' },
  { title: 'sqlx-d1エラー境界', description: 'セクション単位の成功・失敗を分離し、1クエリの失敗後も成功データを処理します。', category: 'データ', badges: ['sqlx-d1', 'Result', '障害分離'], code: 'require "json"\nraw = %q({"sessions":{"status":"ok","rows":[{"id":"s1"}]},"optional_audit":{"status":"error","message":"query timed out"},"stats":{"status":"ok","rows":[{"count":7}]}})\nJSON.parse(raw).each do |name, outcome|\n  if outcome.fetch("status") == "ok"\n    puts "OK    #{name.ljust(14)} #{outcome.fetch("rows").size} rows"\n  else\n    warn "SKIP  #{name.ljust(14)} #{outcome.fetch("message")}"\n  end\nend' },
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
  { title: 'メソッドと戻り値', description: 'デフォルト引数と戻り値を使ってあいさつを組み立てます。', category: '基本', badges: ['Method', '入門'], code: 'def greeting(name, language = "ja")\n  case language\n  when "ja" then "こんにちは、#{name}さん"\n  when "en" then "Hello, #{name}!"\n  else "Hi, #{name}!"\n  end\nend\nputs greeting("Ruby")\nputs greeting("WASM", "en")' },
  { title: 'partitionで仕分け', description: '条件に合う要素と合わない要素を1回の処理で分けます。', category: 'Enumerable', badges: ['partition', '初級'], code: 'tasks = [\n  { title: "docs", done: true },\n  { title: "tests", done: false },\n  { title: "release", done: false }\n]\ndone, pending = tasks.partition { |task| task[:done] }\nputs "done: #{done.map { |task| task[:title] }.join(", ")}"\nputs "pending: #{pending.map { |task| task[:title] }.join(", ")}"' },
  { title: 'ネストしたHashを集計', description: '入れ子のHashをdigで安全に読み、タグごとに数えます。', category: 'データ', badges: ['Hash#dig', '実践'], code: 'records = [\n  { user: { name: "Aoi" }, meta: { tag: "ruby" } },\n  { user: { name: "Ren" }, meta: { tag: "wasm" } },\n  { user: { name: "Kai" }, meta: { tag: "ruby" } }\n]\nrecords.each { |record| puts "#{record.dig(:user, :name)}: #{record.dig(:meta, :tag)}" }\nputs records.map { |record| record.dig(:meta, :tag) }.tally.sort.to_h' },
  { title: '単語のラッピング', description: '文章を指定幅に収まるよう、単語の境界で折り返します。', category: '文字列', badges: ['String', '実践'], code: 'def wrap(text, width)\n  text.split.each_with_object([""]) do |word, lines|\n    candidate = [lines.last, word].reject(&:empty?).join(" ")\n    candidate.length <= width ? lines[-1] = candidate : lines << word\n  end\nend\nwrap("Ruby runs inside WebAssembly in your browser", 16).each { |line| puts "| #{line.ljust(16)} |" }' },
  { title: '継承とsuper', description: '共通クラスの処理をsuperで再利用して表示を拡張します。', category: 'オブジェクト', badges: ['継承', '中級'], code: 'class Message\n  def initialize(text) = @text = text\n  def render = @text\nend\nclass LoudMessage < Message\n  def render = "#{super.upcase}!"\nend\nclass TaggedMessage < Message\n  def initialize(text, tag)\n    super(text)\n    @tag = tag\n  end\n  def render = "[#{@tag}] #{super}"\nend\nputs Message.new("hello").render\nputs LoudMessage.new("hello").render\nputs TaggedMessage.new("ready", "WASM").render' },
  { title: '幅優先探索', description: 'キューを使って迷路のスタートからゴールまでの最短距離を求めます。', category: 'アルゴリズム', badges: ['BFS', '中級'], code: 'graph = { A: %i[B C], B: %i[D], C: %i[D E], D: %i[F], E: %i[F], F: [] }\nqueue = [[:A, 0]]\nvisited = {}\nuntil queue.empty?\n  node, distance = queue.shift\n  next if visited[node]\n  visited[node] = distance\n  graph.fetch(node).each { |neighbor| queue << [neighbor, distance + 1] }\nend\nvisited.each { |node, distance| puts "A -> #{node}: #{distance}" }' },
  { title: 'ドット絵アニメ', description: '数学関数からターミナル風のフレームを描きます。', category: '遊ぶ', badges: ['Math', '遊ぶ'], code: 'width = 31\n3.times do |frame|\n  points = Array.new(width, " ")\n  5.times do |index|\n    x = (index * 6 + frame * 2) % width\n    points[x] = %w[● ◆ ■ ★ ▲][index]\n  end\n  puts "|#{points.join}|"\nend' },
  { title: '右代入で分解', description: '式の結果を右代入と構造分解で複数の変数に受け取ります。', category: 'Ruby 4', badges: ['右代入', '構文'], code: '100.divmod(7) => quotient, remainder\nputs "100 / 7 = #{quotient} remainder #{remainder}"\n{ name: "Ruby", runtime: "WASM" } => { name:, runtime: }\nputs "#{name} on #{runtime}"' },
  { title: 'ブロックとyield', description: 'メソッドからブロックへ値を渡し、戻り値を集めます。', category: '基本', badges: ['Block', '初級'], code: 'def transform(values)\n  values.map { |value| yield(value) }\nend\nputs transform([1, 2, 3]) { |n| n * 10 }.join(", ")\nputs transform(%w[ruby wasm]) { |word| word.upcase }.join(" / ")' },
  { title: 'lazyで必要分だけ計算', description: '無限列を遅延評価して、条件に合う最初の値だけを取り出します。', category: 'Enumerable', badges: ['lazy', '中級'], code: 'squares = (1..).lazy.map { |n| n * n }.select { |n| n.to_s.end_with?("6") }\nputs squares.first(8).join(", ")' },
  { title: 'Hashのマージルール', description: '設定Hashをmergeのブロックで合成します。', category: 'データ', badges: ['Hash#merge', '実践'], code: 'defaults = { retries: 2, tags: ["ruby"], timeout: 10 }\noverrides = { retries: 4, tags: ["wasm"], verbose: true }\nconfig = defaults.merge(overrides) do |key, old_value, new_value|\n  key == :tags ? old_value + new_value : new_value\nend\nconfig.each { |key, value| puts "#{key}: #{value.inspect}" }' },
  { title: 'Unicode文字の数え上げ', description: '文字列をコードポイント単位で調べて表示します。', category: '文字列', badges: ['Unicode', '実践'], code: 'text = "Rubyと宝石💎"\nputs "characters: #{text.length}"\ntext.each_char.with_index do |char, index|\n  puts format("%2d: %-4s U+%04X", index, char, char.ord)\nend' },
  { title: 'Comparableでバージョン比較', description: '宇宙船演算子を実装して値オブジェクトを並べ替えます。', category: 'オブジェクト', badges: ['Comparable', '中級'], code: 'Version = Struct.new(:major, :minor, :patch) do\n  include Comparable\n  def <=>(other) = to_a <=> other.to_a\n  def to_a = [major, minor, patch]\n  def to_s = to_a.join(".")\nend\nversions = [Version.new(4, 0, 0), Version.new(3, 4, 7), Version.new(3, 4, 2)]\nputs versions.sort' },
  { title: '深さ優先探索', description: '再帰を使って木構造を奥まで順にたどります。', category: 'アルゴリズム', badges: ['DFS', '中級'], code: 'tree = { root: %i[docs src], docs: %i[guide], src: %i[views tests], guide: [], views: [], tests: [] }\ndef walk(tree, node, depth = 0)\n  puts "#{"  " * depth}└─ #{node}"\n  tree.fetch(node).each { |child| walk(tree, child, depth + 1) }\nend\nwalk(tree, :root)' },
  { title: '迷路の自動生成', description: '固定シードの乱数で何度でも再現できる迷路風模様を描きます。', category: '遊ぶ', badges: ['Random', 'アート'], code: 'random = Random.new(404)\nheight = 7\nwidth = 25\nheight.times do |row|\n  line = width.times.map do |column|\n    row.zero? || row == height - 1 || column.zero? || column == width - 1 ? "#" : (random.rand < 0.32 ? "#" : " ")\n  end\n  puts line.join\nend' },
  { title: 'パターンのガード条件', description: 'case/inにif条件を加えてデータを細かく分類します。', category: 'Ruby 4', badges: ['Pattern', '構文'], code: 'orders = [{ item: "book", total: 3200 }, { item: "pen", total: 300 }, { item: "bag", total: 8500 }]\norders.each do |order|\n  case order\n  in { item:, total: } if total >= 5000\n    puts "premium: #{item}"\n  in { item:, total: 1000.. }\n    puts "standard: #{item}"\n  else\n    puts "small: #{order[:item]}"\n  end\nend' },
  { title: 'Procとlambda', description: '処理をオブジェクトとして渡し、lambdaの引数チェックも確認します。', category: '基本', badges: ['Proc', '中級'], code: 'double = ->(number) { number * 2 }\ndecorate = proc { |text| "<#{text}>" }\nputs [1, 2, 3].map(&double).join(", ")\nputs decorate.call("Ruby")\nputs "lambda?: #{double.lambda?}"' },
  { title: '可変長引数と展開', description: 'splatで任意個の引数を受け取り、配列を引数へ展開します。', category: '基本', badges: ['splat', '初級'], code: 'def average(*numbers, precision: 2)\n  numbers.sum.fdiv(numbers.size).round(precision)\nend\nvalues = [12, 18, 25, 31]\nputs average(*values)\nputs average(1, 2, 2, precision: 3)' },
  { title: 'each_with_objectで索引', description: '列挙しながらHashを組み立て、頭文字の索引を作ります。', category: 'Enumerable', badges: ['each_with_object', '実践'], code: 'words = %w[ruby rails wasm web rack]\nindex = words.each_with_object(Hash.new { |hash, key| hash[key] = [] }) do |word, result|\n  result[word[0]] << word\nend\nindex.sort.each { |letter, items| puts "#{letter}: #{items.join(", ")}" }' },
  { title: 'slice_whenで連続区間', description: '値の変化点で配列を区切り、連続する区間をまとめます。', category: 'Enumerable', badges: ['slice_when', '中級'], code: 'readings = [1, 2, 3, 9, 10, 20, 21, 22]\ngroups = readings.slice_when { |left, right| right != left + 1 }.to_a\nputs groups.map { |group| group.one? ? group.first.to_s : "#{group.first}-#{group.last}" }.join(", ")' },
  { title: '行列データの転置', description: '二次元配列をtransposeで行列入れ替えし、列ごとの合計を求めます。', category: 'データ', badges: ['Array#transpose', '集計'], code: 'table = [["Jan", 12, 8], ["Feb", 15, 11], ["Mar", 9, 14]]\nmonths, *series = table.transpose\nputs "months: #{months.join(", ")}"\nseries.each_with_index { |values, index| puts "series #{index + 1}: #{values.sum}" }' },
  { title: 'JSONイベント変換', description: 'JSONのイベント列を読み、必要なフィールドだけの新しいJSONへ変換します。', category: 'データ', badges: ['JSON', '変換'], code: 'require "json"\nsource = %q([{"type":"login","user":"Aoi"},{"type":"logout","user":"Ren"}])\nevents = JSON.parse(source, symbolize_names: true)\nsummary = events.map.with_index(1) { |event, id| { id: id, label: "#{event[:user]}:#{event[:type]}" } }\nputs JSON.pretty_generate(summary)' },
  { title: '名前付きキャプチャ', description: '正規表現の名前付きキャプチャでログの各要素を読み取ります。', category: '文字列', badges: ['Regexp', '実践'], code: 'lines = ["2026-09-26 INFO ready", "2026-09-27 ERROR timeout"]\npattern = /(?<date>\d{4}-\d{2}-\d{2}) (?<level>[A-Z]+) (?<message>.+)/\nlines.each do |line|\n  match = pattern.match(line)\n  puts "#{match[:date]} [#{match[:level]}] #{match[:message]}"\nend' },
  { title: '文字列のエスケープ', description: 'HTMLで特別な文字を安全な文字参照へ置換します。', category: '文字列', badges: ['gsub', 'Web'], code: 'HTML_ESCAPE = { "&" => "&amp;", "<" => "&lt;", ">" => "&gt;", 34.chr => "&quot;" }\ndef escape_html(text)\n  text.gsub(/[&<>"]/ , HTML_ESCAPE)\nend\nputs escape_html(%q(<ruby version="4">A&B</ruby>))' },
  { title: '委譲でプレイリスト', description: 'forwardableを使わず、必要な操作だけを内包配列へ委譲します。', category: 'オブジェクト', badges: ['委譲', '設計'], code: 'class Playlist\n  def initialize = @songs = []\n  def add(title) = (@songs << title; self)\n  def size = @songs.size\n  def each(&block) = @songs.each(&block)\nend\nlist = Playlist.new.add("Ruby").add("WASM")\nputs "#{list.size} songs"\nlist.each { |song| puts "♪ #{song}" }' },
  { title: 'メソッドの可視性', description: 'publicメソッドからprivateな補助メソッドを利用します。', category: 'オブジェクト', badges: ['private', '中級'], code: 'class TokenMasker\n  def mask(token)\n    "#{prefix(token)}#{"*" * [token.length - 4, 0].max}"\n  end\n  private\n  def prefix(token) = token[0, 4]\nend\nmasker = TokenMasker.new\nputs masker.mask("ruby-wasm-secret")\nputs "private: #{masker.private_methods.include?(:prefix)}"' },
  { title: 'マージソート', description: '分割統治で配列を安定ソートします。', category: 'アルゴリズム', badges: ['Sort', '上級'], code: 'def merge_sort(values)\n  return values if values.length < 2\n  middle = values.length / 2\n  left = merge_sort(values.take(middle))\n  right = merge_sort(values.drop(middle))\n  result = []\n  result << (left.first <= right.first ? left.shift : right.shift) until left.empty? || right.empty?\n  result + left + right\nend\nputs merge_sort([7, 2, 9, 1, 5, 2]).join(", ")' },
  { title: '動的計画法で両替', description: '必要な硬貨の最小枚数を小さい金額から計算します。', category: 'アルゴリズム', badges: ['DP', '上級'], code: 'coins = [1, 3, 4]\ntarget = 11\nbest = Array.new(target + 1, Float::INFINITY)\nbest[0] = 0\n(1..target).each do |amount|\n  coins.each { |coin| best[amount] = [best[amount], best[amount - coin] + 1].min if coin <= amount }\nend\nputs "#{target}: #{best[target]} coins"\nputs best.join(", ")' },
  { title: 'じゃんけん大会', description: '固定された手の列から総当たりの勝敗表を作ります。', category: '遊ぶ', badges: ['Hash', 'ゲーム'], code: 'beats = { rock: :scissors, scissors: :paper, paper: :rock }\nplayers = { Aoi: :rock, Ren: :scissors, Kai: :paper }\nplayers.to_a.combination(2) do |(left, left_hand), (right, right_hand)|\n  winner = left_hand == right_hand ? "draw" : (beats[left_hand] == right_hand ? left : right)\n  puts "#{left}(#{left_hand}) vs #{right}(#{right_hand}): #{winner}"\nend' },
  { title: '数当てヒント', description: '二分探索の考え方で秘密の数へ近づく過程を表示します。', category: '遊ぶ', badges: ['探索', 'ゲーム'], code: 'secret = 73\nlow = 1\nhigh = 100\nloop do\n  guess = (low + high) / 2\n  puts "guess #{guess}: #{guess == secret ? "correct" : guess < secret ? "higher" : "lower"}"\n  break if guess == secret\n  guess < secret ? low = guess + 1 : high = guess - 1\nend' },
  { title: '配列パターンの残余', description: 'restパターンで先頭と末尾以外の要素をまとめて受け取ります。', category: 'Ruby 4', badges: ['Pattern', '構文'], code: 'routes = [["Tokyo", "Kyoto"], ["Tokyo", "Nagoya", "Kyoto", "Osaka"]]\nroutes.each do |route|\n  case route\n  in [start, *stops, destination]\n    puts "#{start} -> #{destination} (stops: #{stops.join(", ")})"\n  end\nend' },
  { title: 'ハッシュパターンの別名', description: 'asパターンで分解した値と元のHashを同時に利用します。', category: 'Ruby 4', badges: ['as pattern', '構文'], code: 'responses = [{ status: 200, body: "OK" }, { status: 503, body: "busy" }]\nresponses.each do |response|\n  case response\n  in { status: 200, body: } => whole\n    puts "success #{body}: #{whole.inspect}"\n  in { status:, body: } if status >= 500\n    puts "server error #{status}: #{body}"\n  end\nend' },

  { title: 'sqlx-d1トランザクション結果', description: 'トランザクション内の複数更新結果を検証し、変更行数をまとめます。', category: 'データ', badges: ['sqlx-d1', 'transaction', '検証'], code: 'require "json"\nraw = %q({"committed":true,"results":[{"operation":"debit","rows_affected":1},{"operation":"credit","rows_affected":1}]})\ntx = JSON.parse(raw)\nraise "rollback" unless tx.fetch("committed")\ntx.fetch("results").each { |result| puts "#{result.fetch("operation")}: #{result.fetch("rows_affected")} row" }\nputs "total changes: #{tx.fetch("results").sum { |result| result.fetch("rows_affected") }}"' },
  { title: 'sqlx-d1バッチ書き込み', description: 'D1バッチ応答から成功件数と変更行数を集計します。', category: 'データ', badges: ['sqlx-d1', 'batch', '集計'], code: 'require "json"\nraw = %q([{"success":true,"meta":{"changes":2}},{"success":true,"meta":{"changes":1}},{"success":false,"error":"constraint"}])\nresults = JSON.parse(raw)\nsucceeded, failed = results.partition { |result| result.fetch("success") }\nputs "success: #{succeeded.size}"\nputs "changes: #{succeeded.sum { |result| result.dig("meta", "changes") }}"\nputs "failed: #{failed.map { |result| result.fetch("error") }.join(", ")}"' },
  { title: 'sqlx-d1楽観的ロック', description: '更新前後のバージョン値から競合の有無を判定します。', category: 'データ', badges: ['sqlx-d1', '更新', '競合制御'], code: 'responses = [\n  { id: 7, expected_version: 3, current_version: 3, changes: 1 },\n  { id: 8, expected_version: 4, current_version: 5, changes: 0 }\n]\nresponses.each do |row|\n  state = row[:changes] == 1 ? "updated to v#{row[:current_version] + 1}" : "conflict at v#{row[:current_version]}"\n  puts "##{row[:id]}: #{state}"\nend' },
  { title: 'sqlx-d1検索条件', description: '任意の検索条件をホワイトリストで正規化して表示します。', category: 'データ', badges: ['sqlx-d1', '検索', '安全性'], code: 'params = { status: "active", sort: "created_at", direction: "desc", limit: "25" }\nallowed_sorts = %w[created_at name status]\nquery = {\n  status: %w[active archived].include?(params[:status]) ? params[:status] : "active",\n  sort: allowed_sorts.include?(params[:sort]) ? params[:sort] : "created_at",\n  direction: params[:direction] == "asc" ? "ASC" : "DESC",\n  limit: [[params[:limit].to_i, 1].max, 100].min\n}\nputs query.map { |key, value| "#{key}=#{value}" }.join(" & ")' },
  { title: 'sqlx-d1日付別集計', description: '時系列のクエリ結果を日付別にまとめ、欠けた日もゼロで補います。', category: 'データ', badges: ['sqlx-d1', '時系列', '集計'], code: 'rows = [{ day: "2026-09-23", count: 8 }, { day: "2026-09-25", count: 13 }]\ndays = (23..25).map { |day| "2026-09-#{day}" }\nby_day = rows.to_h { |row| [row[:day], row[:count]] }\ndays.each { |day| puts "#{day}: #{by_day.fetch(day, 0)}" }\nputs "total: #{by_day.values.sum}"' },
  { title: 'sqlx-d1リレーション結合', description: 'JOIN済みのフラットな行を親子構造へ組み直します。', category: 'データ', badges: ['sqlx-d1', 'JOIN', '整形'], code: 'rows = [\n  { project_id: 1, project: "WASM", task: "build" },\n  { project_id: 1, project: "WASM", task: "test" },\n  { project_id: 2, project: "D1", task: "migrate" }\n]\nprojects = rows.group_by { |row| row[:project_id] }.values.map do |group|\n  { name: group.first[:project], tasks: group.map { |row| row[:task] } }\nend\nprojects.each { |project| puts "#{project[:name]}: #{project[:tasks].join(", ")}" }' },
  { title: 'Setで重複検出', description: 'Setを使って入力順を保ちながら重複値を見つけます。', category: 'データ', badges: ['Set', '重複', '実践'], code: 'require "set"\nseen = Set.new\nduplicates = %w[ruby wasm d1 ruby sqlx wasm].select { |word| !seen.add?(word) }\nputs "unique: #{seen.to_a.join(", ")}"\nputs "duplicates: #{duplicates.join(", ")}"' },
  { title: 'キューでジョブ処理', description: '配列をFIFOキューとして使い、追加ジョブも順番に処理します。', category: 'アルゴリズム', badges: ['Queue', 'FIFO', '基礎'], code: 'queue = %w[fetch parse]\ncompleted = []\nuntil queue.empty?\n  job = queue.shift\n  completed << job\n  queue << "store" if job == "parse"\n  puts "done: #{job} / waiting: #{queue.size}"\nend\nputs completed.join(" -> ")' },
  { title: '状態遷移マシン', description: '許可されたイベントだけで注文状態を遷移させます。', category: 'オブジェクト', badges: ['State', '設計', '検証'], code: 'transitions = { pending: { pay: :paid, cancel: :cancelled }, paid: { ship: :shipped }, shipped: {} }\nstate = :pending\n[:pay, :ship, :cancel].each do |event|\n  next_state = transitions.fetch(state)[event]\n  puts next_state ? "#{state} --#{event}--> #{next_state}" : "#{state}: #{event} ignored"\n  state = next_state if next_state\nend' },
  { title: '二次元配列の回転', description: 'transposeとreverseで正方行列を時計回りに回転します。', category: 'アルゴリズム', badges: ['Matrix', '配列', '変換'], code: 'matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]\nrotated = matrix.reverse.transpose\nrotated.each { |row| puts row.join(" ") }' },
  { title: 'ランレングス圧縮', description: '連続する文字をグループ化して短い表現へ圧縮します。', category: '文字列', badges: ['圧縮', 'chunk', '実践'], code: 'text = "aaabccccdd"\nencoded = text.chars.chunk(&:itself).map { |char, group| "#{char}#{group.size}" }.join\ndecoded = encoded.scan(/(.)([0-9]+)/).map { |char, count| char * count.to_i }.join\nputs "#{text} -> #{encoded}"\nputs "restored: #{decoded == text}"' },
  { title: 'LRU風キャッシュ', description: '最近使った順を更新しながら上限件数を保つ小さなキャッシュです。', category: 'オブジェクト', badges: ['Cache', 'Hash', '実践'], code: 'cache = {}\nlimit = 3\n[:a, :b, :c, :a, :d].each do |key|\n  value = cache.delete(key) || key.to_s.upcase\n  cache[key] = value\n  cache.shift while cache.size > limit\n  puts "#{key}: #{cache.keys.join(",")}"\nend' },

];

/** サンプル集を実際に一括実行した互換性確認結果 (2026-09-23)。 */
export const RUBY_SAMPLE_AUDIT_VERSIONS = [
  { key: 'ruby34', label: 'Ruby 3.4.4', environment: 'CRuby (x86_64-linux)' },
  { key: 'ruby40Wasm', label: 'Ruby 4.0系', environment: '公式 CRuby WASM (WASI)' },
] as const;

type RubySampleAuditStatus = 'ok' | 'error';

export const RUBY_SAMPLE_AUDIT_RESULTS: Readonly<Record<string, Readonly<Record<(typeof RUBY_SAMPLE_AUDIT_VERSIONS)[number]['key'], RubySampleAuditStatus>>>> =
  Object.fromEntries(RUBY_REPL_SNIPPETS.map((snippet) => [snippet.title, { ruby34: 'ok', ruby40Wasm: 'ok' }]));

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

/** 実行確認済みのRubyだけを、サンプルの互換バージョンとして表示する。 */
function renderRubyVersionBadges(snippet: RubyReplSnippet): string {
  const results = RUBY_SAMPLE_AUDIT_RESULTS[snippet.title];
  const compatibleVersions = RUBY_SAMPLE_AUDIT_VERSIONS.filter((version) => results[version.key] === 'ok');
  const ruby4Only = compatibleVersions.length === 1 && compatibleVersions[0].key === 'ruby40Wasm';
  return `<span class="ruby-version-badges" aria-label="動作確認済みRubyバージョン">${compatibleVersions.map((version) => {
    const shortLabel = version.key === 'ruby34' ? 'Ruby 3.4' : 'Ruby 4';
    return `<small class="ruby-version-badge${ruby4Only ? ' ruby4-only' : ''}">${shortLabel}</small>`;
  }).join('')}</span>`;
}

function renderRubyReplSnippets(): string {
  const categories = [...new Set(RUBY_REPL_SNIPPETS.map((item) => item.category))];
  return RUBY_REPL_SNIPPETS.map((snippet, index) => {
    const payload = JSON.stringify(snippet.code).replace(/</g, '\\u003c');
    const categoryIndex = categories.indexOf(snippet.category);
    const firstInCategory = RUBY_REPL_SNIPPETS.findIndex((item) => item.category === snippet.category) === index;
    const isLong = snippet.code.split('\n').length > 12;
    return `<article class="snippet-card${isLong ? ' snippet-card-long' : ''}" data-snippet-card="${index}" data-category-index="${categoryIndex}"${firstInCategory ? ` id="page-sample-category-${categoryIndex}"` : ''}>
      <div class="snippet-heading"><span class="snippet-category" data-category-index="${categoryIndex}">${escapeHtml(snippet.category)}</span><h3>${escapeHtml(snippet.title)}</h3>${renderRubyVersionBadges(snippet)}</div>
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
    <span class="sample-choice-copy"><strong><span class="sample-choice-title">${escapeHtml(snippet.title)}</span></strong><span>${escapeHtml(snippet.description)}</span></span>
    ${renderRubyVersionBadges(snippet)}
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

function renderRubyPageCategoryLinks(): string {
  const counts = new Map<string, number>();
  RUBY_REPL_SNIPPETS.forEach((snippet) => counts.set(snippet.category, (counts.get(snippet.category) || 0) + 1));
  const categoryButtons = [...counts].map(([category, count], index) =>
    `<button type="button" class="page-category-link" data-category-index="${index}" data-page-category-filter="${index}" aria-pressed="false"><span>${escapeHtml(category)}</span><strong>${count}</strong></button>`
  ).join('');
  return `<button type="button" class="page-category-reset" data-page-category-reset aria-label="カテゴリー選択を解除" disabled>選択解除</button>${categoryButtons}`;
}

type RubyMethodCatalogEntry = {
  method: string;
  origin: 'Enumerable' | 'その他';
  count: number;
  snippetIndexes: number[];
};

const ENUMERABLE_METHODS = new Set([
  'all?', 'any?', 'chunk', 'count', 'each_cons', 'each_entry', 'each_slice', 'each_with_index',
  'each_with_object', 'filter_map', 'find', 'flat_map', 'group_by', 'inject', 'map', 'max', 'max_by',
  'min', 'min_by', 'none?', 'one?', 'partition', 'reduce', 'reject', 'select', 'slice_when',
  'sort', 'sort_by', 'sum', 'tally', 'take', 'to_h', 'zip',
]);

/** サンプル内の明示的なレシーバー呼び出しを集計し、由来別フィルターを作る。 */
export function buildRubyMethodCatalog(): readonly RubyMethodCatalogEntry[] {
  const entries = new Map<string, { count: number; snippetIndexes: Set<number> }>();
  RUBY_REPL_SNIPPETS.forEach((snippet, snippetIndex) => {
    const matcher = /(?:\.|&:)([a-zA-Z_][a-zA-Z0-9_]*[!?=]?)/g;
    for (const match of snippet.code.matchAll(matcher)) {
      const current = entries.get(match[1]) || { count: 0, snippetIndexes: new Set<number>() };
      current.count += 1;
      current.snippetIndexes.add(snippetIndex);
      entries.set(match[1], current);
    }
  });
  return [...entries].map(([method, value]): RubyMethodCatalogEntry => ({
    method,
    origin: ENUMERABLE_METHODS.has(method) ? 'Enumerable' : 'その他',
    count: value.count,
    snippetIndexes: [...value.snippetIndexes],
  })).sort((left, right) => left.origin.localeCompare(right.origin) || left.method.localeCompare(right.method));
}

function renderRubyMethodFilter(): string {
  const catalog = buildRubyMethodCatalog();
  return ['Enumerable', 'その他'].map((origin) => {
    const rows = catalog.filter((entry) => entry.origin === origin).map((entry) =>
      `<button type="button" class="method-filter-row" data-method-filter="${escapeHtml(entry.method)}" data-method-snippets="${entry.snippetIndexes.join(',')}" aria-pressed="false"><code>${escapeHtml(entry.method)}</code><span class="method-count">${entry.count}</span></button>`
    ).join('');
    return `<section class="method-filter-group"><h3>${origin}<small>${catalog.filter((entry) => entry.origin === origin).length} methods</small></h3><div>${rows}</div></section>`;
  }).join('');
}

function renderRubySampleAuditRows(): string {
  return RUBY_REPL_SNIPPETS.map((snippet) => {
    const results = RUBY_SAMPLE_AUDIT_RESULTS[snippet.title];
    const cells = RUBY_SAMPLE_AUDIT_VERSIONS.map((version) => {
      const ok = results[version.key] === 'ok';
      return `<td><span class="audit-status ${ok ? 'ok' : 'error'}">${ok ? '✓ エラーなし' : '✕ エラー'}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${escapeHtml(snippet.title)}</th><td>${escapeHtml(snippet.category)}</td>${cells}</tr>`;
  }).join('\n');
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
    .sample-jump-bar {
      position: sticky; top: 0; z-index: 20;
      padding: 3px max(10px, calc((100vw - 1120px) / 2 + 20px));
      overflow-x: auto; overscroll-behavior-inline: contain;
      background: color-mix(in srgb, var(--card-bg) 92%, transparent);
      border-bottom: 1px solid var(--border-color);
      box-shadow: 0 4px 14px rgba(0, 0, 0, .1);
      backdrop-filter: blur(12px);
      scrollbar-width: thin;
    }
    .sample-jump-links { display: flex; justify-content: flex-end; width: max-content; min-width: 100%; gap: 4px; }
    .page-category-reset {
      flex: none; padding: 3px 8px; border: 1px solid var(--border-color); border-radius: 999px;
      background: var(--text-primary); color: var(--card-bg); font-size: 9px; font-weight: 800; cursor: pointer;
    }
    .page-category-reset:disabled { background: var(--bg-secondary); color: var(--text-muted); cursor: default; opacity: .65; }
    .page-category-link {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px;
      border: 1px solid color-mix(in srgb, var(--category-color) 35%, transparent);
      border-radius: 999px;
      background: color-mix(in srgb, var(--category-color) 18%, var(--card-bg));
      color: var(--category-color); font-size: 9px; font-weight: 800; line-height: 1.25;
      text-decoration: none; white-space: nowrap; cursor: pointer;
    }
    .page-category-link:hover, .page-category-link:focus-visible {
      background: var(--category-color); color: #fff; outline: none;
    }
    .page-category-link strong {
      min-width: 15px; padding: 0 3px; border-radius: 999px;
      background: var(--category-color); color: #fff; text-align: center;
    }
    .sample-jump-links.has-filter .page-category-link:not([aria-pressed="true"]) {
      border-color: var(--border-color); background: var(--bg-secondary); color: var(--text-muted); opacity: .55;
    }
    .sample-jump-links.has-filter .page-category-link:not([aria-pressed="true"]) strong { background: var(--text-muted); }
    .snippet-card[hidden] { display: none; }
    .page-category-link:hover strong, .page-category-link:focus-visible strong {
      background: #fff; color: var(--category-color);
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
    .top-panel-tools { display: flex; align-items: flex-start; margin: -14px 0 12px -14px; }
    .method-filter { position: relative; }
    .method-filter > summary { list-style: none; padding: 7px 10px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-secondary); font-size: 12px; font-weight: 700; cursor: pointer; }
    .method-filter > summary::-webkit-details-marker { display: none; }
    .method-filter > summary::before { content: '⌄'; margin-right: 6px; color: var(--accent-color); }
    .method-filter[open] > summary::before { content: '⌃'; }
    .method-filter-groups { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; width: min(560px, calc(100vw - 40px)); max-height: min(64vh, 620px); overflow: auto; padding: 10px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--card-bg); box-shadow: 0 12px 32px var(--card-shadow-light); }
    .method-filter-group + .method-filter-group { margin-top: 12px; }
    .method-filter-group h3 { display: flex; justify-content: space-between; padding: 4px 5px 7px; color: var(--text-primary); font-size: 12px; }
    .method-filter-group h3 small { color: var(--text-muted); font-weight: 500; }
    .method-filter-group > div { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    .method-filter-row { display: flex; align-items: center; justify-content: space-between; min-width: 0; padding: 7px 8px; border: 1px solid var(--border-color); border-radius: 7px; background: var(--bg-secondary); color: var(--text-secondary); cursor: pointer; }
    .method-filter-row code { overflow: hidden; text-overflow: ellipsis; color: inherit; }
    .method-filter-row[aria-pressed="true"] { border-color: var(--accent-color); background: var(--accent-color); color: #fff; }
    .method-count { min-width: 20px; margin-left: 6px; padding: 1px 5px; border-radius: 999px; background: var(--card-bg); color: var(--text-muted); font-size: 10px; font-weight: 800; text-align: center; }
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
      min-height: clamp(180px, 30vh, 360px);
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
      width: min(720px, 94vw); max-height: 92dvh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    }
    .modal-box h2 {
      font-size: 16px; margin: 0 0 14px; color: var(--text-primary);
      display: flex; justify-content: space-between; align-items: center;
    }
    .modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); }
    .sample-modal-box { width: min(880px, 94vw); }
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
    .sample-detail-box { position: relative; width: min(960px, 96vw); padding-top: 46px; }
    .sample-detail-corner-close { position: absolute; top: 12px; right: 14px; }
    .sample-detail-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; }
    .sample-detail-heading h2 { margin: 0; }
    .sample-detail-description { margin: 0 0 12px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
    .sample-detail-code-wrap { position: relative; }
    .sample-detail-code { max-height: min(58dvh, 680px); margin: 0; padding: 14px; padding-right: 88px; overflow: auto; border: 1px solid var(--border-color); border-radius: 9px; background: #172033; color: #e7edf7; font: 12px/1.55 'Monaco', 'Courier New', monospace; tab-size: 2; }
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
    .snippet-card { min-width: 0; scroll-margin-top: 64px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 14px; padding: 18px; box-shadow: 0 5px 18px rgba(0, 0, 0, .08); }
    .snippet-heading { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
    .snippet-heading h3 { color: var(--text-primary); font-size: 16px; }
    .snippet-category { flex: none; padding: 3px 7px; border-radius: 999px; background: color-mix(in srgb, var(--category-color) 18%, var(--bg-secondary)); color: var(--category-color); font-size: 10px; font-weight: 700; }
    .ruby-version-badges { display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin-left: auto; }
    .ruby-version-badge { padding: 2px 6px; border: 1px solid #86efac; border-radius: 999px; background: #dcfce7; color: #166534; font-size: 9px; font-weight: 800; white-space: nowrap; }
    .ruby-version-badge.ruby4-only { border-color: #93c5fd; background: #dbeafe; color: #1d4ed8; }
    .snippet-card-long { grid-column: 1 / -1; }
    .snippet-card > p { min-height: 38px; color: var(--text-muted); font-size: 12px; line-height: 1.55; }
    .snippet-badges { display: flex; flex-wrap: wrap; gap: 5px; min-height: 19px; margin-top: 7px; }
    .snippet-badges span { padding: 2px 6px; border-radius: 999px; background: var(--bg-secondary); color: var(--text-muted); font-size: 9px; font-weight: 700; }
    .snippet-code-wrap { position: relative; margin: 10px 0 7px; }
    .snippet-card pre { min-height: 180px; max-height: min(52vh, 620px); margin: 0; padding: 14px; overflow: auto; border: 1px solid var(--border-color); border-radius: 9px; background: #172033; color: #e7edf7; font: 12px/1.55 'Monaco', 'Courier New', monospace; tab-size: 2; }
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
    .snippet-output { display: block; max-height: min(42vh, 480px); overflow: auto; padding: 12px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.55 'Monaco', 'Courier New', monospace; }
    .snippet-output.error { color: #991b1b; border-color: #ef4444; }
    .audit-section { margin-top: 32px; }
    .audit-summary { color: var(--text-muted); font-size: 13px; line-height: 1.6; }
    .audit-table-wrap { margin-top: 14px; overflow-x: auto; border: 1px solid var(--border-color); border-radius: 12px; }
    .audit-table { width: 100%; border-collapse: collapse; background: var(--card-bg); font-size: 12px; }
    .audit-table th, .audit-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: left; white-space: nowrap; }
    .audit-table thead th { background: var(--bg-secondary); color: var(--text-primary); }
    .audit-table tbody th { color: var(--text-primary); font-weight: 600; }
    .audit-table tbody tr:last-child th, .audit-table tbody tr:last-child td { border-bottom: 0; }
    .audit-status { display: inline-block; padding: 3px 7px; border-radius: 999px; font-weight: 700; }
    .audit-status.ok { background: #dcfce7; color: #166534; }
    .audit-status.error { background: #fee2e2; color: #991b1b; }
    @media (max-width: 760px) {
      .navbar { padding: 13px 16px; }
      .user-name { display: none; }
      .card { padding: 22px 18px; }
      .snippet-grid { grid-template-columns: 1fr; }
      .modal-box { width: 96vw; max-height: 94dvh; padding: 18px; }
      .sample-detail-code { max-height: 54dvh; }
      .snippet-card pre { min-height: 220px; max-height: 62vh; }
      .snippet-card > p { min-height: 0; }
      .method-filter-group > div { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

  <nav class="sample-jump-bar" aria-label="サンプルカテゴリーへジャンプ">
    <div class="sample-jump-links">${renderRubyPageCategoryLinks()}</div>
  </nav>

  <div class="container">
    <div class="card">
      <div class="top-panel-tools"><details class="method-filter" id="methodFilterDetails"><summary>メソッドから絞り込む</summary><div class="method-filter-groups">${renderRubyMethodFilter()}</div></details></div>
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

    <section class="audit-section" aria-labelledby="sampleAuditTitle">
      <div class="snippet-section-header">
        <h2 id="sampleAuditTitle">全サンプルのRubyバージョン別実行結果</h2>
        <p class="audit-summary">2026年9月23日に上記 ${RUBY_REPL_SNIPPETS.length} 本を各環境で実行し、例外終了の有無を確認しました。✓ は終了ステータスが正常で、未処理の例外がなかったことを示します。</p>
      </div>
      <div class="audit-table-wrap">
        <table class="audit-table">
          <thead><tr><th scope="col">サンプル</th><th scope="col">カテゴリー</th>${RUBY_SAMPLE_AUDIT_VERSIONS.map((version) => `<th scope="col">${escapeHtml(version.label)}<br><small>${escapeHtml(version.environment)}</small></th>`).join('')}</tr></thead>
          <tbody>${renderRubySampleAuditRows()}</tbody>
        </table>
      </div>
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
      <div class="sample-detail-heading"><button type="button" class="sample-load-button" id="sampleLoadBtn" aria-label="REPLにコピーしてサンプル選択を閉じる">▲</button><span class="snippet-category" id="sampleDetailCategory"></span><h2 id="sampleDetailTitle"></h2><span class="ruby-version-badges" id="sampleDetailVersions" aria-label="動作確認済みRubyバージョン"></span></div>
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
    var pendingQueryBuilderCode = '';

    function queryBuilderRubyCode(json) {
      var bytes = new TextEncoder().encode(json);
      var binary = '';
      for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      var encoded = btoa(binary);
      return 'require "json"' + String.fromCharCode(10) +
        'require "base64"' + String.fromCharCode(10) +
        'rows = JSON.parse(Base64.decode64("' + encoded + '"))' + String.fromCharCode(10) +
        'puts "Ruby/WASMでJSONを読み込みました"' + String.fromCharCode(10) +
        'puts "型: #{rows.class}"' + String.fromCharCode(10) +
        'puts "件数: #{rows.respond_to?(:length) ? rows.length : 1}"' + String.fromCharCode(10) +
        'if rows.is_a?(Array) && rows.first.is_a?(Hash)' + String.fromCharCode(10) +
        '  puts "カラム: #{rows.flat_map(&:keys).uniq.join(", ")}"' + String.fromCharCode(10) +
        'end';
    }

    // Query Builderからの明示的な遷移時だけ一回限りのデータを受け取る。
    // JSON本体はURLへ載せず、同一タブのsessionStorage経由で渡す。
    try {
      if (new URLSearchParams(window.location.search).get('source') === 'query-builder') {
        var importedJson = sessionStorage.getItem('queryBuilderRubyJson');
        if (importedJson) {
          JSON.parse(importedJson);
          pendingQueryBuilderCode = queryBuilderRubyCode(importedJson);
          inputCode.value = pendingQueryBuilderCode;
          saveNote.textContent = 'Query BuilderのJSONを受け取りました。Ruby/WASMの読み込み完了後に自動解析します。';
          sessionStorage.removeItem('queryBuilderRubyJson');
        }
      }
    } catch (err) {
      saveNote.textContent = 'Query BuilderのJSONを読み込めませんでした: ' + (err && err.message ? err.message : String(err));
    }

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

    // 出力は任意文字列なので、必ずtextContentでエスケープしてからRuby風の
    // トークンだけをspanへ変換する。HTMLを直接信頼しない。
    function highlightRubyText(source) {
      var keywords = ['begin', 'case', 'class', 'def', 'do', 'else', 'elsif', 'end', 'ensure', 'if', 'raise', 'require', 'rescue', 'return', 'then', 'unless', 'until', 'when', 'while', 'yield'];
      var literals = ['true', 'false', 'nil'];
      var escaped = document.createElement('div');
      escaped.textContent = String(source);
      var text = escaped.innerHTML;
      var result = '';
      var index = 0;
      function span(kind, value) { return '<span class="ruby-' + kind + '">' + value + '</span>'; }
      function isWord(char) { return !!char && ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char === '_'); }
      while (index < text.length) {
        var char = text.charAt(index);
        if (char === '#') {
          var commentEnd = text.indexOf(String.fromCharCode(10), index);
          if (commentEnd < 0) commentEnd = text.length;
          result += span('comment', text.slice(index, commentEnd));
          index = commentEnd;
        } else if (char === '&' && (text.slice(index, index + 6) === '&quot;' || text.slice(index, index + 5) === '&#39;')) {
          var entity = text.slice(index, index + 6) === '&quot;' ? '&quot;' : '&#39;';
          var stringEnd = text.indexOf(entity, index + entity.length);
          if (stringEnd < 0) stringEnd = text.length - entity.length;
          stringEnd += entity.length;
          result += span('string', text.slice(index, stringEnd));
          index = stringEnd;
        } else if (char >= '0' && char <= '9') {
          var numberEnd = index + 1;
          while (numberEnd < text.length && ((text.charAt(numberEnd) >= '0' && text.charAt(numberEnd) <= '9') || text.charAt(numberEnd) === '.')) numberEnd += 1;
          result += span('number', text.slice(index, numberEnd));
          index = numberEnd;
        } else if (isWord(char) && !(char >= '0' && char <= '9')) {
          var wordEnd = index + 1;
          while (wordEnd < text.length && isWord(text.charAt(wordEnd))) wordEnd += 1;
          var word = text.slice(index, wordEnd);
          result += keywords.indexOf(word) >= 0 ? span('keyword', word) : literals.indexOf(word) >= 0 ? span('literal', word) : word;
          index = wordEnd;
        } else {
          result += char;
          index += 1;
        }
      }
      return result;
    }
    function highlightRubyOutput(target, source) {
      target.innerHTML = highlightRubyText(source);
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
      highlightRubyOutput(resultValue, result.output);
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
    var sampleDetailVersions = document.getElementById('sampleDetailVersions');
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
        if (pendingQueryBuilderCode) {
          var importedResult = runRubyCode(pendingQueryBuilderCode);
          resultBlock.style.display = 'block';
          resultValue.classList.toggle('error', !importedResult.ok);
          highlightRubyOutput(resultValue, importedResult.output);
          saveNote.textContent = importedResult.ok
            ? 'Query BuilderのJSONをRuby/WASMで解析しました。'
            : 'Query BuilderのJSON解析に失敗しました。';
          pendingQueryBuilderCode = '';
        }
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
        highlightRubyOutput(output, result.output);
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

    // トップバナーはジャンプではなく、同じ色のカテゴリーだけを出力するフィルター。
    // 選択中のバッジを再度押すと全件表示に戻る。
    var pageCategoryLinks = document.querySelector('.sample-jump-links');
    var pageCategoryReset = document.querySelector('[data-page-category-reset]');
    var methodFilterDetails = document.getElementById('methodFilterDetails');
    function resetMethodFilter() {
      document.querySelectorAll('[data-method-filter]').forEach(function(button) { button.setAttribute('aria-pressed', 'false'); });
      document.querySelectorAll('.snippet-card[data-snippet-card]').forEach(function(card) { card.hidden = false; });
    }
    methodFilterDetails.addEventListener('toggle', function() {
      if (!methodFilterDetails.open) resetMethodFilter();
    });
    document.querySelectorAll('[data-method-filter]').forEach(function(button) {
      button.addEventListener('click', function() {
        var willSelect = button.getAttribute('aria-pressed') !== 'true';
        resetPageCategoryFilter();
        document.querySelectorAll('[data-method-filter]').forEach(function(other) {
          other.setAttribute('aria-pressed', String(willSelect && other === button));
        });
        var allowed = willSelect ? button.getAttribute('data-method-snippets').split(',') : [];
        document.querySelectorAll('.snippet-card[data-snippet-card]').forEach(function(card) {
          if (willSelect) card.hidden = allowed.indexOf(card.getAttribute('data-snippet-card')) === -1;
          else card.hidden = false;
        });
        if (willSelect) document.getElementById('snippetTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    function resetPageCategoryFilter() {
      document.querySelectorAll('[data-page-category-filter]').forEach(function(button) {
        button.setAttribute('aria-pressed', 'false');
      });
      if (pageCategoryLinks) pageCategoryLinks.classList.remove('has-filter');
      document.querySelectorAll('.snippet-card[data-category-index]').forEach(function(card) { card.hidden = false; });
      if (pageCategoryReset) pageCategoryReset.disabled = true;
    }
    if (pageCategoryReset) pageCategoryReset.addEventListener('click', resetPageCategoryFilter);
    document.querySelectorAll('[data-page-category-filter]').forEach(function(button) {
      button.addEventListener('click', function() {
        resetMethodFilter();
        var categoryIndex = button.getAttribute('data-page-category-filter');
        var willSelect = button.getAttribute('aria-pressed') !== 'true';
        document.querySelectorAll('[data-page-category-filter]').forEach(function(other) {
          other.setAttribute('aria-pressed', String(willSelect && other === button));
        });
        if (pageCategoryLinks) pageCategoryLinks.classList.toggle('has-filter', willSelect);
        if (pageCategoryReset) pageCategoryReset.disabled = !willSelect;
        document.querySelectorAll('.snippet-card[data-category-index]').forEach(function(card) {
          card.hidden = willSelect && card.getAttribute('data-category-index') !== categoryIndex;
        });
        if (willSelect) document.getElementById('snippetTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        sampleDetailVersions.innerHTML = button.querySelector('.ruby-version-badges').innerHTML;
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
      highlightRubyOutput(sampleDetailResult, result.output);
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
      highlightRubyOutput(modalResultValue, result.output);
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
