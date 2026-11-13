use std::alloc::Global;

/// Allocate a vector and its owning box explicitly with Rust 1.100's stable
/// allocator API, then return a checksum so the allocation cannot be optimized
/// away. The browser receives only a u32; no allocator crosses the WASM ABI.
#[unsafe(no_mangle)]
pub extern "C" fn allocator_api_checksum(count: u32) -> u32 {
    let mut values = Vec::new_in(Global);
    for value in 0..count.min(4096) {
        values.push(value.wrapping_mul(3).wrapping_add(1));
    }
    let boxed = Box::new_in(values, Global);
    boxed.iter().fold(0u32, |sum, value| sum.wrapping_add(*value))
}

/// Report the element count produced by the same explicitly allocated vector.
#[unsafe(no_mangle)]
pub extern "C" fn allocator_api_len(count: u32) -> u32 {
    let mut values = Vec::new_in(Global);
    values.extend(0..count.min(4096));
    Box::new_in(values, Global).len() as u32
}
