import { copy, legacyTranslations, errorCopy } from "../vnext/copy.mjs";
import { buildFitmentRimReadiness } from "../vnext/fitment-readiness.mjs";
import { fitmentDisplayValue } from "../vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8").replace(/^import \{[\s\S]*?\} from "\.\/app-route\.mjs";\n\n/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};\nconst buildFitmentRimReadiness = ${buildFitmentRimReadiness.toString()};\n`).replace(/import \{ fitmentDisplayValue \} from "\.\/vnext\/fitment-display\.mjs";\nimport \{ buildFitmentRimReadiness \} from "\.\/vnext\/fitment-readiness\.mjs";\n\n/u, "");

function runtime() {
  const storage = { getItem: () => null, setItem() {}, removeItem() {} };
  const revoked = [];
  const errors = Object.fromEntries(['[data-error]', '[data-error-title]', '[data-error-text]', '[data-error-copy]', '[data-error-action]', '[data-error-support]'].map(key => [key, {hidden:true, textContent:'', dataset:{}}]));
  let asset = 0;
  class AssetURL extends URL {
    static createObjectURL() { return `blob:asset-${++asset}`; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = { legacyTranslations, errorCopy, uiCopy:copy,
    URL: AssetURL, URLSearchParams, Blob, FormData, console: { log() {}, warn() {}, error() {} },
    document: { documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, querySelector: (key) => errors[key] || null, querySelectorAll: () => [] },
    window: { addEventListener() {}, Telegram: {}, location: { search: "" }, dispatchEvent() {} },
    localStorage: storage, sessionStorage: storage, navigator: { language: "ru-RU", userAgent: "test" },
    setTimeout, clearTimeout, requestAnimationFrame: (callback) => callback(),
  };
  vm.runInNewContext(`
const applicationRouteContext = () => null;
const isApplicationRoute = () => false;
const safeApplicationReturnPath = () => null;
${source}
renderCreateInputs = () => {};
refreshButtonsForCurrentView = () => {};
notifyCreateBridge = () => {};
haptic = () => {};
trackEvent = async () => {};
saveDraftFile = async () => {};
sleep = async () => {};
loadRenderHistory = async () => {};
openRenderDetail = () => {};
withAuthHeaders = () => ({ Authorization: 'Bearer test-token' });
getIdentityPayload = () => ({ init_data: 'test-init-data' });
apiUrl = (path) => path;
globalThis.api = { state, bridge: window.dreamwheelsCreateBridge, handleFileSelected, submitJob, resetCreateAssets,
  setFetch: (fetcher) => { authenticatedFetch = fetcher; },
  setRender: (render) => { submitJob = render; },
  setFitment: (fitment) => { openFitmentView = fitment; }
};`, context);
  return { ...context.api, revoked };
}


function prepared() {
  const app=runtime();
  app.state.files.car={blob:new Blob(['car']),name:'car.jpg'};
  app.state.files.wheel={blob:new Blob(['wheel']),name:'wheel.jpg'};
  app.state.photoConsentAccepted=true;
  return app;
}
const reply=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('Create uploads assets then creates a render without vehicle or resolver',async()=>{
  const app=prepared();const calls=[];
  app.setFetch(async(path,options)=>{
    calls.push(path);
    if(path==='/identity/assets'){
      assert.equal(options.body.get('consent'),'true');
      assert.equal(options.body.has('rim_product_url'),false);
      return reply(200,{draft_id:'draft'});
    }
    if(path==='/jobs/from-assets'){
      const body=JSON.parse(options.body);
      assert.equal(body.draft_id,'draft');
      assert.equal('vehicle' in body,false);assert.equal('vehicle_user_confirmed' in body,false);
      assert.equal(body.rim.product_url,'https://shop.example/wheel');
      assert.equal(body.rim_user_confirmed,false);
      return reply(200,{job_id:'job',status:'queued'});
    }
    return reply(200,{status:'completed',result_url:'/result.jpg'});
  });
  app.bridge.saveRimProductUrl('https://shop.example/wheel');
  assert.equal(calls.length,0);
  await app.submitJob();
  assert.deepEqual(calls,['/identity/assets','/jobs/from-assets','/jobs/job']);
  assert.equal(app.state.renderStatus,'completed');assert.equal(app.state.submitting,false);
  assert.equal(app.bridge.snapshot().createScreen,'result');
  assert.equal(app.state.createAssetDraftId,'');
  assert.equal(app.state.createIdempotencyKey,'');
});

for(const status of [402,500]) test(`render failure ${status} preserves uploads and draft/idempotency for safe retry`,async()=>{
  const app=prepared();let key;let uploads=0;
  app.setFetch(async(path,options)=>{
    if(path==='/identity/assets'){uploads++;return reply(200,{draft_id:'draft'});}
    assert.equal(path,'/jobs/from-assets');
    const body=JSON.parse(options.body);
    if(key)assert.equal(body.idempotency_key,key);key=body.idempotency_key;
    return reply(status,{detail:status===402?'Insufficient credits':'Render API failure'});
  });
  await app.submitJob();await app.submitJob();
  assert.equal(uploads,1);assert.equal(app.state.submitting,false);
  assert(app.state.files.car.blob);assert(app.state.files.wheel.blob);
});

test('missing photo or consent prevents network submission',async()=>{
  const app=prepared();app.setFetch(()=>{throw new Error('must not send');});
  app.state.photoConsentAccepted=false;await app.submitJob();
  app.state.photoConsentAccepted=true;app.state.files.wheel=null;await app.submitJob();
  assert.equal(app.state.submitting,false);
});

test('replacement while asset upload is in flight discards response and never creates render',async()=>{
  const app=prepared();let resolve;const calls=[];
  app.setFetch(path=>{calls.push(path);return new Promise(r=>{resolve=r;});});
  const pending=app.submitJob();app.resetCreateAssets();
  resolve(reply(200,{draft_id:'old'}));await pending;
  assert.deepEqual(calls,['/identity/assets']);assert.equal(app.state.createAssetDraftId,'');
});

test('URL saves and consent changes never invoke recognition',()=>{
  const app=prepared();app.setFetch(()=>{throw new Error('must not send');});
  app.bridge.saveRimProductUrl('https://shop.example/wheel');app.bridge.setConsent(true);
  assert.equal(app.state.rimProductUrl,'https://shop.example/wheel');
  assert.equal('resolveIdentity' in app.bridge,false);assert.equal('chooseVehicle' in app.bridge,false);
});

for (const expiredAfter402 of [false, true]) test(`unusable draft recovers once (after 402: ${expiredAfter402})`, async () => {
  const app = prepared(); const creations = []; let uploads = 0;
  app.setFetch(async (path, options) => {
    if (path === '/identity/assets') return reply(200, {draft_id: `draft-${++uploads}`});
    if (path === '/jobs/from-assets') {
      const body = JSON.parse(options.body); creations.push(body);
      if (expiredAfter402 && creations.length === 1) return reply(402, {detail:'Insufficient credits'});
      if (body.draft_id === 'draft-1') return reply(404, {detail:'Asset draft not found'});
      return reply(200, {job_id:'fresh-job',status:'queued'});
    }
    return reply(200, {status:'completed'});
  });
  await app.submitJob();
  if (expiredAfter402) {
    assert.equal(uploads, 1); assert.equal(app.state.createAssetDraftId, 'draft-1');
    await app.submitJob();
    assert.equal(creations[0].idempotency_key, creations[1].idempotency_key);
  }
  assert.equal(uploads, 2);
  assert.equal(creations.length, expiredAfter402 ? 3 : 2);
  assert.notEqual(creations.at(-2).idempotency_key, creations.at(-1).idempotency_key);
  assert.equal(app.state.jobId, 'fresh-job');
  assert.equal(app.state.createAssetDraftId, '');
});

for (const failure of ['upload', 'draft']) test(`recovery ${failure} failure stops without a loop and shows an error`, async () => {
  const app=prepared(); let uploads=0; let creations=0;
  app.setFetch(async path => {
    if(path==='/identity/assets') {
      uploads++;
      return uploads===2 && failure==='upload' ? reply(503,{detail:'Upload unavailable'}) : reply(200,{draft_id:`draft-${uploads}`});
    }
    creations++; return reply(404,{detail:'Asset draft not found'});
  });
  await app.submitJob();
  assert.equal(uploads,2); assert.equal(creations,failure==='upload'?1:2);
  assert.equal(app.state.jobId,null); assert.equal(app.state.submitting,false);
  assert(app.bridge.snapshot().renderError);
  assert.equal(app.state.createAssetDraftId,''); assert.equal(app.state.createIdempotencyKey,'');
});

test('lost response after job commit retries the same key and causes one reservation', async () => {
  const app=prepared(); const jobs=new Map(); let reservations=0; let uploads=0; let creations=0;
  app.setFetch(async (path, options) => {
    if(path==='/identity/assets'){uploads++;return reply(200,{draft_id:'draft'});}
    if(path==='/jobs/from-assets') {
      const body=JSON.parse(options.body); creations++;
      if(!jobs.has(body.idempotency_key)){jobs.set(body.idempotency_key,'accepted-job');reservations++;}
      if(creations===1) throw new TypeError('Connection lost after commit');
      return reply(200,{job_id:jobs.get(body.idempotency_key),status:'queued'});
    }
    return reply(200,{status:'completed'});
  });
  await app.submitJob(); const key=app.state.createIdempotencyKey;
  assert(key); assert.equal(app.state.createAssetDraftId,'draft');
  await app.submitJob();
  assert.equal(uploads,1); assert.equal(creations,2); assert.equal(jobs.size,1);
  assert.equal(reservations,1); assert.equal(app.state.jobId,'accepted-job');
  assert.equal(app.state.createIdempotencyKey,'');
});

test('photo replacement during recovery upload prevents old creation from taking over', async () => {
  const app=prepared(); app.state.createAssetDraftId='consumed'; app.state.createIdempotencyKey='old-key';
  let resolveUpload; const calls=[];
  app.setFetch(async path => {
    calls.push(path);
    if(path==='/jobs/from-assets')return reply(404,{detail:'Asset draft not found'});
    return new Promise(resolve=>{resolveUpload=resolve;});
  });
  const pending=app.submitJob();
  while(!resolveUpload)await new Promise(resolve=>setImmediate(resolve));
  app.resetCreateAssets(); app.state.files.car={blob:new Blob(['replacement']),name:'new.jpg'};
  resolveUpload(reply(200,{draft_id:'old-recovery'})); await pending;
  assert.deepEqual(calls,['/jobs/from-assets','/identity/assets']);
  assert.equal(app.state.jobId,null); assert.equal(app.state.createAssetDraftId,'');
});

for(const value of ['', '  https://shop.example/wheel  ', 'garbage URL']) test(`optional URL is safe for render: ${value || 'empty'}`, async () => {
  const app=prepared(); let sent;
  app.bridge.setSourceEditing(true); app.bridge.saveRimProductUrl(value);
  const valid=value.trim().startsWith('https://');
  assert.equal(app.state.rimProductUrl,valid?value.trim():'');
  assert.equal(Boolean(app.bridge.snapshot().productUrlError),value==='garbage URL');
  app.setFetch(async(path,options)=>{
    if(path==='/identity/assets')return reply(200,{draft_id:'draft'});
    if(path==='/jobs/from-assets'){sent=JSON.parse(options.body);return reply(200,{job_id:'job'});}
    return reply(200,{status:'completed'});
  });
  await app.submitJob();
  assert.equal(sent.rim.product_url,valid?value.trim():null);
  assert.equal(app.state.renderStatus,'completed');
});

test('invalid URL cannot replace last saved valid URL',()=>{
  const app=prepared();app.bridge.saveRimProductUrl('https://shop.example/item');
  app.bridge.setSourceEditing(true);app.bridge.saveRimProductUrl('not-a-link');
  assert.equal(app.state.rimProductUrl,'https://shop.example/item');
  assert(app.bridge.snapshot().productUrlError);assert.equal(app.state.vnextCreateSourceEditing,true);
});

test('402 immediate retry accepts the same prepared assets without re-upload',async()=>{
  const app=prepared();let uploads=0;const bodies=[];
  app.setFetch(async(path,options)=>{
    if(path==='/identity/assets'){uploads++;return reply(200,{draft_id:'draft'});}
    if(path==='/jobs/from-assets'){
      bodies.push(JSON.parse(options.body));
      return bodies.length===1?reply(402,{detail:'Insufficient credits'}):reply(200,{job_id:'job'});
    }
    return reply(200,{status:'completed'});
  });
  await app.submitJob();await app.submitJob();
  assert.equal(uploads,1);assert.deepEqual(bodies[0],bodies[1]);assert.equal(app.state.jobId,'job');
});

test('an unrelated 404 does not trigger draft recovery',async()=>{
  const app=prepared();let uploads=0;let creations=0;
  app.setFetch(async path=>{
    if(path==='/identity/assets'){uploads++;return reply(200,{draft_id:'draft'});}
    creations++;return reply(404,{detail:'User not found'});
  });
  await app.submitJob();assert.equal(uploads,1);assert.equal(creations,1);
  assert.equal(app.state.createAssetDraftId,'draft');assert(app.state.createIdempotencyKey);
});

for(const value of ['https:///bad','javascript:alert(1)','shop.example.com/item','https://user:pass@shop.example/item'])test(`unsupported optional URL is not committed: ${value}`,()=>{
  const app=prepared();app.bridge.saveRimProductUrl(value);
  assert.equal(app.state.rimProductUrl,'');assert(app.bridge.snapshot().productUrlError);
});
