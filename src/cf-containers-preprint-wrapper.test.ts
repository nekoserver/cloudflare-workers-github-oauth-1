import { it, expect } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('preprint adapter reports installed package version and preserves native arguments and supplied ENV',()=>{
 const path='containers/demo/preprint-cli';
 expect(existsSync(path)).toBe(true);if(!existsSync(path))return;
 const dir=mkdtempSync(join(tmpdir(),'preprint-wrapper-'));
 try{
  const pkg=join(dir,'package.json'),native=join(dir,'native'),wrapper=join(dir,'wrapper');
  writeFileSync(pkg,JSON.stringify({version:'0.1.2'}));
  writeFileSync(native,'#!/bin/sh\nprintf "%s\\n%s\\n%s\\n" "$AGENT_BROWSER_EXECUTABLE_PATH" "$AGENT_BROWSER_ARGS" "$@"\n',{mode:0o755});
  const script=readFileSync(path,'utf8').replaceAll('/opt/node22/bin/node',process.execPath).replaceAll('/opt/node22/lib/node_modules/@supermemory/preprint/package.json',pkg).replaceAll('/opt/node22/bin/preprint-native',native);
  writeFileSync(wrapper,script,{mode:0o755});
  expect(execFileSync(wrapper,['--version'],{encoding:'utf8'}).trim()).toBe('0.1.2');
  const env={...process.env,AGENT_BROWSER_EXECUTABLE_PATH:'/chosen/chrome',AGENT_BROWSER_ARGS:'--existing-flag'};
  const out=execFileSync(wrapper,['open','https://example.com/a?x=1','--context','two words'],{env,encoding:'utf8'});
  expect(out).toContain('/chosen/chrome\n');expect(out).toContain('--existing-flag');
  expect(out.trim().split('\n').slice(2)).toEqual(['open','https://example.com/a?x=1','--context','two words']);
  if(process.getuid?.()===0)expect(out).toContain('--no-sandbox');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
