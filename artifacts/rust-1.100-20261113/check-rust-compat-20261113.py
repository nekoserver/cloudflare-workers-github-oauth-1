import os,subprocess,json,time,hashlib
from pathlib import Path
base=Path('/root/cloudflare-workers-github-oauth-1');art=base/'artifacts/rust-1.100-20261113'
env={k:v for k,v in os.environ.items() if k in ['PATH','HOME','LANG','SSL_CERT_FILE','SSL_CERT_DIR']}
env.update(RUSTUP_HOME='/opt/rust-compat-20261113/rustup',CARGO_HOME='/opt/rust-compat-20261113/cargo',CARGO_TARGET_DIR='/tmp/rust-compat-target-20261113',CARGO_PROFILE_DEV_DEBUG='0',CARGO_PROFILE_TEST_DEBUG='0',CARGO_INCREMENTAL='0',CARGO_BUILD_JOBS='2')
env['PATH']='/opt/rust-compat-20261113/cargo/bin:'+env['PATH']
results=[]
for crate in [*sorted((base/'wasm').glob('*/Cargo.toml')),Path('/root/rust-worker-sqlx-d1/Cargo.toml')]:
 lock=crate.with_name('Cargo.lock');before=hashlib.sha256(lock.read_bytes()).hexdigest()
 for kind,args in [('test',['test','--locked']),('wasm-release',['build','--locked','--release','--target','wasm32-unknown-unknown'])]:
  start=time.monotonic()
  with (art/(crate.parent.name+'-'+kind+'.log')).open('w') as log:
   r=subprocess.run(['cargo',*args,'--manifest-path',str(crate)],env=env,stdout=log,stderr=subprocess.STDOUT)
  record={'crate':crate.parent.name,'kind':kind,'exit':r.returncode,'seconds':round(time.monotonic()-start,2),'lock_unchanged':hashlib.sha256(lock.read_bytes()).hexdigest()==before}
  results.append(record);print(json.dumps(record),flush=True)
  (art/'compile-results.json').write_text(json.dumps(results,indent=2)+'\n')
