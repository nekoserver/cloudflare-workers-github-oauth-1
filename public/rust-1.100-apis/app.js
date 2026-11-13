const $ = selector => document.querySelector(selector);
const status = $('#status');
const run = $('#run');
try {
  const response = await fetch(new URL('./apis.wasm', import.meta.url));
  if (!response.ok) throw new Error(`WASM HTTP ${response.status}`);
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer());
  const api = instance.exports;
  const get = selector => Number($(selector).value);
  function calculate() {
    const seed = get('#seed'), length = get('#length'), toggles = get('#toggles');
    if (![seed, length, toggles].every(Number.isInteger) || seed < 0 || seed > 0xffffffff || length < 0 || length > 64 || toggles < 0 || toggles > 100) {
      status.textContent = '開始値はu32、要素数は0〜64、回数は0〜100の整数で入力してください。'; return;
    }
    status.textContent = 'WASM準備完了 · Rust 1.100.0';
    $('#vec-result').textContent = `${api.api_vec_from_fn(seed, length) ? '一致' : '不一致'} · ${api.api_vec_from_fn(seed, length) ? length : '—'}個生成`;
    $('#bool-result').textContent = `初期値 ${seed !== 0} → ${Boolean(api.api_bool_toggle(seed, toggles))} (${toggles}回)`;
    $('#trim-result').textContent = `${api.api_trim_demo()} bytes · "1.100"`;
  }
  run.disabled = false;
  run.addEventListener('click', calculate);
  for (const input of ['#seed', '#length', '#toggles']) $(input).addEventListener('input', calculate);
  $('#drop').addEventListener('click', () => { $('#guard-result').textContent = `DropGuardのクロージャが値 ${api.api_drop_guard(get('#seed') >>> 0, 0)} を受け取りました`; });
  $('#dismiss').addEventListener('click', () => { $('#guard-result').textContent = `dismissが値 ${api.api_drop_guard(get('#seed') >>> 0, 1)} を返しました (クロージャ未実行)`; });
  $('#conjure').addEventListener('click', () => { $('#zst-result').textContent = `Markerを生成 · ${api.api_conjure_zst()} bytes`; });
  calculate();
} catch (error) { status.textContent = `WASMを起動できませんでした: ${error.message}`; }
