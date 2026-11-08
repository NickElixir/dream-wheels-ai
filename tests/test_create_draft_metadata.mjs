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
function storageHarness() {
    let record={owner:'account:42',car:{name:'old-car'},wheel:{name:'old-wheel'},productUrl:'old',catalog:{skuId:'old'}};
    const scope={owner:'account:42',isCurrent:()=>true};
    const store={update:async(owner,change)=>{assert.equal(owner,'account:42');record=change(record);return record;},read:async()=>({draft:record,legacyAvailable:false})};
    const state={createProductUrlSaveToken:0,createInputVersion:0,rimProductUrl:'',files:{}};
    const context={state,URL,Blob,draftScope:()=>scope,getAccountDraftStore:()=>store,notifyCreateBridge(){},renderPreviewFromFile(){},resolveCatalogSelection:()=>null,dismissedLegacyOwners:new Set()};
    vm.runInNewContext(['draftFileRecord','saveDraftFiles','saveDraftFile','deleteDraftFile','createProductUrlValue','hydrateFilesFromDraft'].map(fn).join('\n'),context);
    return {context,get record(){return record;}};
}
test('pair replacement commits both photos and link under one owner',async()=>{
    const app=storageHarness();await app.context.saveDraftFiles([{kind:'car',file:{name:'new-car'}},{kind:'wheel',file:{name:'new-wheel'}}],{productUrl:'https://shop.test/new'});
    assert.equal(app.record.car.name,'new-car');assert.equal(app.record.wheel.name,'new-wheel');assert.equal(app.record.productUrl,'https://shop.test/new');
});
test('wheel replacement/removal clears saved URL and SKU; car replacement preserves them',async()=>{
    const app=storageHarness();await app.context.saveDraftFile('car',{name:'car'},new ArrayBuffer(1));assert.equal(app.record.productUrl,'old');assert.equal(app.record.catalog.skuId,'old');
    await app.context.saveDraftFile('wheel',{name:'wheel'},new ArrayBuffer(1));assert.equal(app.record.productUrl,'');assert.equal(app.record.catalog,null);assert.equal(app.record.car.name,'car');
    await app.context.deleteDraftFile('wheel');assert.equal(app.record.wheel,null);assert.equal(app.record.car.name,'car');
});
test('hydration restores only current owner URL and preserves newer input',async()=>{
    const app=storageHarness();app.record.productUrl='https://shop.test/stored';await app.context.hydrateFilesFromDraft();assert.equal(app.context.state.rimProductUrl,'https://shop.test/stored');
    app.context.state.rimProductUrl='https://shop.test/newer';await app.context.hydrateFilesFromDraft();assert.equal(app.context.state.rimProductUrl,'https://shop.test/newer');
});
test('catalog wheel replacement commits its single SKU without touching car',async()=>{
    const app=storageHarness();const catalog={skuId:'one',owner:'account:42'};await app.context.saveDraftFiles([{kind:'wheel',file:{name:'catalog'}}],{catalog});assert.equal(app.record.catalog,catalog);assert.equal(app.record.car.name,'old-car');
});
