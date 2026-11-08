#!/usr/bin/env python3
"""Authenticated, message-only gateway to the installed Muse Gadgets Linux SDK.
No token, prompt, reply, pairing credentials or upstream exception is logged.
"""
import asyncio
import fcntl
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import shlex
import sqlite3
import time
from aiohttp import web
from musegadget import config, identity, muse_api, __version__
from musegadget.executor import Account, Executor
from musegadget.link_client import DeviceDescription
from musegadget.service import Service
TOKEN = re.compile(r'mgst_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]')
ID = re.compile(r'[A-Za-z0-9-]{1,64}')

def authenticated(secret, path, body, timestamp, signature, now=None):
    if not secret or not re.fullmatch(r'\d{1,12}', timestamp) or abs((time.time() if now is None else now)-int(timestamp))>300 or not re.fullmatch(r'[0-9a-f]{64}', signature): return False
    canonical=f'POST\n{path}\n{timestamp}\n{hashlib.sha256(body).hexdigest()}'.encode()
    return hmac.compare_digest(signature,hmac.new(secret.encode(),canonical,hashlib.sha256).hexdigest())

def sdk_token_matches(token, pairing):
    # A matching hint is necessary, never sufficient proof of online validity.
    return bool(TOKEN.fullmatch(token) and isinstance(pairing,dict) and pairing.get('sdk_token_hint')==config.sdk_token_hint(token))

class ReceiptStore:
    def __init__(self,path):
        path.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        self.db=sqlite3.connect(path);os.chmod(path,0o600)
        self.db.execute('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, conversation TEXT, hash TEXT, status INTEGER, result TEXT)');self.db.commit()
        self.busy=False
    def close(self):self.db.close()
    async def submit(self,request_id,conversation,prompt,send):
        digest=hashlib.sha256(prompt.encode()).hexdigest()
        row=self.db.execute('SELECT conversation,hash,status,result FROM receipts WHERE id=?',(request_id,)).fetchone()
        if row:
            if row[0]!=conversation or row[1]!=digest:return 409,{'error':'request_id_conflict'}
            if row[2]==0:return 409,{'error':'delivery_unknown_do_not_retry'}
            return row[2],json.loads(row[3])
        if self.busy:return 409,{'error':'gadget_busy'}
        self.busy=True
        self.db.execute('INSERT INTO receipts VALUES(?,?,?,?,?)',(request_id,conversation,digest,0,'{}'));self.db.commit()
        try:
            result=await send()
            if result.get('ok') is True and isinstance(result.get('reply'),str) and result['reply'].strip():
                status=200 if not result.get('partial') else 206
                result={'ok':True,'reply':result['reply'],'partial':bool(result.get('partial'))}
            else:status,result=504,{'error':'reply_unavailable','delivery':'unknown'}
        except asyncio.CancelledError:raise
        except Exception:status,result=504,{'error':'reply_unavailable','delivery':'unknown'}
        finally:self.busy=False
        self.db.execute('UPDATE receipts SET status=?,result=? WHERE id=?',(status,json.dumps(result),request_id));self.db.commit()
        return status,result

class MessageService(Service):
    active_session=None
    def describe(self):return DeviceDescription(self.identity.node_id,'Worker sample messages',__version__,{})
    def run_command(self,*args,**kwargs):return {'ok':False,'error':'message-only gadget'}
    async def serve(self,session,vm,stop):
        self.active_session=session
        try:return await session.run(stop)
        finally:self.active_session=None

class GadgetRelay:
    def __init__(self,secret,receipts):
        self.secret=secret;self.receipts=receipts;self.service=None;self.task=None;self.socket_server=None
    async def prepare(self,token):
        if not isinstance(token,str) or not TOKEN.fullmatch(token):return {'ready':False,'code':'sdk_token_invalid'}
        try:local=config.sdk_token()
        except ValueError:return {'ready':False,'code':'local_sdk_token_invalid'}
        if local and not hmac.compare_digest(local,token):return {'ready':False,'code':'sdk_token_mismatch'}
        if not local:
            directory=config.state_dir();directory.mkdir(parents=True,exist_ok=True,mode=0o700)
            path=directory/config.SDK_TOKEN_FILE
            fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as out:out.write(token+'\n')
        pairing=config.load_json(config.PAIRING_FILE)
        if not pairing:return {'ready':False,'code':'pairing_required'}
        if not sdk_token_matches(token,pairing):return {'ready':False,'code':'pair_again_with_sdk_token'}
        if self.service is None:
            # Never replace another process's live device transport/socket.
            path=config.socket_path()
            if path.exists():
                try:
                    r,w=await asyncio.open_unix_connection(str(path));w.close();await w.wait_closed()
                except (ConnectionRefusedError,FileNotFoundError):pass
                else:return {'ready':False,'code':'existing_gadget_service_active'}
            self.service=MessageService(identity.load_or_create(),Executor(Account.lookup('musegadget')),token)
            self.socket_server=await self.service.serve_local(path)
            self.task=asyncio.create_task(self.service.run())
        session=self.service.active_session
        if session is None or not session.registered.is_set():return {'ready':False,'code':'gadget_connecting'}
        # Fresh device API verification; syntax or a live TCP socket is not validity.
        vms,status=await asyncio.to_thread(muse_api.fetch_vms_with_status,pairing.get('access_token',''),muse_api.api_root(pairing.get('api_url_v2','')))
        if status!=200 or not vms:return {'ready':False,'code':'device_credentials_rejected' if status in (401,403) else 'device_credentials_unverified'}
        return {'ready':True,'code':'connected'}
    async def handle(self,request):
        body=await request.read()
        if not authenticated(self.secret,request.path,body,request.headers.get('X-Timestamp',''),request.headers.get('X-Signature','')):return web.json_response({'error':'unauthorized'},status=401)
        try:data=json.loads(body)
        except (ValueError,UnicodeError):return web.json_response({'error':'invalid_json'},status=400)
        if not isinstance(data,dict):return web.json_response({'error':'invalid_json'},status=400)
        state=await self.prepare(data.get('sdkToken'))
        if request.path=='/gadget/status':return web.json_response(state,headers={'Cache-Control':'no-store'})
        if not state['ready']:return web.json_response({'error':state['code']},status=503)
        prompt=data.get('prompt');conversation=data.get('conversationId');rid=data.get('requestId')
        if not isinstance(prompt,str) or not prompt.strip() or len(prompt.encode())>16384 or not isinstance(conversation,str) or not ID.fullmatch(conversation) or not isinstance(rid,str) or not ID.fullmatch(rid):return web.json_response({'error':'invalid_message'},status=400)
        async def send():
            reader,writer=await asyncio.open_unix_connection(str(config.socket_path()),limit=1_048_576)
            try:
                writer.write(json.dumps({'message':prompt,'session_id':conversation,'wait':120}).encode()+b'\n');await writer.drain()
                return json.loads(await asyncio.wait_for(reader.readline(),135))
            finally:writer.close();await writer.wait_closed()
        status,result=await self.receipts.submit(rid,conversation,prompt,send)
        return web.json_response(result,status=status,headers={'Cache-Control':'no-store'})
    async def close(self,_app):
        if self.service:self.service.stop()
        if self.task:
            self.task.cancel();await asyncio.gather(self.task,return_exceptions=True)
        if self.socket_server:self.socket_server.close();await self.socket_server.wait_closed()
        self.receipts.close()

def main():
    secret=os.environ.get('ORIGIN_HMAC_SECRET','')
    if not secret:
        for line in Path('/etc/lib-hmac.env').read_text().splitlines():
            if line.startswith('ORIGIN_HMAC_SECRET='):secret=' '.join(shlex.split(line.split('=',1)[1]))
    if not secret:raise SystemExit('Signing secret missing')
    lock=open('/run/muse-gadget-relay.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    relay=GadgetRelay(secret,ReceiptStore(Path('/var/lib/musegadget-relay/receipts.sqlite')))
    app=web.Application(client_max_size=65536)
    app.router.add_post('/gadget/status',relay.handle);app.router.add_post('/gadget/chat',relay.handle)
    app.on_cleanup.append(relay.close)
    web.run_app(app,host='127.0.0.1',port=8766,access_log=None,print=None)
if __name__=='__main__':main()
