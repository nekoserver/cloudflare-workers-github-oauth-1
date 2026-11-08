import asyncio, hashlib, hmac, json, sys, tempfile, unittest
from pathlib import Path
from unittest.mock import AsyncMock
sys.path.insert(0, str(Path(__file__).parent))
from muse_gadget_relay import ReceiptStore, authenticated, sdk_token_matches
TOKEN='mgst_'+'A'*43
class RelayTests(unittest.IsolatedAsyncioTestCase):
 def test_signature_binds_secret_token_and_prompt(self):
  body=json.dumps({'sdkToken':TOKEN,'prompt':'hello'}).encode();ts='1234'
  value=hmac.new(b'key',b'POST\n/gadget/chat\n1234\n'+hashlib.sha256(body).hexdigest().encode(),hashlib.sha256).hexdigest()
  self.assertTrue(authenticated('key','/gadget/chat',body,ts,value,now=1234))
  self.assertFalse(authenticated('key','/gadget/chat',body+b'x',ts,value,now=1234))
  self.assertFalse(authenticated('key','/gadget/chat',body,ts,value,now=2000))
 def test_format_is_not_validity_and_wrong_pairing_does_not_match(self):
  self.assertFalse(sdk_token_matches(TOKEN,None))
  self.assertFalse(sdk_token_matches(TOKEN,{'sdk_token_hint':'wrong'}))
  self.assertTrue(sdk_token_matches(TOKEN,{'sdk_token_hint':TOKEN[:12]}))
 async def test_durable_receipt_never_resubmits_even_after_restart(self):
  with tempfile.TemporaryDirectory() as tmp:
   path=Path(tmp)/'receipts.sqlite';store=ReceiptStore(path);send=AsyncMock(return_value={'ok':True,'reply':'answer'})
   first=await store.submit('request-1','chat-1','hello',send)
   self.assertEqual(first,(200,{'ok':True,'reply':'answer','partial':False}));self.assertEqual(await store.submit('request-1','chat-1','hello',send),first)
   self.assertEqual((await store.submit('request-1','chat-1','changed',send))[0],409)
   store.close();store=ReceiptStore(path)
   self.assertEqual(await store.submit('request-1','chat-1','hello',send),first);send.assert_awaited_once();store.close()
 async def test_unknown_delivery_is_not_retried(self):
  with tempfile.TemporaryDirectory() as tmp:
   store=ReceiptStore(Path(tmp)/'receipts.sqlite');send=AsyncMock(side_effect=TimeoutError())
   self.assertEqual((await store.submit('request-1','chat-1','hello',send))[0],504)
   self.assertEqual((await store.submit('request-1','chat-1','hello',send))[0],504);send.assert_awaited_once();store.close()
if __name__=='__main__':unittest.main()
