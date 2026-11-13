use std::borrow::Cow;
use std::mem::{conjure_zst, DropGuard};

#[unsafe(no_mangle)]
pub extern "C" fn api_vec_from_fn(seed: u32, length: u32) -> u32 {
    let length = length.min(64) as usize;
    let values = Vec::from_fn(length, |index| seed.wrapping_add(index as u32));
    let expected: Vec<u32> = (0..length).map(|i| seed.wrapping_add(i as u32)).collect();
    let borrowed: Cow<'_, [u32]> = Cow::Borrowed(&expected);
    u32::from(values == borrowed)
}

#[unsafe(no_mangle)]
pub extern "C" fn api_bool_toggle(initial: u32, times: u32) -> u32 {
    let mut enabled = initial != 0;
    for _ in 0..times.min(100) {
        enabled.toggle();
    }
    u32::from(enabled)
}

#[unsafe(no_mangle)]
pub extern "C" fn api_trim_demo() -> u32 {
    let text = "rust:1.100:wasm";
    let without_prefix = text.trim_prefix("rust:");
    let without_suffix = without_prefix.trim_suffix(":wasm");
    without_suffix.len() as u32
}

#[unsafe(no_mangle)]
pub extern "C" fn api_drop_guard(value: u32, dismiss: u32) -> u32 {
    let mut outcome = 0;
    {
        let guard = DropGuard::new(value, |owned| outcome = owned);
        if dismiss != 0 {
            let returned = DropGuard::dismiss(guard);
            return returned;
        }
    }
    outcome
}

struct Marker;

#[unsafe(no_mangle)]
pub extern "C" fn api_conjure_zst() -> u32 {
    // SAFETY: Marker is an inhabited zero-sized type with no invariants.
    let marker: Marker = unsafe { conjure_zst() };
    std::mem::size_of_val(&marker) as u32
}
