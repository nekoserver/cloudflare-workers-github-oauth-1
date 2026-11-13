# Rust 1.100 Allocator API WASM sample

The static browser demo is `public/rust-allocator-sample/`. It calls a real WebAssembly module and requires no Worker endpoint, authentication, or JS dependency.

The Rust code explicitly constructs `Vec::new_in(Global)` and `Box::new_in(values, Global)`, pushes a bounded number of values, and returns a checksum. The browser ABI contains only `u32` values; the allocator does not cross the WASM boundary. This demonstrates choosing an allocator through the stable API without claiming to provide a custom heap implementation.

Build with Rust 1.100.0 and `wasm32-unknown-unknown` installed:

```sh
./scripts/build-allocator-api-wasm.sh
python3 -m http.server 8000 --directory public
```

Open `http://localhost:8000/rust-allocator-sample/`. The build script checks the exact compiler version and writes the WASM plus a copy of the source shown by the page.

Official release notes: https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/
