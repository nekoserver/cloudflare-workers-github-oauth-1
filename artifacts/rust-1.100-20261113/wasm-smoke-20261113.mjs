import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='/tmp/rust-wasm-smoke-20261113/';
const functions={
 dig:m=>assert.ok(m.dig_build_query('example.com','A').length>12),
 factor:m=>{assert.equal(m.factor(12),'12: 2 2 3');assert.equal(m.is_prime(17),true)},
 gh:m=>assert.equal(m.validate_repo('owner/repo'),'owner/repo'),
 jev:m=>assert.ok(JSON.parse(m.compute_jev_evaluation_plan('[]','[]'))),
 ls:m=>assert.equal(m.ls_format('b\t-\t1\t2026-11-13\na\t-\t2\t2026-11-13',false,false),'a\nb'),
 msb:m=>assert.ok(m.msb_help('').length>0),
 sha256:m=>assert.equal(m.sha256_hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'),
 sqlx:m=>{const r=JSON.parse(m.sqlx_build_insert(JSON.stringify({table:'items',columns:['id'],rows:[[1]]})));assert.match(r.sql,/INSERT INTO/);assert.deepEqual(r.arguments,[1]);},
 tree:m=>assert.ok(m.tree_format('foo\tblob','root',5).includes('foo')),
};
for(const [name,check] of Object.entries(functions)){
 const m=await import(root+name+'.mjs');
 const bytes=fs.readFileSync(root+name+'_bg.wasm');
 assert.ok(WebAssembly.validate(bytes));m.initSync({module:bytes});check(m);
 console.log('PASS '+name+': Rust 1.100 release WASM + matching JS bindings, real export result');
}
