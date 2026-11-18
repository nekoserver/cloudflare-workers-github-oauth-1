const ok=(condition)=>{if(!condition)throw Error('WASM export result mismatch')};
export const checks={
 dig:m=>ok(m.dig_build_query('example.com','A').length>12),
 factor:m=>{ok(m.factor(12)==='12: 2 2 3');ok(m.is_prime(17)===true)},
 gh:m=>ok(m.validate_repo('owner/repo')==='owner/repo'),
 jev:m=>ok(JSON.parse(m.compute_jev_evaluation_plan('[]','[]'))),
 ls:m=>ok(m.ls_format('b\t-\t1\t2026-11-13\na\t-\t2\t2026-11-13',false,false)==='a\nb'),
 msb:m=>ok(m.msb_help('').length>0),
 sha256:m=>ok(m.sha256_hex('abc')==='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'),
 sqlx:m=>{const r=JSON.parse(m.sqlx_build_insert(JSON.stringify({table:'items',columns:['id'],rows:[[1]]})));ok(r.sql.includes('INSERT INTO'));ok(JSON.stringify(r.arguments)==='[1]');},
 tree:m=>ok(m.tree_format('foo\tblob','root',5).includes('foo')),
};
