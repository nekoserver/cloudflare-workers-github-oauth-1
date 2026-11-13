from pathlib import Path
import tomllib,subprocess,json
base=Path('/root/cloudflare-workers-github-oauth-1');art=base/'artifacts/rust-1.100-20261113'
out=Path('/tmp/rust-wasm-smoke-20261113');out.mkdir(exist_ok=True)
records=[]
for manifest in sorted((base/'wasm').glob('*/Cargo.toml')):
 name=manifest.parent.name.removesuffix('-wasm')
 lock=tomllib.loads(manifest.with_name('Cargo.lock').read_text())
 version=next(x['version'] for x in lock['package'] if x['name']=='wasm-bindgen')
 wasm=Path('/tmp/rust-compat-target-20261113/wasm32-unknown-unknown/release')/(manifest.parent.name.replace('-','_')+'.wasm')
 if not wasm.exists():raise SystemExit('Build not yet complete: '+name)
 cli=Path('/opt/rust-compat-20261113/bindgen')/version/'wasm-bindgen'
 result=subprocess.run([str(cli),'--target','web','--out-dir',str(out),'--out-name',name,str(wasm)],capture_output=True,text=True)
 records.append({'crate':manifest.parent.name,'bindgen':version,'exit':result.returncode})
 if result.returncode:raise RuntimeError(result.stderr)
 (out/(name+'.mjs')).write_text((out/(name+'.js')).read_text())
(art/'bindgen-results.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps(records))
