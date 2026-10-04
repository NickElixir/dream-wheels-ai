import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { historyMarkup, resultMarkup, processingMarkup } from '../webapp/vnext/views/render.js';

const source = fs.readFileSync(new URL('../webapp/app.js', import.meta.url), 'utf8');
const fn = name => {
  const start=source.indexOf(`function ${name}(`);
  return source.slice(start,source.indexOf('\n}',start)+2);
};
const i18n = source.slice(source.indexOf('const I18N ='), source.indexOf('function detectLocale()'));
function model(status, billing, locale = 'ru', overrides = {}) {
  const context = {job: {render_billing_status: billing}};
  vm.runInNewContext(`${i18n}\nconst locale=${JSON.stringify(locale)};\n${fn('t')}\n${fn('renderFailureCopy')}\n${fn('renderBillingMessage')}\nthis.copy=renderFailureCopy(); this.billing=renderBillingMessage(job);`, context);
  return {jobId:'job-1', status, title:'Lexus RX', failureCopy:context.copy, billingMessage:context.billing, originalUrl:'https://source.test/original', resultUrl:status==='completed'?'https://result.test/image':'', statusLabel:'Не удалось', dateLabel:'4 октября', createdLabel:'12:00', ...overrides};
}
for (const locale of ['ru','en']) {
  for (const billing of ['refunded','unknown','reserved','charged',undefined]) {
    test(`failed ${billing} ${locale}: one failure, safe billing, source photo`, () => {
      const job = model('failed',billing,locale);
      for (const html of [resultMarkup(job), processingMarkup(job), historyMarkup({rows:[{...job, thumbnailUrl:job.originalUrl, thumbnailKind:'original'}]})]) {
        assert.equal(html.split(job.failureCopy.generationFailed).length-1,1);
        assert.equal(html.includes(locale==='ru'?'Кредит за этот рендер не списан':'You were not charged'),billing==='refunded');
        assert.doesNotMatch(html,/временно недоступно|temporarily unavailable|Результат примерки/);
        assert.match(html,/data-render-image="original"/);
        assert.match(html,/data-render-action="retry-create"/);
      }
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
