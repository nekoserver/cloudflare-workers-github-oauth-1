#!/usr/bin/env python3
"""Install the tested development adapter into the running proxy, without building Docker.

A private immutable release and the old launcher/config are retained for rollback.
Native T3 credentials and existing sessions are never read or modified here.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,os,signal,subprocess,uuid
ROOT=Path(__file__).resolve().parent.parent
STATE=Path('/root/.local/state/t3-pwa-native-auth')
CONFIG=Path('/root/.t3/userdata/pwa-handoff/config.json')
LIVE=Path('/usr/local/libexec/t3-embed-proxy.cjs')
FILES=['t3-embed-proxy.cjs','t3-pwa-auth.cjs','t3-pwa-client.js','t3-pwa-client.css']
def atomic(path,data,mode=0o600):
    path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    fd=os.open(temp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,mode)
    with os.fdopen(fd,'wb') as stream:stream.write(data)
    os.replace(temp,path)
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--enable-development',action='store_true')
    parser.add_argument('--disable',action='store_true')
    args=parser.parse_args()
    if not (args.enable_development ^ args.disable):parser.error('Choose --enable-development or --disable')
    os.umask(0o077)
    if args.disable:
        atomic(CONFIG,json.dumps({'enabled':False,'developmentOnly':True,'generation':uuid.uuid4().hex}).encode())
        print('Future development handoffs disabled; existing native sessions keep their original expiry.');return
    pids=[]
    for directory in Path('/proc').iterdir():
        if not directory.name.isdigit():continue
        try:
            argv=(directory/'cmdline').read_bytes().split(b'\0')
            if argv and Path(os.fsdecode(argv[0])).name=='node' and os.fsencode(LIVE) in argv:pids.append(int(directory.name))
        except OSError:pass
    if len(pids)!=1:raise RuntimeError('Expected exactly one supervised live proxy; nothing changed')
    data={name:(ROOT/'containers/demo'/name).read_bytes() for name in FILES}
    for name in FILES:
        if name.endswith(('.js','.cjs')):subprocess.run(['node','--check',str(ROOT/'containers/demo'/name)],check=True,capture_output=True)
    digest=hashlib.sha256(b''.join(name.encode()+data[name] for name in FILES)).hexdigest()
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup=STATE/stamp;backup.mkdir(parents=True,mode=0o700)
    atomic(backup/'launcher-before.cjs',LIVE.read_bytes())
    if CONFIG.exists():atomic(backup/'config-before.json',CONFIG.read_bytes())
    release=STATE/'releases'/digest;release.mkdir(parents=True,exist_ok=True,mode=0o700)
    for name,content in data.items():
        target=release/name
        if target.exists() and target.read_bytes()!=content:raise RuntimeError('Release content changed; refusing installation')
        if not target.exists():atomic(target,content)
    manifest={'installed_at':stamp,'release':str(release),'release_sha256':digest,'files':{name:hashlib.sha256(content).hexdigest() for name,content in data.items()},'previous_launcher_sha256':hashlib.sha256(LIVE.read_bytes()).hexdigest(),'developmentOnly':True,'container_image_updated':False}
    atomic(backup/'manifest.json',json.dumps(manifest,indent=2).encode())
    config={'enabled':True,'developmentOnly':True,'generation':uuid.uuid4().hex}
    atomic(CONFIG,json.dumps(config,indent=2).encode())
    launcher=("'use strict';\nrequire("+json.dumps(str(release/'t3-embed-proxy.cjs'))+").start();\n").encode()
    atomic(LIVE,launcher,0o644)
    atomic(backup/'launcher-installed.cjs',launcher)
    atomic(STATE/'latest',str(backup).encode())
    os.kill(pids[0],signal.SIGTERM)
    print(json.dumps({'development_adapter_installed':True,'release_sha256':digest,'backup':str(backup),'proxy_restart':'supervisor','container_image_updated':False}))
if __name__=='__main__':main()
