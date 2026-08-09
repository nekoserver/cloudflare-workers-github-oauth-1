/**
 * Fetch API のレスポンスボディをテキストストリームとして逐次読み取るサンプル。
 *
 * `Response` は `textStream()` という専用メソッドを持たないため、
 * `response.body`(ReadableStream<Uint8Array>) を
 * `TextDecoderStream` にパイプして文字列チャンクのストリームに変換する。
 * これが標準 Fetch API における「textStream 相当」の実装パターン。
 */

export async function fetchAsTextStream(
  url: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const response = await fetch(url);

  if (!response.body) {
    throw new Error("レスポンスボディが空です");
  }

  const textStream = response.body.pipeThrough(new TextDecoderStream());
  const reader = textStream.getReader();

  let fullText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullText += value;
    onChunk(value);
  }

  return fullText;
}

// 実行例（Cloudflare Workers / Node.js どちらでも動作する）
async function main() {
  const url = "https://example.com/";

  console.log(`Fetching ${url} as a text stream...`);

  const fullText = await fetchAsTextStream(url, (chunk) => {
    console.log("--- chunk received ---");
    console.log(chunk);
  });

  console.log("--- 全文の長さ ---");
  console.log(fullText.length);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
