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
  let asset = 0;
  class AssetURL extends URL {
    static createObjectURL() { return `blob:asset-${++asset}`; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = {
    URL: AssetURL, URLSearchParams, Blob, FormData, console: { log() {}, warn() {}, error() {} },
    document: { documentElement: { dataset: {} }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
    window: { Telegram: {}, location: { search: "" }, dispatchEvent() {} },
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
