const status = document.querySelector('#status');
const button = document.querySelector('#run');
const input = document.querySelector('#value');
const validation = document.querySelector('#validation');
try {
  const response = await fetch(new URL('./never.wasm', import.meta.url));
  if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const { count_ones_total, count_via_infallible, half_even_or_trap } = instance.exports;
  function run() {
    const value = input.valueAsNumber;
    if (!input.value.trim() || !Number.isInteger(value) || value < 0 || value > 4294967295) {
      validation.textContent = '0〜4294967295の整数を入力してください。';
      for (const id of ['total', 'alias', 'trap']) document.getElementById(id).textContent = '—';
      return;
    }
    validation.textContent = '';
    document.querySelector('#total').textContent = `Ok(${count_ones_total(value)}) — 1のビット数`;
    document.querySelector('#alias').textContent = `Ok(${count_via_infallible(value)}) — ①と同じ結果`;
    const result = document.querySelector('#trap');
    result.dataset.trapped = 'false';
    try {
      result.textContent = `通常終了 → ${half_even_or_trap(value)}`;
    } catch (error) {
      if (!(error instanceof WebAssembly.RuntimeError)) throw error;
      result.dataset.trapped = 'true';
      result.textContent = 'trapを捕捉 → Rustの呼び出し元へは戻りません';
    }
  }
  button.disabled = false;
  status.textContent = 'WASM準備完了 · Rust 1.100.0';
  button.addEventListener('click', run);
  input.addEventListener('keydown', event => { if (event.key === 'Enter') run(); });
  run();
} catch (error) {
  status.textContent = `WASMを起動できませんでした: ${error.message}`;
}
