#!/usr/bin/env python3
"""Container-only post-install configuration. No downloads, forks or model input."""
import argparse
import asyncio
import fcntl
import grp
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import signal
import socket
import subprocess
import tempfile
import time
import uuid

BUNDLE=Path(__file__).resolve().parent
KEYS=('ORIGIN_HMAC_SECRET','HMAC_SECRET','CLOUDFLARE_ACCOUNT_ID','CF_CONTAINER_API_TOKEN','CLOUDFLARE_API_TOKEN',
      'LIB_CHAT_ORIGINS','LIB_CHAT_FRAME_ORIGINS','LIB_CHAT_THREAD_ID','CODEX_THREAD_ID')
LIB_FILES=('api/tunnels.rb','api/tunnels-filter.rb','api/tunnels_lib.rb','api/hmac_auth.rb','api/ask_sanbo.rb','api/llm_prompt.rb',
           'api/railway_exec.rb','api/tunnels.shtml','conversation-embed.html','date.shtml','ruby_-v.shtml',
           'ops/chat_access.py','ops/chat_session.py','ops/chat_site.py','ops/chat_websocket.py','ops/chat_http_stream.py',
           'ops/chat_observer.py','ops/llm_worker.py','ops/spec_eval.py','ops/claude-helper.sh')
DEFAULT_ORIGINS='https://mygw.nekomaneki.work,https://r8.nekomaneki.work,https://stream.test.cfc.nekomaneki.work'
APP_SOCKET='/run/lib-chat-app/app-server.sock'


def safe_path(root, absolute):
    path=root/absolute.lstrip('/')
    for part in (path,*path.parents):
        if part==root:break
        if part.is_symlink():raise ValueError('Symlink configuration path refused')
    return path


def private_dir(root, absolute, mode=0o700, gid=None):
    path=safe_path(root,absolute);path.mkdir(parents=True,exist_ok=True);path.chmod(mode)
    if gid is not None:os.chown(path,0,gid)
    return path


def atomic_write(root, absolute, data, mode=0o600, gid=None, uid=0):
    path=safe_path(root,absolute);path.parent.mkdir(parents=True,exist_ok=True)
    if isinstance(data,str):data=data.encode()
    if path.exists() and path.read_bytes()==data:
        path.chmod(mode)
        if gid is not None:os.chown(path,uid,gid)
        return
    # Preserve old important settings privately before replacement.
    if path.exists() and absolute.startswith(('/etc/lib-','/var/lib/lib-chat-observer/')):
        history=private_dir(root,'/var/lib/lib-network/config-history')
        backup=history/(str(time.time_ns())+'-'+uuid.uuid4().hex+'-'+path.name)
        backup.write_bytes(path.read_bytes());backup.chmod(0o600)
    fd,name=tempfile.mkstemp(prefix='.'+path.name+'.',dir=path.parent)
    try:
        os.fchmod(fd,mode)
        if gid is not None:os.fchown(fd,uid,gid)
        with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())
        os.replace(name,path)
    finally:
        Path(name).unlink(missing_ok=True)


def read_settings(root):
    result={}
    for name in ('/etc/lib-chat.env','/etc/lib-hmac.env','/etc/lib-tunnels.env'):
        path=safe_path(root,name)
        if not path.exists():continue
        if not path.is_file() or path.stat().st_mode & 0o022:raise ValueError('Unsafe saved settings')
        for line in path.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith('#'):continue
            key,raw=line.split('=',1)
            if key in KEYS:result[key]=' '.join(shlex.split(raw))
    return result


def resolve_settings(environ,saved):
    values={k:v for k,v in saved.items() if k in KEYS}
    values.update({k:v for k,v in environ.items() if k in KEYS and v.strip()})
    values['ORIGIN_HMAC_SECRET']=(environ.get('ORIGIN_HMAC_SECRET','').strip() or environ.get('HMAC_SECRET','').strip()
                                  or saved.get('ORIGIN_HMAC_SECRET','').strip() or saved.get('HMAC_SECRET','').strip())
    values['LIB_CHAT_THREAD_ID']=(environ.get('LIB_CHAT_THREAD_ID','').strip() or environ.get('CODEX_THREAD_ID','').strip()
                                  or saved.get('LIB_CHAT_THREAD_ID','').strip())
    values['LIB_CHAT_ORIGINS']=values.get('LIB_CHAT_ORIGINS') or DEFAULT_ORIGINS
    for key in ('LIB_CHAT_ORIGINS','LIB_CHAT_FRAME_ORIGINS'):
        if key not in values:continue
        from urllib.parse import urlsplit
        for origin in values[key].split(','):
            parsed=urlsplit(origin.strip())
            if parsed.scheme!='https' or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
                raise ValueError('Exact HTTPS origins required')
    thread=values['LIB_CHAT_THREAD_ID']
    if thread and not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',thread):raise ValueError('A fixed thread is required')
    return values


def configure_environment(root,settings):
    gid=grp.getgrnam('www-data').gr_gid
    atomic_write(root,'/etc/lib-hmac.env','ORIGIN_HMAC_SECRET='+shlex.quote(settings['ORIGIN_HMAC_SECRET'])+'\n',0o640,gid)
    chat={k:settings[k] for k in ('LIB_CHAT_ORIGINS','LIB_CHAT_FRAME_ORIGINS','LIB_CHAT_THREAD_ID') if settings.get(k)}
    atomic_write(root,'/etc/lib-chat.env',''.join(k+'='+shlex.quote(v)+'\n' for k,v in chat.items()))
    tunnel={k:settings[k] for k in ('CLOUDFLARE_ACCOUNT_ID','CF_CONTAINER_API_TOKEN','CLOUDFLARE_API_TOKEN') if settings.get(k)}
    atomic_write(root,'/etc/lib-tunnels.env',''.join(k+'='+shlex.quote(v)+'\n' for k,v in tunnel.items()))


def configure_sockets(root):
    gid=grp.getgrnam('www-data').gr_gid
    private_dir(root,'/run/lib-chat-app')
    for path in ('/run/lib-chat-observer','/run/lib-codex'):
        private_dir(root,path,0o750,gid)
    private_dir(root,'/var/lib/lib-chat-observer')
    private_dir(root,'/var/cache/lib-api',0o755)


def configure_credentials(root):
    user=pwd.getpwnam('codex-web')
    for src,dest in (('/root/.codex/auth.json','/var/lib/codex-web/.codex/auth.json'),
                     ('/root/.claude/.credentials.json','/var/lib/codex-web/.claude/.credentials.json')):
        source=safe_path(root,src);target=safe_path(root,dest)
        # Existing helper credentials may have been refreshed independently.
        # Preserve them; never bake either user's state into the image.
        if source.is_file() and not target.exists():
            parent=private_dir(root,str(Path(dest).parent),0o700)
            os.chown(parent,user.pw_uid,user.pw_gid)
            atomic_write(root,dest,source.read_bytes(),0o600,user.pw_gid,user.pw_uid)


def configure_observer(root,settings,verify_thread):
    thread=settings.get('LIB_CHAT_THREAD_ID','')
    if not thread or not verify_thread(APP_SOCKET,thread):return 'waiting_for_thread'
    source=json.dumps({'appSocket':APP_SOCKET,'threadId':thread})+'\n'
    atomic_write(root,'/var/lib/lib-chat-observer/source.json',source)
    return 'configured'


def run_service(argv):
    # Logs contain step labels/status only. Child stderr may contain auth data.
    try:return subprocess.run(argv,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30).returncode
    except (OSError,subprocess.TimeoutExpired):return 1


def verify_observer_thread(path,thread):
    async def verify():
        from websockets.asyncio.client import unix_connect
        async with asyncio.timeout(12):
            async with unix_connect(path,uri='ws://localhost',max_size=16_777_216) as ws:
                async def rpc(i,method,params):
                    await ws.send(json.dumps({'id':i,'method':method,'params':params}))
                    while True:
                        data=json.loads(await ws.recv())
                        if data.get('id')==i:
                            if 'error' in data:return {}
                            return data.get('result',{})
                await rpc(1,'initialize',{'clientInfo':{'name':'container_post_install_readonly','version':'1'}})
                await ws.send('{"method":"initialized","params":{}}')
                result=await rpc(2,'thread/read',{'threadId':thread,'includeTurns':False})
                return result.get('thread',{}).get('id')==thread
    for _ in range(4):
        try:
            if asyncio.run(verify()):return True
        except Exception:pass
        time.sleep(.2)
    return False


def stop_observer(root):
    pidfile=safe_path(root,'/run/lib-chat-observer.pid')
    if not pidfile.exists():return
    try:
        pid=int(pidfile.read_text());cmd=safe_path(root,'/proc/'+str(pid)+'/cmdline').read_bytes()
        if b'/var/www/html/lib/ops/chat_observer.py' in cmd:os.kill(pid,signal.SIGTERM)
    except (OSError,ValueError):pass


def restart_streams(root):
    """Apply changed signing/origin settings to managed public processes only."""
    for name in ('chat_websocket','chat_http_stream'):
        pidfile=safe_path(root,'/run/lib-'+name+'.pid')
        if not pidfile.exists():continue
        try:
            pid=int(pidfile.read_text())
            cmd=safe_path(root,'/proc/'+str(pid)+'/cmdline').read_bytes()
            expected=('/var/www/html/lib/ops/'+name+'.py').encode()
            if expected not in cmd:raise ValueError('Refusing unrelated PID')
            if os.getpgid(pid)!=pid:raise ValueError('Unexpected stream process group')
            os.killpg(pid,signal.SIGTERM)
            deadline=time.monotonic()+3
            while (root/'proc'/str(pid)).exists() and time.monotonic()<deadline:time.sleep(.05)
            if (root/'proc'/str(pid)).exists():raise ValueError('Stream did not stop')
        except FileNotFoundError:pass
        pidfile.unlink(missing_ok=True)


def service_ready(root,name):
    """Check actual transports, not just a successful launcher exit."""
    root=Path(root)
    # Alternate roots are installation fixtures; never probe host TCP ports.
    if root!=Path('/'):return False
    unix={'start-lib-llm-worker':'/run/lib-codex/worker.sock',
          'start-lib-chat-observer':'/run/lib-chat-observer/observer.sock'}
    deadline=time.monotonic()+2
    while True:
        try:
            if name in unix:
                with socket.socket(socket.AF_UNIX) as connection:
                    connection.settimeout(.2);connection.connect(unix[name])
            else:
                for port in (8091,8092):
                    with socket.create_connection(('127.0.0.1',port),timeout=.2):pass
            return True
        except OSError:
            if time.monotonic()>=deadline:return False
            time.sleep(.1)


def configure_after_install(root=Path('/'),environ=None,*,activate=True,run=run_service,verify_thread=None):
    """Called on every container boot and by cron; never starts an AI turn."""
    root=Path(root);env=os.environ if environ is None else environ
    private_dir(root,'/run/lib-network',0o700)
    with (root/'run/lib-network/config.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        saved=read_settings(root)
        settings=resolve_settings(env,saved)
        if not settings['ORIGIN_HMAC_SECRET']:return {'state':'waiting_for_hmac','observer':'not_started'}
        configure_sockets(root);configure_environment(root,settings);configure_credentials(root)
        result={'state':'configured'}
        if activate:
            stream_keys=('ORIGIN_HMAC_SECRET','LIB_CHAT_ORIGINS','LIB_CHAT_FRAME_ORIGINS')
            if saved and any(settings.get(k)!=saved.get(k) for k in stream_keys):restart_streams(root)
            for name in ('start-lib-chat-streams','start-lib-llm-worker'):
                code=run(['/usr/local/sbin/'+name])
                result[name]=('ready' if service_ready(root,name) else 'starting') if code==0 else 'failed'
            if settings['LIB_CHAT_THREAD_ID']:
                run(['/usr/local/sbin/start-lib-chat-app-server'])
        verifier=verify_thread or verify_observer_thread
        result['observer']=configure_observer(root,settings,verifier)
        if activate:
            if result['observer']=='configured':
                if run(['/usr/local/sbin/start-lib-chat-observer'])!=0:result['observer']='failed'
                elif not service_ready(root,'start-lib-chat-observer'):result['observer']='starting'
            else:stop_observer(root)
            result['tunnels']='refreshed' if run(['/usr/local/sbin/refresh-lib-tunnels'])==0 else 'refresh_failed'
        if any(value in ('failed','refresh_failed','starting') for value in result.values()):result['state']='degraded'
        if result['observer']!='configured':result['state']='degraded'
        atomic_write(root,'/run/lib-network/status.json',json.dumps(result)+'\n')
        return result


def install_image(root=Path('/'),bundle=BUNDLE,lib_source=Path('/opt/lib-network-src')):
    """Install runtime files from an independently checked out lib repository."""
    root=Path(root);lib_source=Path(lib_source)
    files={name:lib_source/name for name in LIB_FILES}
    for path in (lib_source/'chat').rglob('*'):
        if path.is_file() and path.suffix in ('.mjs','.js','.css','.txt','.md'):
            files[str(path.relative_to(lib_source))]=path
    # Validate the whole source before modifying installation files. Never copy
    # test trees, .git, auth state or arbitrary root files into DocumentRoot.
    if not (lib_source/'chat/app.mjs').is_file():raise ValueError('lib chat runtime missing')
    for name,source in files.items():
        if source.is_symlink() or not source.is_file() or any(p.startswith('.') for p in Path(name).parts):
            raise ValueError('Invalid lib runtime source')
    for name,source in files.items():
        data=source.read_bytes()
        if Path(name).suffix in ('.rb','.shtml'):
            data=data.replace(b'/home/box/.rbenv/versions/4.0.7/bin/ruby',b'/usr/local/bin/ruby')
        atomic_write(root,'/var/www/html/lib/'+name,data,0o755 if name.endswith('.rb') else 0o644)
    for source in (bundle/'network').glob('start-lib-*'):
        atomic_write(root,'/usr/local/sbin/'+source.name,source.read_bytes(),0o755)
    for source,dest in [('network/refresh-lib-tunnels','/usr/local/sbin/refresh-lib-tunnels'),
                         ('network/tunnels.cgi','/usr/local/libexec/lib-api/tunnels.cgi'),
                         ('refresh-tunnels.py','/usr/local/libexec/lib-api/refresh-tunnels.py'),
                         ('network/llm-worker-command','/usr/local/libexec/start-lib-llm-worker'),
                         ('network/apache-lib-private.conf','/etc/apache2/conf-available/lib-private.conf')]:
        atomic_write(root,dest,(bundle/source).read_bytes(),0o644 if dest.endswith('.conf') else 0o755)
    atomic_write(root,'/usr/local/libexec/lib-claude-helper',(lib_source/'ops/claude-helper.sh').read_bytes(),0o755)
    # One configurator owns recovery; no stale-target independent observer cron.
    for name in ('lib-chat-streams','lib-chat-observer','lib-api-tunnels','lib-llm-worker'):
        safe_path(root,'/etc/cron.d/'+name).unlink(missing_ok=True)
    cron='* * * * * root /usr/bin/python3 /usr/local/share/lib-network/post_install.py >>/var/log/lib-network-start.log 2>&1\n'
    atomic_write(root,'/etc/cron.d/lib-network',cron,0o644)
    configure_binary_links(root)


def managed_link(root,absolute,target):
    path=root/absolute.lstrip('/')
    safe_path(root,str(Path(absolute).parent)).mkdir(parents=True,exist_ok=True)
    if path.is_symlink():
        if os.readlink(path)!=target:raise ValueError('Unexpected helper link')
    elif path.exists():
        raise ValueError('Helper path already occupied')
    else:path.symlink_to(target)


def configure_binary_links(root):
    managed_link(root,'/opt/lib-chat/bin/python','/usr/bin/python3')
    base='/opt/node22/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/'
    for name in ('codex','codex-code-mode-host'):
        if not (root/(base+name).lstrip('/')).is_file():raise ValueError('Installed Codex helper missing')
        managed_link(root,'/opt/codex-web/bin/'+name,base+name)
    claude='/opt/node22/lib/node_modules/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-linux-x64/claude'
    if not (root/claude.lstrip('/')).is_file():raise ValueError('Installed Claude helper missing')
    managed_link(root,'/opt/claude-web/claude',claude)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--install-image',action='store_true');args=parser.parse_args()
    if args.install_image:install_image();return 0
    if os.geteuid()!=0:raise SystemExit('Container configuration requires root')
    # Cron service is independent of model/observer readiness.
    run_service(['service','cron','start'])
    try:result=configure_after_install()
    except Exception:
        print('lib-network: configuration failed; existing history retained')
        return 1
    print('lib-network: '+json.dumps(result,sort_keys=True))
    return 0 if result['state']=='configured' else 1

if __name__=='__main__':raise SystemExit(main())
