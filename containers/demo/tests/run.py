#!/usr/bin/env python3
"""Container-only configuration tests; no lib checkout or Docker/model calls."""
import argparse,datetime,json,os,subprocess,sys
from pathlib import Path

HERE=Path(__file__).resolve().parent
MAIN=HERE.parents[2]

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--log-dir',type=Path,default=MAIN/'artifacts/lib-network-tests'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
 p.add_argument('--live-read-only',action='store_true',help='Also inspect already-running localhost/public endpoints; never posts model input')
 a=p.parse_args();a.log_dir.mkdir(parents=True,exist_ok=True)
 tests=[('container-post-install',[sys.executable,str(HERE/'post_install_test.py')]),
        ('network-env-cache',[sys.executable,str(HERE/'network/network_settings_test.py')]),
        ('apache-ssi',[sys.executable,str(HERE/'network/network_ssi_test.py')])]
 if a.live_read_only:
  tests.extend([('installed-runtime',[sys.executable,str(HERE/'network/network_runtime_test.py')]),
                ('public-streams',[sys.executable,str(HERE/'network/network_live_test.py')])])
 results=[]
 for name,command in tests:
  with (a.log_dir/(name+'.log')).open('w') as f:
   try:code=subprocess.run(command,cwd=MAIN,stdout=f,stderr=subprocess.STDOUT,timeout=120).returncode
   except (OSError,subprocess.TimeoutExpired) as error:
    f.write(type(error).__name__+'\n');code=1
  results.append({'suite':name,'exit_code':code,'log':name+'.log'})
  print(('PASS' if code==0 else 'FAIL')+' '+name,flush=True)
 (a.log_dir/'results.json').write_text(json.dumps({'docker_build':False,'model_input':False,'suites':results},indent=2)+'\n')
 return int(any(r['exit_code']!=0 for r in results))

if __name__=='__main__':raise SystemExit(main())
