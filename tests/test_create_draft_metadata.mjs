import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {extractFunction} from './helpers/source-extract.mjs';
const source = fs.readFileSync(new URL('../webapp/app.js', import.meta.url), 'utf8');
const fn = name => extractFunction(source, name);
const bridgeSource = source.slice(source.indexOf('window.dreamwheelsCreateBridge = {'), source.indexOf('\nfunction showCreateScreen'));
function bridgeHarness(persist) {
    const state = {files:{wheel:{}},rimProductUrl:'',createProductUrlSaveToken:0};
    const context = {state,locale:'ru',window:{},URL,vnextCreateSnapshot:()=>{},notifyCreateBridge(){},renderCreateInputs(){},persistCreateProductUrl:persist};
    vm.runInNewContext(fn('createProductUrlValue')+'\n'+bridgeSource, context);
    return {state,save:value=>context.window.dreamwheelsCreateBridge.saveRimProductUrl(value)};
}
test('saved-link feedback waits for durable commit and reports storage failure', async () => {
    let finish;
    const pending = new Promise(resolve=>finish=resolve);
    const {state,save} = bridgeHarness(async()=>pending);
    const saving=save('https://shop.example.test/wheel');
    assert.equal(state.rimProductUrl,'');
    finish(); await saving;
    assert.equal(state.rimProductUrl,'https://shop.example.test/wheel');
    const failed=bridgeHarness(async()=>{throw Error('quota');});
    await failed.save('https://shop.example.test/wheel');
    assert.equal(failed.state.rimProductUrl,'');
    assert.match(failed.state.createProductUrlError,/Не удалось сохранить/);
});
test('late saved URL cannot replace a different wheel or a newer URL', async () => {
    const releases=[];
    const {state,save}=bridgeHarness((value,isCurrent)=>new Promise(resolve=>releases.push({resolve,isCurrent})));
    const first=save('https://shop.example.test/old');
    const second=save('https://shop.example.test/new');
    assert.equal(releases[0].isCurrent(),false);
    releases[1].resolve(); await second;
    releases[0].resolve(); await first;
    assert.equal(state.rimProductUrl,'https://shop.example.test/new');
    const third=save('https://shop.example.test/other');
    state.files.wheel={};
    releases[2].resolve(); await third;
    assert.equal(state.rimProductUrl,'https://shop.example.test/new');
});
test('pair replacement persists source link in the same transaction as both photos', async () => {
    const writes=[];
    const db={transaction(){const tx={objectStore:()=>({put:entry=>writes.push(entry)})};queueMicrotask(()=>tx.oncomplete());return tx;},close(){}};
    const context={openDraftDb:async()=>db,DRAFT_STORE_NAME:'files'};
    vm.runInNewContext(fn('saveDraftFiles'),context);
    await context.saveDraftFiles([{kind:'car',file:{name:'car'}},{kind:'wheel',file:{name:'wheel'}}],{productUrl:'https://shop.example.test/saved'});
    assert.deepEqual(writes.map(entry=>entry.kind),['car','wheel','product-url']);
    assert.equal(writes[2].value,'https://shop.example.test/saved');
});
test('wheel replacement/removal clears its saved URL; car replacement does not', async () => {
    const writes=[];
    const db={transaction(){const tx={objectStore:()=>({put:entry=>writes.push(entry),delete:key=>writes.push({deleted:key})})};queueMicrotask(()=>tx.oncomplete());return tx;},close(){}};
    const context={openDraftDb:async()=>db,DRAFT_STORE_NAME:'files'};
    vm.runInNewContext(fn('saveDraftFile')+'\n'+fn('deleteDraftFile'),context);
    await context.saveDraftFile('car',{},new ArrayBuffer(0));
    assert.equal(writes.length,1);
    await context.saveDraftFile('wheel',{},new ArrayBuffer(0));
    assert.equal(writes.at(-1).kind,'product-url');assert.equal(writes.at(-1).value,'');
    await context.deleteDraftFile('wheel');
    assert.equal(writes.at(-1).deleted,'product-url');
});
test('hydration restores saved URL and leaves newer in-memory URL intact', async () => {
    const db={transaction(){return {objectStore:()=>({get(){const request={};queueMicrotask(()=>{request.result={value:'https://shop.example.test/stored'};request.onsuccess();});return request;}})};},close(){}};
    const state={createProductUrlSaveToken:0,rimProductUrl:'',files:{}};
    const context={state,URL,openDraftDb:async()=>db,DRAFT_STORE_NAME:'files',loadDraftFile:async()=>null,renderPreviewFromFile(){}};
    vm.runInNewContext(fn('createProductUrlValue')+'\n'+fn('hydrateFilesFromDraft'),context);
    await context.hydrateFilesFromDraft();assert.equal(state.rimProductUrl,'https://shop.example.test/stored');
    state.rimProductUrl='https://shop.example.test/newer';
    await context.hydrateFilesFromDraft();assert.equal(state.rimProductUrl,'https://shop.example.test/newer');
});
