use wasm_bindgen::prelude::*;

const MAX_SAFE_INTEGER: f64 = 9007199254740992.0; // 2^53

/// 試し割り法(2,3,5-wheel)で素因数分解する。GNU coreutilsのfactorと同じ
/// 「重複あり・昇順」の素因数リストを返す。0/1は空リストを返す。
fn factor_u64(mut n: u64) -> Vec<u64> {
    let mut factors = Vec::new();
    if n < 2 {
        return factors;
    }
    for p in [2u64, 3, 5] {
        while n % p == 0 {
            factors.push(p);
            n /= p;
        }
    }
    // mod 30 wheel: 7から始めて合成数になり得ない候補だけを試す
    let increments = [4u64, 2, 4, 2, 4, 6, 2, 6];
    let mut i: u64 = 7;
    let mut idx = 0;
    while i.saturating_mul(i) <= n {
        while n % i == 0 {
            factors.push(i);
            n /= i;
        }
        i += increments[idx];
        idx = (idx + 1) % increments.len();
    }
    if n > 1 {
        factors.push(n);
    }
    factors
}

/// GNU coreutilsのfactorコマンドと同じ書式("n: p1 p2 p3 ...")で
/// 素因数分解結果を返す。入力は0以上2^53以下の整数のみ許可する
/// (JSのNumberで安全に扱える範囲に限定)。
#[wasm_bindgen]
pub fn factor(n: f64) -> Result<String, JsValue> {
    if n.fract() != 0.0 || n < 0.0 || n > MAX_SAFE_INTEGER {
        return Err(JsValue::from_str(
            "nは0以上2^53(9007199254740992)以下の整数である必要があります",
        ));
    }
    let n_u64 = n as u64;
    let factors = factor_u64(n_u64);
    let mut s = format!("{}:", n_u64);
    for f in factors {
        s.push(' ');
        s.push_str(&f.to_string());
    }
    Ok(s)
}

/// nが素数かどうかを判定する。入力の許容範囲はfactorと同じ。
#[wasm_bindgen]
pub fn is_prime(n: f64) -> Result<bool, JsValue> {
    if n.fract() != 0.0 || n < 0.0 || n > MAX_SAFE_INTEGER {
        return Err(JsValue::from_str(
            "nは0以上2^53(9007199254740992)以下の整数である必要があります",
        ));
    }
    let n_u64 = n as u64;
    if n_u64 < 2 {
        return Ok(false);
    }
    Ok(factor_u64(n_u64).len() == 1)
}
