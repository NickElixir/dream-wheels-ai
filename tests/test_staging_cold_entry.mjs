import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractFunction} from './helpers/source-extract.mjs';
import {applicationRouteContext} from '../webapp/app-route.mjs';
const source=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
const fn=name=>extractFunction(source,name);
function projection(state) {
 const ctx={state,locale:'ru',FEEDBACK_REASONS:[],vnextRimSpecs:rim=>String(rim.et??''),humanRenderTitle:()=>'',formatDateTime:()=>'',vnextHistoryDateLabel:()=>'',renderFailureCopy:()=>({}),renderBillingMessage:()=>'',statusLabel:()=>'',assetUrlForJob:()=>'',hasAssetLoadError:()=>false,hasAssetSource:()=>false,fitmentAvailable:()=>false,isAssetAvailable:()=>false,feedbackSentimentForJob:()=>'',feedbackReasonForJob:()=>''};
 Object.assign(state,{downloadNoticeByJob:{},feedbackBusyByJob:{},feedbackErrorByJob:{},feedbackNoticeByJob:{}});
 vm.runInNewContext(`${fn('fitmentEffectiveRim')}\n${fn('vnextRenderJob')}\nthis.project=vnextRenderJob;`,ctx);return ctx.project;
}
test('result uses saved canonical wheel, isolates jobs and ignores unsaved form',()=>{
 const state={fitmentJobId:'a',fitmentOverview:{front_rim:{rim:{brand:'VORSTEINER',model:'LK013',et:38}},rim:{model:'obsolete'}},fitmentContextByJob:{},fitmentForm:{rim:{model:'unsaved'}}};
 const project=projection(state),job={job_id:'a',render_input_snapshot:{rim:{model:'old',et:20}}};
 assert.equal(project(job).rimName,'VORSTEINER LK013');assert.equal(project(job).specs,'38');
 assert.equal(project({...job,job_id:'b'}).rimName,'old');
 state.fitmentContextByJob.a=state.fitmentOverview;state.fitmentOverview=null;
 assert.equal(project(job).rimName,'VORSTEINER LK013');
 state.fitmentContextByJob.a={front_rim:{rim:{}}};assert.equal(project(job).rimName,'');
});
test('cold direct result route is loading before selected job initialization',()=>{
 const id='94121a9d-d0bb-4a87-824f-74c742c2a66e';
 const location=new URL(`https://example.test/try-ons/${id}`);
 const ctx={state:{renderDetailJobId:'',renderHistory:[],applicationRoute:null},window:{location},locale:'ru',applicationRouteContext:input=>applicationRouteContext(input,location.origin)};
 vm.runInNewContext(`${fn('vnextRenderSnapshot')}\nthis.snapshot=vnextRenderSnapshot;`,ctx);
 assert.equal(ctx.snapshot('render-detail').requestedJobId,id);assert.equal(ctx.snapshot('render-detail').loading,true);
 ctx.state.renderDetailJobId=id;ctx.state.renderDetailNotFoundJobId=id;assert.equal(ctx.snapshot('render-detail').loading,false);
});
test('late fitment preview requests deduplicate and allow retry after failure',async()=>{
 let requests=0,release;
 const ctx={state:{renderAssetBlobUrlsByJob:{}},isGuestRenderJob:()=>false,hasFrontendAuth:()=>true,apiUrl:x=>x,withAuthHeaders:()=>({}),authenticatedFetch:()=>{requests++;return new Promise(resolve=>{release=resolve;});},URL:{createObjectURL:()=> 'blob:photo',revokeObjectURL:()=>{}},renderFitment:()=>{}};
 vm.runInNewContext(`${fn('ensureFitmentPreviewAsset')}\nthis.ensure=ensureFitmentPreviewAsset;`,ctx);
 const job={job_id:'a',assets:{rim_original:{download_url:'/photo'}}};
 const pending=ctx.ensure(job,'rim');await ctx.ensure(job,'rim');assert.equal(requests,1);release({ok:false});await pending;
 const retry=ctx.ensure(job,'rim');assert.equal(requests,2);release({ok:true,blob:async()=>({})});await retry;
 assert.equal(ctx.state.renderAssetBlobUrlsByJob.a.rim_original,'blob:photo');await ctx.ensure(job,'rim');assert.equal(requests,2);
});
