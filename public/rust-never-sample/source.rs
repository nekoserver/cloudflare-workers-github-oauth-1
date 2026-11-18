//! Rust 1.100: dependency-free browser WASM demonstrating the never type.
#![no_std]

use core::convert::Infallible;

#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    stop()
}

/// A synchronous WASM trap returns control to the JS caller as RuntimeError.
/// It never returns a Rust value. No busy loop or unsafe code is needed.
fn stop() -> ! {
    core::arch::wasm32::unreachable()
}

fn population(value: u32) -> Result<u32, !> {
    Ok(value.count_ones())
}

/// Err cannot contain a value: ! has no inhabitants.
#[unsafe(no_mangle)]
pub extern "C" fn count_ones_total(value: u32) -> u32 {
    match population(value) {
        Ok(count) => count,
        Err(never) => never,
    }
}

/// Rust 1.100 makes Infallible an alias for !; this assignment verifies it.
#[unsafe(no_mangle)]
pub extern "C" fn count_via_infallible(value: u32) -> u32 {
    let result: Result<u32, Infallible> = population(value);
    match result {
        Ok(count) => count,
        Err(never) => never,
    }
}

/// On an odd input, ! coerces to the u32 expected by the if expression.
#[unsafe(no_mangle)]
pub extern "C" fn half_even_or_trap(value: u32) -> u32 {
    if value.is_multiple_of(2) { value / 2 } else { stop() }
}
