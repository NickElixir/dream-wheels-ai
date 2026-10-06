import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { extractDeclaration } from '../../tests/helpers/source-extract.mjs';
import { fitmentMarkup } from '../vnext/views/fitment.js';
import { resultMarkup, historyMarkup } from '../vnext/views/render.js';
import { COPY, copy } from '../vnext/copy.mjs';
const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');

test('P3-B Result preserves repeat/check/download order and secondary row without Fitment',()=>{
 for(const canFitment of [true,false]){
  const html=resultMarkup({locale:'ru',status:'completed',jobId:'a',canFitment,canDownload:true,resultUrl:'/result',originalUrl:'/original',rimName:'BBS',rimSku:'2481081'});
  assert.ok(html.indexOf('data-render-action="repeat"')<html.indexOf('data-render-action="download"'));
  if(canFitment)assert.ok(html.indexOf('data-render-action="fitment"')<html.indexOf('data-render-action="download"'));
  else assert.doesNotMatch(html,/data-render-action="fitment"/);
  assert.match(html,/vnext-result-secondary/);assert.match(html,/Артикул 2481081/);
 }
 assert.doesNotMatch(resultMarkup({locale:'ru',jobId:'a',status:'completed',rimName:'BBS'}),/Артикул/);
 assert.match(resultMarkup({locale:'ru',jobId:'a',status:'completed',rimSku:'2481081'}),/Артикул 2481081/);
});

test('P3-B failed Fitment has one failure, primary retry and explained disable',()=>{
 for(const retryAvailable of [true,false]){
  const html=fitmentMarkup({locale:'ru',overview:{},executionStatus:'failed',check:{execution_status:'failed'},nextAction:'run_standard_check',canRunCheck:true,retryAvailable});
  assert.equal(html.split('Проверку выполнить не удалось').length-1,1);
  assert.match(html,/Данные сохранены — вводить их заново не нужно\./);
  assert.match(html,/vnext-button--primary[^>]*data-fitment-action="check"/);
  assert.match(html,/vnext-button--secondary[^>]*data-fitment-action="create-image"/);
  if(!retryAvailable)assert.match(html,/data-fitment-action="check"[^>]*disabled[\s\S]*Повтор этой проверки недоступен\./);
  assert.doesNotMatch(html,/result-panel[^]*data-fitment-action="edit-rim"/);
 }
});

test('P3-B summary and separate SKU preserve canonical vehicle summary',()=>{
 for(const sku of ['2481081','']){
  const html=fitmentMarkup({locale:'ru',overview:{},rimTitle:'Tech Line TL901',rimSku:sku,canonicalVehicleSummary:'EV – 2023',canonicalWheelSummary:'Tech Line TL901 · 19″ / 8J / 5×108 / DIA 63,4 / ET 45'});
  assert.match(html,/>Итог<\/h2>/);assert.match(html,/<strong>EV – 2023<\/strong>/);
  assert.match(html,/<strong>Tech Line TL901 · 19″/);
  if(sku)assert.match(html,/identity-code">Артикул 2481081/);else assert.doesNotMatch(html,/identity-code/);
 }
});

test('P3-B wheel values omit ET prefix and picker labels distinguish empty values',()=>{
 for(const offset of ['',45]){
  const html=fitmentMarkup({locale:'ru',overview:{},rimEditing:true,rim:{offset_et_mm:offset}});
  assert.match(html,offset===''?/>Выбрать ▾<\/button>/:/>Выбрать другое ▾<\/button>/);
  if(offset!== ''){assert.match(html,/>45<\/button>/);assert.doesNotMatch(html,/>ET 45<\/button>/);assert.match(html,/aria-label="Подтверждено ET 45"/);}
 }
});

test('P3-B completed History has group date once and time separate from specs',()=>{
 const rows=[1,2].map(id=>({jobId:String(id),status:'completed',title:'Car',rimName:'BBS',specs:'19 × 8,5J',dateLabel:'Сегодня',createdLabel:'Сегодня 10:34',timeLabel:'10:34',statusLabel:'Готово'}));
 const html=historyMarkup({locale:'ru',rows});assert.equal(html.split('Сегодня').length-1,1);
 assert.match(html,/>BBS · 19 × 8,5J<\/p>/);assert.match(html,/history-time">10:34/);assert.doesNotMatch(html,/Готово|vnext-status--positive/);
});

test('P3-B dashboard selects completed while keeping recent statuses and detects newer failed job',()=>{
 const source=read('../app.js');const completed={job_id:'old',status:'completed'},failed={job_id:'new',status:'failed'};
 const ctx={state:{renderHistory:[failed,completed],balance:3},locale:'ru',buildRenderExpiryCohorts:()=>[],formatRenderCount:String,vnextDashboardJobViewModel:x=>x,localizeErrorMessage:String,isFrontendUserAuthenticated:()=>true,isSupabasePartialAuth:()=>false};
 vm.createContext(ctx);vm.runInContext(extractDeclaration(source,'vnextDashboardSnapshot')+'\nthis.snapshot=vnextDashboardSnapshot;',ctx);
 const snap=ctx.snapshot();assert.equal(snap.latest,completed);assert.equal(snap.latestFailed,true);assert.equal(snap.recent[0],failed);
 ctx.state.renderHistory=[failed];assert.equal(ctx.snapshot().latest,null);
});

test('P3-B History dates use local calendar days including previous-day boundary',()=>{
 const src=read('../app.js'),ctx={locale:'ru',uiCopy:copy,formatShortDate:()=> 'old'};vm.createContext(ctx);vm.runInContext(extractDeclaration(src,'vnextHistoryDateLabel')+'\nthis.label=vnextHistoryDateLabel;',ctx);
 const today=new Date(),yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
 assert.equal(ctx.label(today.toISOString()),'Сегодня');assert.equal(ctx.label(yesterday.toISOString()),'Вчера');assert.equal(ctx.label('bad'),'');
});

test('P3-B new localized keys have EN without Cyrillic',()=>{
 for(const key of ['render.downloadShort','render.checkShort','fitment.summary.title','fitment.failure.saved','fitment.retry.unavailable','fitment.retry.confirmDetails','fitment.selectEmpty','fitment.selectOther','fitment.selectEmptyAria','fitment.table.autoShort','history.today','history.yesterday','dashboard.latestFailed','dashboard.openHistory']){
  assert.ok(COPY[key].ru);assert.ok(COPY[key].en);assert.doesNotMatch(COPY[key].en,/[А-Яа-яЁё]/);
 }
});

test('P3-B Result SKU projects only existing snapshot fields without changing job state',()=>{
 const ctx={locale:'ru',state:{downloadNoticeByJob:{},feedbackBusyByJob:{},feedbackErrorByJob:{},feedbackNoticeByJob:{}},FEEDBACK_REASONS:[],vnextRimSpecs:()=> '19″ / 8,5J',humanRenderTitle:()=> 'Car',formatDateTime:String,vnextHistoryDateLabel:()=> 'Сегодня',renderFailureCopy:()=>({}),renderBillingMessage:()=>'',statusLabel:()=>'',assetUrlForJob:()=>'',hasAssetLoadError:()=>false,hasAssetSource:()=>false,fitmentAvailable:()=>false,isAssetAvailable:()=>false,feedbackSentimentForJob:()=>'',feedbackReasonForJob:()=>''};
 vm.createContext(ctx);vm.runInContext(extractDeclaration(read('../app.js'),'vnextRenderJob')+'\nthis.project=vnextRenderJob;',ctx);
 for(const rim of [{sku:'2481081'},{selected_variant_sku:'2481081'},{}]){
  const job={job_id:'a',status:'completed',created_at:'2026-10-06T10:34:00Z',render_input_snapshot:{rim}};const before=JSON.stringify(job),model=ctx.project(job);
  assert.equal(model.rimSku,rim.sku||rim.selected_variant_sku||'');assert.match(model.timeLabel,/^\d{2}:\d{2}$/);assert.equal(JSON.stringify(job),before);assert.equal(model.status,'completed');
 }
});
