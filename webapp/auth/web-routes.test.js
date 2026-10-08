import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {applicationRouteContext,isApplicationRoute,safeApplicationReturnPath,webRoutePath} from '../app-route.mjs';
const origin='https://dreamwheels.example';
const id='5b207d9b-aaaa-4444-8888-123456789abc';

test('every approved screen has a reloadable same-origin route',()=>{
 const routes={dashboard:'/',create:'/create',renders:'/history',wallet:'/balance',settings:'/account',support:'/help','photo-guide':'/help/photos',docs:'/documents','render-detail':`/try-ons/${id}`,fitment:`/try-ons/${id}/compatibility`};
 for(const [view,path] of Object.entries(routes)) {
  assert.equal(webRoutePath(view,id,new URL('/?market=ru&token=secret',origin)),path+'?market=ru');
  const context=applicationRouteContext(new URL(path,origin));
  assert.equal(context.view,view);
  if(path.startsWith('/try-ons/')) assert.equal(context.jobId,id);
 }
 assert.equal(isApplicationRoute(new URL('/history',origin)),true);
 assert.equal(isApplicationRoute(new URL('/t',origin)),false);
 assert.equal(applicationRouteContext(new URL('/app/history',origin)).view,'renders');
});

test('invalid IDs and external auth returns are rejected',()=>{
 assert.equal(webRoutePath('render-detail','not-a-job',new URL('/',origin)),null);
 assert.equal(safeApplicationReturnPath('https://attacker.example/history',origin),null);
 assert.equal(applicationRouteContext(new URL('/try-ons/../../account',origin)).jobId,undefined);
 assert.equal(applicationRouteContext(new URL('/try-ons/unknown',origin)),null);
});

test('navigation pushes once and popstate restores route and scroll without pushing',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const state={view:'dashboard',applicationAuthRequired:false};
 let popstate; const opened=[]; const positions=[];
 const scroller={scrollTop:240,scrollTo:({top})=>positions.push(top)};
 const window={location:new URL('/',origin),scrollY:0,history:{pushState(_,__,path){window.location=new URL(path,origin);opened.push(path);}},addEventListener(name,fn){if(name==='popstate')popstate=fn;}};
 const context={state,window,HAS_TG:false,applicationRouteContext,webRoutePath,URLSearchParams,requestAnimationFrame:fn=>fn(),document:{querySelector:()=>scroller},setView:view=>{state.view=view;},scheduleRenderHistoryPolling(){},loadAccountState(){},openRenderDetail:job=>{state.renderDetailJobId=job;state.view='render-detail';},openFitmentView:job=>{state.fitmentJobId=job;state.view='fitment';},isApplicationAuthSessionReady:()=>true};
 const api=runInNewContext(source.slice(source.indexOf('// Browser routes are independent'))+'\n({syncWebNavigation,restoreWebRoute})',context);
 api.syncWebNavigation('renders');api.syncWebNavigation('renders');
 assert.deepEqual(opened,['/history']);
 window.location=new URL(`/try-ons/${id}`,origin);popstate();
 assert.equal(state.renderDetailJobId,id);assert.equal(state.view,'render-detail');
 window.location=new URL('/',origin);popstate();
 assert.equal(state.view,'dashboard');assert.equal(positions.at(-1),240);
 assert.equal(opened.length,1);
});

test('Vercel serves HTML for direct routes without swallowing backend requests',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.rewrites[0].source,'/api/backend/(.*)');
 for (const rule of config.headers) for (const header of rule.headers) { assert.equal(typeof header.key,'string'); assert.equal(typeof header.value,'string'); }
 for(const path of ['/history','/create','/balance','/account','/help','/help/photos','/documents','/try-ons/(.*)']) assert.ok(config.rewrites.some(r=>r.source===path&&r.destination==='/index.html'));
});

test('a reloaded processing job polls only that job and stops after completion',async()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const state={view:'render-detail',renderDetailJobId:id,renderHistory:[{job_id:id,status:'processing'},{job_id:'other',status:'processing'}],feedbackByJob:{}};
 let scheduled=0;let rendered=0;const fetched=[];
 const context={state,document:{hidden:false},POLL_INTERVAL_MS:10,setTimeout:()=>++scheduled,clearTimeout(){},hasFrontendAuth:()=>true,renderRenders(){},renderDashboard(){},renderRenderDetail(){rendered++;},authenticatedFetch:async url=>{fetched.push(url);return {ok:true,json:async()=>({status:'completed'})};},apiUrl:x=>x,withAuthHeaders:()=>({})};
 const start=source.indexOf('function clearRenderHistoryPolling()');
 const end=source.indexOf('function vnextDashboardJobViewModel',start);
 const api=runInNewContext(source.slice(start,end)+'\n({scheduleRenderHistoryPolling,refreshProcessingHistoryJobs})',context);
 api.scheduleRenderHistoryPolling();assert.equal(scheduled,1);
 await api.refreshProcessingHistoryJobs();
 assert.deepEqual(fetched,[`/jobs/${id}`]);assert.equal(rendered,1);
 api.scheduleRenderHistoryPolling();assert.equal(scheduled,1);
});
