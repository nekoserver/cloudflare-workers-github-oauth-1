const fs=require('node:fs');
const esbuild=require('/opt/node22/lib/node_modules/wrangler/node_modules/esbuild');
const root='/tmp/rust-wasm-smoke-20261113';
const names=['dig','factor','gh','jev','ls','msb','sha256','sqlx','tree'];
const lines=[`import {checks} from '/tmp/rust-wasm-smoke-cases-20261113.mjs';`];
for(const name of names)lines.push(`import * as ${name} from './${name}.mjs';import ${name}Wasm from './${name}_bg.wasm';`);
lines.push(`export default {fetch(){const passed=[];`);
for(const name of names)lines.push(`${name}.initSync({module:${name}Wasm});checks.${name}(${name});passed.push('${name}');`);
lines.push(`return Response.json({passed})}};`);
fs.writeFileSync(root+'/entry.mjs',lines.join('\n'));
esbuild.buildSync({entryPoints:[root+'/entry.mjs'],bundle:true,format:'esm',target:'es2022',external:['*.wasm'],outfile:root+'/bundle.mjs'});
fs.writeFileSync(root+'/config.capnp',`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [(name = "main", worker = (compatibilityDate = "2024-11-17", modules = [
 (name = "bundle.mjs", esModule = embed "bundle.mjs"),
 ${names.map(n=>`(name = "${n}_bg.wasm", wasm = embed "${n}_bg.wasm")`).join(',\n')}
 ]))],
 sockets = [(name = "http", address = "127.0.0.1:18777", http = (), service = "main")]
);
`);
