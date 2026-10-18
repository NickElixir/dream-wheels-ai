import {extractFunction, extractDeclaration} from "./helpers/source-extract.mjs";
import { copy, legacyTranslations, errorCopy } from "../webapp/vnext/copy.mjs";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { historyMarkup, resultMarkup, processingMarkup } from '../webapp/vnext/views/render.js';

const source = fs.readFileSync(new URL('../webapp/app.js', import.meta.url), 'utf8');
const fn = name => extractFunction(source,name);
const i18n = extractDeclaration(source,'I18N');
function model(status, billing, locale = 'ru', overrides = {}) {
  const context = { legacyTranslations, errorCopy, uiCopy:copy,job: {render_billing_status: billing}};
  vm.runInNewContext(`${i18n}\nconst locale=${JSON.stringify(locale)};\n${fn('t')}\n${fn('renderFailureCopy')}\n${fn('renderBillingMessage')}\nthis.copy=renderFailureCopy(); this.billing=renderBillingMessage(job);`, context);
  return {jobId:'job-1', status, title:'Lexus RX', failureCopy:context.copy, billingMessage:context.billing, originalUrl:'https://source.test/original', resultUrl:status==='completed'?'https://result.test/image':'', statusLabel:'Не удалось', dateLabel:'4 октября', createdLabel:'12:00', ...overrides};
}
for (const locale of ['ru','en']) {
  for (const billing of ['refunded','unknown','reserved','charged',undefined]) {
    test(`failed ${billing} ${locale}: one failure, safe billing, source photo`, () => {
      const job = model('failed',billing,locale);
      for (const html of [resultMarkup(job), processingMarkup(job)]) {
        assert.equal(html.split(job.failureCopy.generationFailed).length-1,1);
        assert.equal(html.includes(locale==='ru'?'Кредит за этот рендер не списан':'You were not charged'),billing==='refunded');
        assert.doesNotMatch(html,/временно недоступно|temporarily unavailable|Результат примерки/);
        assert.match(html,/data-render-image="original"/);
        assert.match(html,/data-render-action="retry-create"/);
      }
      const card = historyMarkup({locale,rows:[{...job, thumbnailUrl:job.originalUrl, thumbnailKind:'original'}]});
      assert.ok(card.includes(copy('history.failedBadge',locale)));
      assert.match(card,/data-render-image="original"/);
      assert.doesNotMatch(card,/data-render-action="retry-create"|Кредит за этот рендер не списан|You were not charged/);
    });
  }
  test(`completed missing result ${locale} stays an asset failure`, () => {
    const job=model('completed','charged',locale,{resultUrl:''});
    const html=resultMarkup(job);
    assert.ok(html.includes(job.failureCopy.assetUnavailable));
    assert.ok(!html.includes(job.failureCopy.generationFailed));
    assert.ok(!html.includes(job.failureCopy.failedBadge));
    const card=historyMarkup({rows:[{...job,thumbnailUrl:"",thumbnailFailed:true}]});
    assert.ok(card.includes(job.failureCopy.assetUnavailable));
    assert.match(html,/data-render-action="download"[^>]+disabled/);
  });
  test(`completed valid result ${locale} retains comparison`, () => {
    const html=resultMarkup(model('completed','charged',locale));
    assert.match(html,/data-compare/);
    assert.doesNotMatch(html,/vnext-render-failed|vnext-render-asset-unavailable/);
  });
}
test('missing source in failed job uses neutral placeholder', () => {
  const job=model('failed','unknown','ru',{originalUrl:''});
  const html=resultMarkup(job);
  assert.ok(html.includes(job.failureCopy.sourceUnavailable));
  assert.doesNotMatch(html,/временно|<img/);
});
test('in-context retry retains generation retry action', () => {
  const html=processingMarkup(model('failed','refunded','ru',{retryAction:'generation-retry'}));
  assert.match(html,/data-render-action="generation-retry"/);
});
test('polling merges authoritative billing without deriving it from failed', () => {
  const context={state:{renderHistory:[{job_id:'job-1',status:'processing',render_billing_status:'reserved'}]},normalizeFeedbackRecord:x=>x};
  vm.runInNewContext(`${fn('mergeStatusIntoHistory')}\nmergeStatusIntoHistory('job-1',{status:'failed',render_billing_status:'refunded'});`,context);
  assert.equal(context.state.renderHistory[0].render_billing_status,'refunded');
  vm.runInNewContext(`mergeStatusIntoHistory('job-1',{status:'failed'});`,context);
  assert.equal(context.state.renderHistory[0].render_billing_status,'unknown');
});

test('network or queue ambiguity never promises a refund', () => {
  for(const locale of ['ru','en']){
    const context={legacyTranslations,uiCopy:copy};
    vm.runInNewContext(`${i18n}\nconst locale=${JSON.stringify(locale)};\n${fn('t')}\n${fn('classifyGenerationError')}\nthis.error=classifyGenerationError('queue unavailable');`,context);
    assert.doesNotMatch(context.error.title,/не будет списан|not be charged/);
  }
});

test('result distinguishes pending load, request failure and confirmed missing job', () => {
  const loading = resultMarkup({loading:true, locale:'ru'});
  assert.match(loading,/vnext-render-loading/);
  assert.match(loading,/vnext-spinner/);
  assert.doesNotMatch(loading,/Примерка не найдена/);
  const error = resultMarkup({error:'Network unavailable', requestedJobId:'job-1', locale:'ru'});
  assert.match(error,/data-render-action="detail-retry"/);
  assert.doesNotMatch(error,/Примерка не найдена/);
  assert.match(resultMarkup({locale:'ru'}),/Примерка не найдена/);
});

test('wheel without model and parameters has a standard fitment action', () => {
  const html = resultMarkup(model('completed','charged','ru',{wheelUrl:'https://source.test/wheel',canFitment:true}));
  assert.match(html,/Модель и параметры не указаны/);
  assert.match(html,/data-render-action="rim-details"/);
  const known = resultMarkup(model('completed','charged','ru',{wheelUrl:'https://source.test/wheel',rimName:'X-Trike X-132',canFitment:true}));
  assert.doesNotMatch(known,/Модель и параметры не указаны/);
});

for (const scenario of ['success','asset-failure','left-screen']) {
  test(`restore selected source photos: ${scenario}`, async () => {
    const calls=[];
    const state={view:'fitment',fitmentJobId:'selected',files:{car:'old-car',wheel:'old-wheel'},downloadNoticeByJob:{}};
    const context={state,locale:'ru',uiCopy:copy,trackEvent:async()=>{},console:{error(){}},
      fetchJobStatusForHistory:async()=>({assets:{car_original:{download_url:'https://assets/car',kind:'car'},rim_original:{download_url:'https://assets/wheel',kind:'rim'}}}),
      fetch:async url=>{ if(scenario==='left-screen') state.view='wallet'; return {ok:scenario!=='asset-failure',blob:async()=>new Blob([url])}; },
      parseApiError:async()=> 'Asset unavailable',saveDraftFiles:async entries=>calls.push(['persist',entries.length]),
      resetCreateAssets:()=>calls.push(['reset']),renderPreviewFromFile:()=>{},showCreateScreen:()=>{},renderCreateInputs:()=>{},
      setView:view=>{state.view=view;},notifyFitmentBridge:()=>{},notifyRenderBridge:()=>{}};
    vm.runInNewContext(fn('repeatRenderWithSavedPhotos'),context);
    await context.repeatRenderWithSavedPhotos('selected');
    assert.equal(state.repeatRenderPreparing,false);
    if(scenario==='success') {assert.equal(state.view,'create');assert.equal(state.files.car.name,'car.jpg');assert.deepEqual(calls,[['persist',2],['reset']]);}
    else {assert.equal(state.files.car,'old-car');assert.equal(state.files.wheel,'old-wheel');assert.equal(calls.length,0);assert.notEqual(state.view,'create');}
  });
}
