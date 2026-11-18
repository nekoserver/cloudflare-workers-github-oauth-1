const status = document.querySelector('#status');
const button = document.querySelector('#run');
const countInput = document.querySelector('#count');
const error = document.querySelector('#error');
try {
  const response = await fetch(new URL('./allocator.wasm', import.meta.url));
  if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const { allocator_api_checksum, allocator_api_len } = instance.exports;
  function run() {
    const count = countInput.valueAsNumber;
    if (!countInput.value.trim() || !Number.isInteger(count) || count < 0 || count > 4096) {
      error.textContent = '0〜4096の整数を入力してください。';
      return;
    }
    error.textContent = '';
    document.querySelector('#checksum').textContent = allocator_api_checksum(count);
    document.querySelector('#length').textContent = allocator_api_len(count);
    const blocks = document.querySelector('#blocks');
    blocks.replaceChildren(...Array.from({ length: Math.min(count, 64) }, (_, i) => {
      const item = document.createElement('span');
      item.className = 'block';
      item.title = `要素 ${i}`;
      return item;
    }));
  }
  button.disabled = false;
  status.textContent = 'WASM準備完了 · Rust 1.100.0';
  button.addEventListener('click', run);
  countInput.addEventListener('keydown', event => { if (event.key === 'Enter') run(); });
  run();
} catch (cause) {
  status.textContent = `WASMを起動できませんでした: ${cause.message}`;
}
