import {captureCatalogHandoff,readCatalogHandoff} from '../vnext/catalog-handoff.mjs';
import {catalogEntries} from '../vnext/catalog-data.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {applicationRouteContext, applicationRouteRequiresAuth, isApplicationRoute, safeApplicationReturnPath} from '../app-route.mjs';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const initialize = source.slice(source.indexOf('function initializeApplicationRoute()'), source.indexOf('async function bootstrapAuthenticatedApplication()'));
function entry(path, telegram = false) {
  const state = {applicationAuthRequired:false};
  const window = {location:new URL(path, 'https://app.dream-wheels.ru'), history:{replaceState(_, __, target) {window.location = new URL(target, window.location);}}};
  runInNewContext(initialize + '; initializeApplicationRoute();', {state, window, HAS_TG:telegram, restoreWebRoute() {}, URLSearchParams, applicationRouteContext, applicationRouteRequiresAuth, isApplicationRoute, safeApplicationReturnPath});
  return {state, window};
}
test('cold new and legacy entries require auth and preserve the intended create route', () => {
  for (const path of ['/new', '/app/new', '/create']) {
    const {state, window} = entry(path + '?utm_source=catalog&token=secret');
    assert.equal(state.applicationAuthRequired, true);
    assert.equal(state.applicationRoute.view, 'create');
    assert.equal(state.applicationAuthReturnPath, '/new?utm_source=catalog');
    assert.equal(window.location.pathname, '/new');
    assert.equal(window.location.search, '?utm_source=catalog');
  }
});
test('root is protected, public legacy support canonicalizes, Telegram entry stays untouched', () => {
  assert.equal(entry('/').state.applicationAuthRequired, true);
  const support = entry('/app/support');
  assert.equal(support.window.location.pathname, '/help');
  assert.equal(support.state.applicationAuthRequired, false);
  const telegram = entry('/app/new', true);
  assert.equal(telegram.state.applicationAuthRequired, false);
  assert.equal(telegram.window.location.pathname, '/app/new');
});

// Run the actual DOMContentLoaded callback, route setup, restoration and auth wall
// together. Only UI rendering/network boundaries are mocked; unresolved promises
// deliberately hold startup at the original asynchronous boundaries.
function lifecycle(path, {authPending = true, dashboardPending = false, storageFailure = false} = {}) {
  const state = {view:'dashboard', applicationAuthRequired:false, applicationAuthGateReady:false, frontendAuthState:{status:'ANONYMOUS'}};
  const shell = {hidden:false, toggleAttribute(_, hidden) {this.hidden = hidden;}};
  const document = {documentElement:{lang:"ru"}, addEventListener(name, fn) {if (name === 'DOMContentLoaded') this.start = fn;}, querySelector(selector) {return selector === '#app' || selector === '.desktop-sidebar' || selector === '.mobile-bottom-nav' ? shell : null;}};
  const window = {location:new URL(path, 'https://app.dream-wheels.ru'), history:{replaceState(_, __, target) {window.location = new URL(target, window.location);}}, addEventListener() {}, dispatchEvent() {}};
  const calls = {dashboard:0, drafts:0, failStorage:storageFailure};
  const stored = new Map();
  const storage = {getItem:k=>stored.get(k)||null,setItem(k,v){if(calls.failStorage)throw Error("quota");stored.set(k,v);},removeItem:k=>stored.delete(k)};
  const catalogHandoff = {storage,pending:null,error:""};
  const context = {state, window, document, HAS_TG:false, URL, URLSearchParams, Event, captureCatalogHandoff, readCatalogHandoff, catalogHandoff, applicationRouteContext, applicationRouteRequiresAuth, isApplicationRoute, safeApplicationReturnPath,
    setView(view) {state.view = view;}, isApplicationAuthSessionReady:()=>false,
    initializeFrontendAuthBridge:()=>authPending ? new Promise(()=>{}) : Promise.resolve(),
    resolveAccountDraftOwner:async()=>true,
    hydrateFilesFromDraft:async()=>{calls.drafts++;}, loadDashboardData:()=>{calls.dashboard++;return dashboardPending ? new Promise(()=>{}) : Promise.resolve();},
  };
  for (const name of ['trackEvent','checkCurrentBuild','applyTranslations','initTelegram','updateWebsiteAuthUi','bindDraftSessionBoundary','bindEvents','observeUiCopyRule','warmWebsiteLoginResources','handlePaymentReturn','syncEmailInput','setSelectedAmount','renderWallet','renderRenders','renderDashboard','renderAuthDialog','updateTopbarCaption','setMenuOpen','setMoreOpen','showCreateScreen','renderCreateInputs','refreshButtonsForCurrentView','loadCabinet','scheduleRenderHistoryPolling','clearRenderHistoryPolling','persistFitmentTransientDraft','clearApplicationSessionState']) context[name] = ()=>{};
  const authFunctions = source.slice(source.indexOf('function isApplicationAuthGranted()'), source.indexOf('async function bootstrapAuthenticatedApplication()'));
  const startup = source.slice(source.indexOf('document.addEventListener("DOMContentLoaded", async () => {'), source.indexOf('// Browser routes are independent'));
  const routes = source.slice(source.indexOf('// Browser routes are independent'));
  const capture = source.slice(source.indexOf('function initializeCatalogHandoff()'),source.indexOf('document.addEventListener("DOMContentLoaded", async () => {'));
  runInNewContext(capture + '\n' + authFunctions + '\n' + routes + '\n' + startup, context);
  const pending = document.start();
  let error;
  pending.catch(value=>{error = value;});
  return {state, window, shell, calls, storage, retry:()=>context.initializeCatalogHandoff(), error:()=>error};
}

test('unknown legacy fallback locks Dashboard before the pending auth promise', async () => {
  const app = lifecycle('/app/missing');
  await Promise.resolve();
  assert.equal(app.error(), undefined);
  assert.equal(app.window.location.pathname, '/');
  assert.equal(app.state.applicationRoute.view, 'dashboard');
  assert.equal(app.state.applicationAuthRequired, true);
  assert.equal(app.shell.hidden, true);
  assert.equal(app.calls.dashboard,0);assert.equal(app.calls.drafts,0);
});

test('public screens are applied while auth never resolves', async () => {
  for (const [path, view] of [['/help','support'], ['/documents','docs'], ['/app/support','support']]) {
    const app = lifecycle(path);
    await Promise.resolve();
    assert.equal(app.error(), undefined);
    assert.equal(app.state.view, view, path);
    assert.equal(app.state.applicationAuthRequired, false);
    assert.equal(app.shell.hidden, false);
    assert.equal(app.calls.dashboard,0);assert.equal(app.calls.drafts,0);
  }
});

test('public screens stay selected while later dashboard data never resolves', async () => {
  for (const [path, view] of [['/help','support'], ['/documents','docs']]) {
    const app = lifecycle(path, {authPending:false, dashboardPending:true});
    await new Promise(setImmediate);
    assert.equal(app.error(), undefined);
    assert.equal(app.calls.dashboard, 1);
    assert.equal(app.state.view, view);
    assert.equal(app.shell.hidden, false);
  }
});

for(const path of ['/new','/app/new'])test(`full guest bootstrap retains validated handoff through storage refusal: ${path}`,async()=>{
 const pair=catalogEntries.find(e=>e.selectedSkuId);
 const query=new URLSearchParams({catalog_variant:pair.variantId,catalog_sku:pair.selectedSkuId,catalog_locale:'ru',catalog_source:'catalog',token:'drop'});
 const app=lifecycle(path+'?'+query,{storageFailure:true});await Promise.resolve();
 assert.equal(app.error(),undefined);assert.equal(app.state.applicationAuthRequired,true);assert.equal(app.shell.hidden,true);
 assert.equal(app.window.location.pathname,'/new');assert.equal(app.window.location.searchParams.get('catalog_sku'),pair.selectedSkuId);assert.equal(app.window.location.searchParams.has('token'),false);
 assert.match(app.state.applicationAuthReturnPath,/catalog_sku=/);assert.equal(app.storage.getItem('dreamWheelsCatalogHandoff:v1'),null);
 const reloaded=lifecycle(app.window.location.pathname+app.window.location.search,{storageFailure:true});await Promise.resolve();assert.equal(reloaded.window.location.searchParams.get('catalog_variant'),pair.variantId);
 app.calls.failStorage=false;app.retry();assert.ok(app.storage.getItem('dreamWheelsCatalogHandoff:v1'));assert.equal(app.window.location.searchParams.has('catalog_variant'),false);
});
