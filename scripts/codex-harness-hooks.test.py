import json,os,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BUNDLE=ROOT/'containers/demo/codex-harness'
class CodexHooksTest(unittest.TestCase):
 def invoke(self,payload):
  p=subprocess.run(['python3',str(BUNDLE/'japanese.py')],input=json.dumps(payload),text=True,capture_output=True)
  self.assertEqual(p.returncode,0,p.stderr)
  return json.loads(p.stdout)
 def test_context_is_codex_json(self):
  for event in ('SessionStart','UserPromptSubmit'):
   result=self.invoke({'hook_event_name':event})['hookSpecificOutput']
   self.assertEqual(result['hookEventName'],event)
   self.assertIn('日本語',result['additionalContext'])
 def test_stop_uses_codex_last_message(self):
  result=self.invoke({'hook_event_name':'Stop','last_assistant_message':'This is an entirely English final explanation that needs rewriting.'})
  self.assertEqual(result['decision'],'block')
  self.assertIn('日本語',result['reason'])
 def test_japanese_and_stop_loop_are_allowed(self):
  self.assertEqual(self.invoke({'hook_event_name':'Stop','last_assistant_message':'設定を確認して復旧しました。'}),{})
  self.assertEqual(self.invoke({'hook_event_name':'Stop','stop_hook_active':True,'last_assistant_message':'English response that should not cause an infinite continuation loop.'}),{})
 def test_html_and_visualize_are_exempt(self):
  for message in (
   'visualize{"path":"/root/artifacts/muse-d1-tree.html"}',
   '<div><div>Conversation tree with question and response identifiers</div><p>Completed database migration</p></div>',
   '<!doctype html><html><head><title>Conversation tree</title></head><body>Database conversation history</body></html>',
  ):
   self.assertEqual(self.invoke({'hook_event_name':'Stop','last_assistant_message':message}),{})
 def test_english_outside_html_is_still_checked(self):
  message='<div>Conversation tree</div> This is an entirely English final explanation that needs rewriting.'
  self.assertEqual(self.invoke({'hook_event_name':'Stop','last_assistant_message':message})['decision'],'block')
 def test_install_preserves_unrelated_and_is_idempotent(self):
  with tempfile.TemporaryDirectory() as directory:
   home=Path(directory);config=home/'hooks.json';other={'type':'command','command':'printf unrelated'}
   config.write_text(json.dumps({'description':'keep','hooks':{'SessionStart':[{'hooks':[other]}]}}))
   env={**os.environ,'CODEX_HOME':directory}
   cmd=['python3',str(BUNDLE/'restore.py')]
   subprocess.run(cmd,env=env,check=True,capture_output=True)
   first=config.read_bytes();subprocess.run(cmd,env=env,check=True,capture_output=True)
   self.assertEqual(config.read_bytes(),first)
   doc=json.loads(first);self.assertEqual(doc['description'],'keep')
   self.assertIn(other,doc['hooks']['SessionStart'][0]['hooks'])
   self.assertEqual(config.stat().st_mode&0o777,0o600)
   self.assertFalse((home/'config.toml').exists())
 def test_invalid_existing_configuration_is_preserved(self):
  with tempfile.TemporaryDirectory() as directory:
   config=Path(directory)/'hooks.json';config.write_text('invalid existing settings')
   p=subprocess.run(['python3',str(BUNDLE/'restore.py')],env={**os.environ,'CODEX_HOME':directory},capture_output=True)
   self.assertNotEqual(p.returncode,0);self.assertEqual(config.read_text(),'invalid existing settings')
 def test_container_bundles_and_restores_hooks_without_build_time_install(self):
  docker=(ROOT/'containers/demo/Dockerfile').read_text()
  entry=(ROOT/'containers/demo/entrypoint.sh').read_text()
  self.assertIn('COPY codex-harness/ /usr/local/share/codex-harness/',docker)
  self.assertIn('/usr/bin/python3 /usr/local/share/codex-harness/restore.py',entry)
  config=json.loads((BUNDLE/'hooks.json').read_text())
  self.assertEqual(set(config['hooks']),{'SessionStart','UserPromptSubmit','Stop'})
if __name__=='__main__':unittest.main(verbosity=2)
