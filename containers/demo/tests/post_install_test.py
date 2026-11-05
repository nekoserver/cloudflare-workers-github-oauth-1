"""Container-only configuration; every filesystem mutation uses an isolated root."""
import importlib.util,json,os,pwd,stat,tempfile,unittest
from pathlib import Path
from unittest.mock import Mock,patch

DEMO=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('post_install',DEMO/'lib-network/post_install.py')
config=importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)

class PostInstallTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.root=Path(self.tmp.name)
  for target,value in [('getpwnam',pwd.getpwuid(os.getuid()))]:
   mock=patch.object(config.pwd,target,return_value=value);mock.start();self.addCleanup(mock.stop)
  for target in ('chown','fchown'):
   mock=patch.object(config.os,target);mock.start();self.addCleanup(mock.stop)
 def test_current_env_wins_and_management_values_are_not_chat_settings(self):
  result=config.resolve_settings({'ORIGIN_HMAC_SECRET':' current ','LIB_CHAT_THREAD_ID':'current','LIB_CHAT_ORIGINS':'https://current.example','GH_TOKEN':'private'}, {'ORIGIN_HMAC_SECRET':'saved','LIB_CHAT_THREAD_ID':'saved'})
  self.assertEqual(result['ORIGIN_HMAC_SECRET'],'current');self.assertEqual(result['LIB_CHAT_THREAD_ID'],'current')
  self.assertNotIn('GH_TOKEN',result)
 def test_legacy_current_key_wins_over_saved_primary(self):
  self.assertEqual(config.resolve_settings({'HMAC_SECRET':'current'}, {'ORIGIN_HMAC_SECRET':'saved'})['ORIGIN_HMAC_SECRET'],'current')
 def test_explicit_current_thread_beats_saved_target(self):
  self.assertEqual(config.resolve_settings({'CODEX_THREAD_ID':'current'}, {'LIB_CHAT_THREAD_ID':'old'})['LIB_CHAT_THREAD_ID'],'current')
 def test_invalid_fixed_thread_and_origin_are_rejected(self):
  for values in ({'LIB_CHAT_THREAD_ID':'workspace:/root'},{'LIB_CHAT_ORIGINS':'https://good.example,http://bad.example'}):
   with self.subTest(values=values),self.assertRaises(ValueError):config.resolve_settings(values,{})
 def test_missing_secret_does_not_generate_one_or_start_services(self):
  run=Mock()
  outcome=config.configure_after_install(self.root,{},activate=True,run=run,verify_thread=Mock())
  self.assertEqual(outcome['state'],'waiting_for_hmac');run.assert_not_called()
  self.assertFalse((self.root/'etc/lib-hmac.env').exists())
 def test_private_configuration_and_repeatability(self):
  env={'ORIGIN_HMAC_SECRET':'test-secret','LIB_CHAT_THREAD_ID':'fixed-thread','LIB_CHAT_ORIGINS':'https://chat.example'}
  verify=Mock(return_value=True)
  for _ in range(2):
   result=config.configure_after_install(self.root,env,activate=False,verify_thread=verify)
   self.assertEqual(result['observer'],'configured')
  p=self.root/'var/lib/lib-chat-observer/source.json'
  self.assertEqual(json.loads(p.read_text())['threadId'],'fixed-thread')
  self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
  self.assertEqual(stat.S_IMODE(p.parent.stat().st_mode),0o700)
  self.assertEqual(stat.S_IMODE((self.root/'etc/lib-hmac.env').stat().st_mode),0o640)
 def test_failed_verification_keeps_previous_source_and_reports_not_ready(self):
  env={'ORIGIN_HMAC_SECRET':'test','LIB_CHAT_THREAD_ID':'original'}
  config.configure_after_install(self.root,env,activate=False,verify_thread=lambda *_:True)
  p=self.root/'var/lib/lib-chat-observer/source.json';before=p.read_bytes()
  result=config.configure_after_install(self.root,{**env,'LIB_CHAT_THREAD_ID':'new'},activate=False,verify_thread=lambda *_:False)
  self.assertEqual(result['observer'],'waiting_for_thread');self.assertEqual(p.read_bytes(),before)
 def test_startup_without_history_does_not_fork_or_submit(self):
  run=Mock(return_value=0)
  result=config.configure_after_install(self.root,{'ORIGIN_HMAC_SECRET':'test'},activate=True,run=run,verify_thread=Mock())
  self.assertEqual(result['observer'],'waiting_for_thread')
  for call in run.call_args_list:
   self.assertNotIn('fork',' '.join(call.args[0]));self.assertNotIn('turn/start',' '.join(call.args[0]))
 def test_source_failure_does_not_start_observer_with_old_target(self):
  run=Mock(return_value=0)
  result=config.configure_after_install(self.root,{'ORIGIN_HMAC_SECRET':'test','LIB_CHAT_THREAD_ID':'fixed'},activate=True,run=run,verify_thread=lambda *_:False)
  self.assertEqual(result['observer'],'waiting_for_thread')
  self.assertFalse(any('start-lib-chat-observer' in str(call) for call in run.call_args_list))
 def test_symlink_configuration_is_not_followed(self):
  target=self.root/'outside';target.write_text('preserve')
  (self.root/'etc').mkdir();(self.root/'etc/lib-hmac.env').symlink_to(target)
  with self.assertRaises(ValueError):config.configure_after_install(self.root,{'ORIGIN_HMAC_SECRET':'test'},activate=False)
  self.assertEqual(target.read_text(),'preserve')
 def test_credentials_are_copied_privately_and_never_into_webroot(self):
  source=self.root/'root/.codex/auth.json';source.parent.mkdir(parents=True);source.write_text('{"test":"private"}')
  config.configure_after_install(self.root,{'ORIGIN_HMAC_SECRET':'test'},activate=False)
  dest=self.root/'var/lib/codex-web/.codex/auth.json'
  self.assertEqual(dest.read_text(),source.read_text());self.assertEqual(stat.S_IMODE(dest.stat().st_mode),0o600)
  self.assertFalse((self.root/'var/www/html/lib/auth.json').exists())
 def test_boot_hook_precedes_apache_and_docker_installs_code(self):
  docker=(DEMO/'Dockerfile').read_text();entry=(DEMO/'entrypoint.sh').read_text()
  self.assertIn('COPY lib-network/ /usr/local/share/lib-network/',docker)
  self.assertIn('post_install.py --install-image',docker)
  self.assertLess(entry.index('post_install.py'),entry.index('apache2ctl configtest'))
  self.assertNotIn('--prompt',entry);self.assertNotIn('--console',entry)
 def test_concurrent_configurations_use_process_lock(self):
  with patch.object(config.fcntl,'flock',wraps=config.fcntl.flock) as lock:
   config.configure_after_install(self.root,{},activate=False)
  self.assertTrue(any(c.args[1]==config.fcntl.LOCK_EX for c in lock.call_args_list))
 def test_lib_is_an_external_dependency_not_a_vendored_snapshot(self):
  self.assertFalse((DEMO/'lib-network/lib').exists())
  docker=(DEMO/'Dockerfile').read_text()
  self.assertIn('ARG LIB_NETWORK_REVISION',docker)
  self.assertIn('git -C /opt/lib-network-src fetch',docker)
  self.assertIn('rev-parse HEAD',docker)
 def test_changed_settings_restart_existing_streams_but_identical_settings_do_not(self):
  env={'ORIGIN_HMAC_SECRET':'old','LIB_CHAT_THREAD_ID':'fixed'}
  config.configure_after_install(self.root,env,activate=False,verify_thread=lambda *_:True)
  with patch.object(config,'restart_streams') as restart:
   config.configure_after_install(self.root,env,activate=True,run=lambda *_:0,verify_thread=lambda *_:True)
   restart.assert_not_called()
   config.configure_after_install(self.root,{**env,'ORIGIN_HMAC_SECRET':'new'},activate=True,run=lambda *_:0,verify_thread=lambda *_:True)
   restart.assert_called_once_with(self.root)
 def test_verifier_only_reads_the_fixed_thread(self):
  import inspect
  code=inspect.getsource(config.verify_observer_thread)
  self.assertIn('thread/read',code)
  for forbidden in ('thread/fork','turn/start','thread/resume'):
   self.assertNotIn(forbidden,code)
 def image_fixture(self):
  source=self.root/'external-lib';source.mkdir()
  for name in config.LIB_FILES:
   p=source/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('#!/home/box/.rbenv/versions/4.0.7/bin/ruby\nfixture')
  (source/'chat').mkdir();(source/'chat/app.mjs').write_text('export {};')
  for name in ('codex','codex-code-mode-host'):
   p=self.root/'opt/node22/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin'/name
   p.parent.mkdir(parents=True,exist_ok=True);p.write_text('fixture')
  p=self.root/'opt/node22/lib/node_modules/@anthropic-ai/claude-code/node_modules/@anthropic-ai/claude-code-linux-x64/claude'
  p.parent.mkdir(parents=True,exist_ok=True);p.write_text('fixture')
  return source
 def test_image_install_uses_external_source_and_excludes_state_and_tests(self):
  source=self.image_fixture()
  for name in ('auth.json','.git/config','test/private_test.py','chat/auth.json'):
   p=source/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('private')
  config.install_image(self.root,lib_source=source)
  self.assertTrue((self.root/'var/www/html/lib/chat/app.mjs').is_file())
  self.assertIn('/usr/local/bin/ruby',(self.root/'var/www/html/lib/api/tunnels.rb').read_text())
  for name in ('auth.json','.git','test','chat/auth.json'):
   self.assertFalse((self.root/'var/www/html/lib'/name).exists())
 def test_image_preparation_can_be_repeated(self):
  source=self.image_fixture()
  for _ in range(2):config.install_image(self.root,lib_source=source)
  self.assertTrue((self.root/'opt/codex-web/bin/codex-code-mode-host').is_symlink())
 def test_missing_dependency_is_detected_before_installation(self):
  with self.assertRaises(ValueError):config.install_image(self.root,lib_source=self.root/'missing')
  self.assertFalse((self.root/'var/www/html/lib').exists())
 def test_launcher_success_alone_is_not_reported_as_ready(self):
  result=config.configure_after_install(self.root,{'ORIGIN_HMAC_SECRET':'test','LIB_CHAT_THREAD_ID':'fixed'},activate=True,run=lambda *_:0,verify_thread=lambda *_:True)
  self.assertEqual(result['state'],'degraded')
  self.assertEqual(result['observer'],'starting')
  self.assertEqual(result['start-lib-chat-streams'],'starting')
 def test_legacy_start_uses_the_same_container_configurator(self):
  script=(DEMO/'lib-network/network/start-lib-network').read_text()
  self.assertIn('exec /usr/bin/python3 /usr/local/share/lib-network/post_install.py',script)
 def test_build_check_passes_the_pinned_lib_revision(self):
  script=(DEMO.parents[1]/'scripts/check-cf-containers.sh').read_text()
  self.assertIn('LIB_NETWORK_REVISION=',script)
  self.assertIn('BUILD_ARGS+=(--network host)',script)
 def test_no_new_worker_or_binding_dependency(self):
  code=(DEMO/'lib-network/post_install.py').read_text()
  self.assertNotIn('wrangler',code);self.assertNotIn('cloudflare:workers',code)

if __name__=='__main__':unittest.main(verbosity=2)
