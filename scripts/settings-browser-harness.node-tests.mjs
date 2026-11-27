import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launchWithStartupRetry, BrowserCleanupError, resolveAsset, serveBuild } from './settings-browser-harness.mjs';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('startup retry returns the first working browser and stops',async()=>{
  const attempts=[],logs=[],browser={id:'test'};
  const result=await launchWithStartupRetry(async number=>{
    attempts.push(number);
    if(number===1)throw Error('port file unavailable');
    return browser;
  },message=>logs.push(message));
  assert.equal(result,browser);
  assert.deepEqual(attempts,[1,2]);
  assert.equal(logs.length,1);
  assert.match(logs[0],/port file unavailable/);
});
test('failed startup exposes both failures without an unbounded retry',async()=>{
  let attempts=0;
  await assert.rejects(launchWithStartupRetry(async number=>{
    attempts++;throw Error('failure '+number);
  },()=>{}),/Attempt 1: failure 1[\s\S]*Attempt 2: failure 2/);
  assert.equal(attempts,2);
});
test('cleanup failure blocks the next browser launch',async()=>{
  let attempts=0;
  await assert.rejects(launchWithStartupRetry(async()=>{
    attempts++;throw new BrowserCleanupError('orphan browser');
  },()=>{}),/orphan browser/);
  assert.equal(attempts,1);
});
test('application failures after successful startup are not retried',async()=>{
  let attempts=0;
  const browser=await launchWithStartupRetry(async()=>{attempts++;return {check(){throw Error('assertion failed');}};});
  assert.throws(()=>browser.check(),/assertion failed/);
  assert.equal(attempts,1);
});
test('invalid startup limits are rejected before any attempt',async()=>{
  for(const count of [0,4,1.5,Infinity])await assert.rejects(launchWithStartupRetry(()=>{throw Error('unexpected');},()=>{},count),/Invalid/);
});
test('asset resolver stays inside the disposable build root',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-harness-'));
  try{
    assert.equal(resolveAsset(root,'/'),join(root,'index.html'));
    assert.equal(resolveAsset(root,'/assets/main.js'),join(root,'assets','main.js'));
    assert.equal(resolveAsset(root,'/..%2foutside'),null);
    assert.equal(resolveAsset(root,'/bad%5cname'),null);
    assert.equal(resolveAsset(root,'/bad%00name'),null);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('build server returns only supported local files, rejects methods and closes connections',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-harness-'));
  let server;
  try{
    await writeFile(join(root,'index.html'),'<h1>test</h1>');
    await mkdir(join(root,'assets'));
    await writeFile(join(root,'assets','main.js'),'export const value=1;');
    server=await serveBuild(root);
    const index=await fetch(server.url);
    assert.equal(index.status,200);
    assert.equal(await index.text(),'<h1>test</h1>');
    assert.equal(index.headers.get('cache-control'),'no-store');
    const head=await fetch(server.url+'/assets/main.js',{method:'HEAD'});
    assert.equal(head.status,200);assert.equal(await head.text(),'');
    assert.match(head.headers.get('content-type'),/javascript/);
    assert.equal((await fetch(server.url+'/missing')).status,404);
    assert.equal((await fetch(server.url+'/assets')).status,404);
    assert.equal((await fetch(server.url,{method:'POST'})).status,405);
  }finally{
    if(server)await server.close();
    await rm(root,{recursive:true,force:true});
  }
});
