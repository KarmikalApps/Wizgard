import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {ProcessFreezer} from '../server/process-control.mjs';
test('native Pause freezes only the owned process and Resume preserves it',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),freezer=new ProcessFreezer(root);
 const create=()=>spawn(process.execPath,['-e',"setInterval(()=>process.stdout.write('.'),40)"],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 const child=create(),other=create();let own=0,unrelated=0;
 child.stdout.on('data',b=>own+=b.length);other.stdout.on('data',b=>unrelated+=b.length);
 try{
  await delay(300);await freezer.pause([child.pid]);await delay(150);const before=own,otherBefore=unrelated;await delay(250);
  assert.equal(own,before);assert.ok(unrelated>otherBefore);assert.equal(child.exitCode,null);
  await freezer.resume();await delay(150);assert.ok(own>before);assert.equal(child.exitCode,null);
 }finally{await freezer.resume();child.kill();other.kill();}
});
