import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {resultMarkup} from '../vnext/views/render.js';

const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('const publicationRequests =');
const end=source.indexOf('function vnextRenderJob',start);
function runtime(fetcher){
 const navigations=[];
 const context={URL,authenticatedFetch:fetcher,apiUrl:p=>p,withAuthHeaders:()=>({Authorization:'Bearer owner'}),notifyRenderBridge:()=>{},window:{location:{assign:url=>navigations.push(url)}}};
 vm.runInNewContext(source.slice(start,end)+'\nglobalThis.publish=publishRender;globalThis.errors=publicationErrors;globalThis.pending=publicationRequests;',context);
 return {context,navigations};
}
test('share posts with owner credentials and navigates directly without clipboard UI',async()=>{
 let requested;
 const {context,navigations}=runtime(async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({url:'https://example.test/p/opaque'})};});
 await context.publish('job');
 assert.equal(requested.url,'/jobs/job/publications');
 assert.equal(requested.options.method,'POST');
 assert.equal(requested.options.headers.Authorization,'Bearer owner');
 assert.deepEqual(navigations,['https://example.test/p/opaque']);
 assert.equal(context.pending.size,0);
});
test('rapid duplicate click submits one request; failure remains retryable',async()=>{
 let release,calls=0;
 const {context,navigations}=runtime(()=>{calls++;return new Promise(r=>release=r);});
 const first=context.publish('job');await context.publish('job');assert.equal(calls,1);
 release({ok:false});await first;
 assert.equal(context.pending.size,0);assert.equal(context.errors.has('job'),true);assert.deepEqual(navigations,[]);
});
test('unsafe publication URL never navigates',async()=>{
 const {context,navigations}=runtime(async()=>({ok:true,json:async()=>({url:'javascript:alert(1)'})}));
 await context.publish('job');assert.deepEqual(navigations,[]);assert.equal(context.errors.has('job'),true);
});
test('result actions group export separately from continuation and disable pending share',()=>{
 const markup=resultMarkup({locale:'ru',jobId:'job',status:'completed',canDownload:true,canFitment:true,resultUrl:'/result',originalUrl:'/original',sharing:true});
 assert.match(markup,/vnext-result-export/);assert.match(markup,/vnext-result-continue/);
 assert.match(markup,/data-render-action="share"[^>]*disabled/);
 assert.ok(markup.indexOf('data-render-action="download"')<markup.indexOf('data-render-action="share"'));
 assert.ok(markup.indexOf('data-render-action="share"')<markup.indexOf('data-render-action="fitment"'));
 assert.ok(markup.indexOf('data-render-action="fitment"')<markup.indexOf('data-render-action="repeat"'));
});
