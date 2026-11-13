# Rust 1.100 stabilized APIs browser sample

Static browser playground at `public/rust-1.100-apis/`. It demonstrates stable APIs callable on `wasm32-unknown-unknown`:

- `Vec::from_fn` and `Vec<T> == Cow<[T]>`
- `bool::toggle`
- `str::trim_prefix` and `str::trim_suffix`
- `core::mem::DropGuard::new` and `dismiss`
- `std::mem::conjure_zst` for an inhabited ZST with no invariants

The Rust code uses no external crates. Build with Rust 1.100.0 and the WASM target using `./scripts/build-rust-1.100-apis-wasm.sh`, then serve `public` with any static HTTP server. The browser page and WASM do all computation locally.

`conjure_zst` is unsafe by contract. This example only conjures `Marker`, an inhabited zero-sized type with no safety invariants; never use this pattern for uninhabited types or invariant-bearing tokens.

Official release notes: https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/
