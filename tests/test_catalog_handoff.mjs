import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogHandoffController, captureCatalogHandoff, readCatalogHandoff, resolveCatalogSelection, catalogRimProposal, HANDOFF_KEY } from '../webapp/vnext/catalog-handoff.mjs';
import { catalogEntries } from '../webapp/vnext/catalog-data.mjs';
import { safeApplicationReturnPath } from '../webapp/app-route.mjs';
const selected = catalogEntries.find(x => x.selectedSkuId);
const value = () => ({ version:1, variantId:selected.variantId, skuId:selected.selectedSkuId, locale:'en', source:'catalog', utm:{utm_source:'test'},createdAt:Date.now() });
function storage() { const map=new Map(); return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}; }
function harness(options={}) {
    const store=storage();store.setItem(HANDOFF_KEY,JSON.stringify(value()));
    const context={authenticated:true,owner:'alice',account:'alice',version:0,wheel:null,catalog:null};
    const writes=[];let applications=0;
    const controller=new CatalogHandoffController({storage:store,current:()=>context,
        fetchImage:async()=>({ok:true,blob:async()=>new Blob(['wheel'],{type:'image/webp'})}),
        isReady:()=>true,verifyImage:async()=>true,
        persist:async(file,metadata,operation)=>{if(operation.isCurrent())writes.push({file,metadata});},
        apply:(file,metadata)=>{applications++;context.wheel=file;context.catalog=metadata;},publish:()=>{},...options});
    return {controller,store,context,writes,applications:()=>applications};
}
test('catalog contract selects canonical pair+execution and rejects arbitrary image/SKU',()=>{
    assert.ok(resolveCatalogSelection(value()));
    assert.equal(resolveCatalogSelection({...value(),skuId:'https://evil.test/rim'}),null);
    assert.equal(resolveCatalogSelection({...value(),variantId:'missing'}),null);
    const proposal=catalogRimProposal(value());assert.equal(proposal.sku,selected.skus[0].sku);assert.equal(proposal.source,'user_input');assert.equal(proposal.confidence,0);
    assert.equal(proposal.vehicle,undefined);
});
test('capture is durable before URL cleanup; IDs and locale survive auth return via session storage',()=>{
    const store=storage();const url=new URL(`https://app.dreamwheels.pro/new?catalog_variant=${selected.variantId}&catalog_sku=${selected.selectedSkuId}&catalog_locale=en&catalog_source=catalog&utm_source=mail&secret=drop`);
    const captured=captureCatalogHandoff(url,store);
    assert.equal(captured.value.locale,'en');assert.equal(captured.cleanUrl.includes('catalog_variant'),false);
    assert.equal(readCatalogHandoff(store).utm.utm_source,'mail');
    assert.equal(safeApplicationReturnPath(new URL(captured.cleanUrl,url.origin),url.origin),'/new?utm_source=mail');
    assert.equal(captureCatalogHandoff(new URL('/help?catalog_variant=x',url.origin),store),null);
    const failed=captureCatalogHandoff(new URL(`https://app.dreamwheels.pro/new?catalog_variant=${selected.variantId}&catalog_sku=${selected.selectedSkuId}&catalog_locale=en&catalog_source=catalog`),{setItem(){throw Error('quota');}});
    assert.equal(failed.error,'storage');assert.equal(failed.cleanUrl,undefined);
});
test('expired, malformed and future intent never hydrates; invalid links do not revive old selection',()=>{
    const store=storage();store.setItem(HANDOFF_KEY,JSON.stringify({...value(),createdAt:0}));assert.equal(readCatalogHandoff(store),null);
    store.setItem(HANDOFF_KEY,JSON.stringify({...value(),createdAt:Date.now()+100000}));assert.equal(readCatalogHandoff(store),null);
    store.setItem(HANDOFF_KEY,JSON.stringify(value()));assert.equal(captureCatalogHandoff(new URL('https://app.dreamwheels.pro/new?catalog_variant=bad'),store).error,'invalid');assert.equal(readCatalogHandoff(store),null);
});
test('guest does not fetch or apply; after login empty form receives wheel without a car or render',async()=>{
    const h=harness();h.context.authenticated=false;await h.controller.resume();assert.equal(h.writes.length,0);
    h.context.authenticated=true;await h.controller.resume();assert.equal(h.writes.length,1);assert.equal(h.applications(),1);assert.equal(h.store.getItem(HANDOFF_KEY),null);assert.equal(h.context.car,undefined);
});
test('conflicting photo remains intact until confirmation; decline stays consumed across reload',async()=>{
    const h=harness();const wheel={blob:'manual'};h.context.wheel=wheel;await h.controller.resume();assert.equal(h.writes.length,0);assert.equal(h.context.wheel,wheel);
    h.controller.dismiss();await h.controller.resume();assert.equal(h.controller.pending,null);assert.equal(h.applications(),0);assert.equal(h.context.wheel,wheel);
});
test('same pair and execution in durable draft consumes replay without downloading again',async()=>{
    const h=harness();h.context.wheel={};h.context.catalog=value();await h.controller.resume();assert.equal(h.applications(),0);assert.equal(h.store.getItem(HANDOFF_KEY),null);
});
test('fetch failure preserves both current files and supports retry from saved intent',async()=>{
    const h=harness({fetchImage:async()=>{throw Error('offline');}});const wheel={};h.context.wheel=wheel;await h.controller.resume();await h.controller.accept();assert.equal(h.context.wheel,wheel);assert.equal(h.controller.error,'image');assert.ok(h.store.getItem(HANDOFF_KEY));
    h.controller.fetchImage=async()=>({ok:true,blob:async()=>new Blob(['ok'],{type:'image/webp'})});await h.controller.accept();assert.equal(h.applications(),1);
});
test('late image response after edit or account change cannot mutate draft',async()=>{
    for(const change of [h=>h.context.version++,h=>h.context.owner='bob',h=>h.context.authenticated=false]) {
        let finish;const h=harness({fetchImage:()=>new Promise(resolve=>finish=resolve)});
        const pending=h.controller.resume();change(h);finish({ok:true,blob:async()=>new Blob(['ok'],{type:'image/webp'})});await pending;assert.equal(h.writes.length,0);assert.equal(h.applications(),0);
    }
});
test('pending decision is bound to the first authenticated account',async()=>{
    const h=harness();h.context.wheel={};await h.controller.resume();h.context.account='bob';h.context.owner='bob';await h.controller.resume();assert.equal(h.controller.pending,null);assert.equal(h.applications(),0);
});
test('duplicate confirm is single-flight; durable failure leaves old wheel and intent',async()=>{
    let finish;const h=harness({persist:()=>new Promise((resolve,reject)=>finish=()=>reject(Error('quota')))});h.context.wheel={};await h.controller.resume();const pending=h.controller.accept();await Promise.resolve();await Promise.resolve();await h.controller.accept();finish();await pending;assert.equal(h.applications(),0);assert.ok(h.controller.pending);assert.equal(h.controller.error,'storage');
});
test('timeout exposes retry and preserves the previous wheel',async(t)=>{
    t.mock.timers.enable({apis:['setTimeout']});
    const h=harness({fetchImage:(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});
    const previous={};h.context.wheel=previous;await h.controller.resume();const pending=h.controller.accept();t.mock.timers.tick(12000);await pending;
    assert.equal(h.controller.error,'timeout');assert.equal(h.controller.busy,false);assert.equal(h.context.wheel,previous);assert.ok(h.controller.pending);
});
test('non-image response cannot enter the upload draft',async()=>{
    const h=harness({fetchImage:async()=>({ok:true,blob:async()=>new Blob(['<html>'],{type:'text/html'})})});await h.controller.resume();assert.equal(h.writes.length,0);assert.equal(h.controller.error,'image');
});
test('timeout unlocks retry even when draft storage never settles; a late completion cannot apply',async(t)=>{
    t.mock.timers.enable({apis:['setTimeout']});
    let finish,transactionAborted=false,lateIsCurrent,reached;
    const entered=new Promise(resolve=>reached=resolve);
    const h=harness({persist:(file,metadata,{isCurrent,operation})=>new Promise(resolve=>{lateIsCurrent=isCurrent;operation.abortDraft=()=>{transactionAborted=true;};finish=resolve;reached();})});
    h.context.wheel={};await h.controller.resume();const pending=h.controller.accept();await entered;
    t.mock.timers.tick(12000);assert.equal(h.controller.busy,false);assert.equal(h.controller.error,'timeout');assert.equal(transactionAborted,true);assert.equal(lateIsCurrent(),false);
    finish();await pending;assert.equal(h.applications(),0);
});
