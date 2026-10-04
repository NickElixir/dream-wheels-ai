import {extractFunction} from "./helpers/source-extract.mjs";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {copy} from '../webapp/vnext/copy.mjs';
const source=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
function runtime(names,extra={}){
 const context=vm.createContext({uiCopy:copy,locale:'ru',state:{},...extra});
 for(const name of names)vm.runInContext(extractFunction(source,name),context);
 return context;
}
test('catalogue presentation preserves state and explicitly localizes all kinds/states',()=>{
 const context=runtime(['fitmentCatalogueFieldState'],{fitmentCatalogueParentReadiness:()=> 'ready',fitmentCatalogueSelectionMatches:()=>true,state:{fitmentCatalogue:{}}});
 for(const locale of ['ru','en'])for(const kind of ['makes','models','years'])for(const status of ['loading','no_data','failed','loaded']){
  context.state.fitmentCatalogue[kind]={status,items:[]};const result=context.fitmentCatalogueFieldState(kind,'',locale);
  assert.equal(result.state,status==='loaded'?'loaded_unselected':status);assert.ok(result.placeholder);
  if(locale==='en')assert.doesNotMatch(result.message+result.placeholder,/[А-Яа-яЁё]/u);else assert.match(result.placeholder,/[А-Яа-яЁё]/u);
 }
 context.fitmentCatalogueParentReadiness=()=> 'missing';
 assert.equal(context.fitmentCatalogueFieldState('models','','en').message,'Select a make first');
 assert.equal(context.fitmentCatalogueFieldState('years','','en').message,'Select a model first');
 assert.match(extractFunction(source,'vnextFitmentSnapshot'),/fitmentCatalogueFieldState\(kind, value, locale\)/);
});
test('generation classification retains action/support semantics in both languages',()=>{
 const context=runtime(['classifyGenerationError']);
 for(const [message,action,support] of [['network','retry',true],['wheel','wheel',false],['vehicle','car',false],['insufficient credits','wallet',false],['other','retry',true]])for(const locale of ['ru','en']){
  const result=context.classifyGenerationError(message,locale);assert.equal(result.action,action);assert.equal(result.showSupport,support);
  if(locale==='en')assert.doesNotMatch(result.title+result.copy+result.actionLabel,/[А-Яа-яЁё]/u);else assert.match(result.title,/[А-Яа-яЁё]/u);
 }
});
test('account stored notices relocalize without altering inputs, flow or issuing requests',()=>{
 const nodes=new Map(),document={querySelector:selector=>nodes.get(selector)||null};
 for(const selector of ['[data-account-settings-content]','[data-account-link-dialog]','[data-account-link-title]','[data-account-link-copy]','[data-account-link-email-form]','[data-account-link-otp-form]','[data-account-link-destination]','[data-account-link-status]','[data-account-merge-copy]','[data-account-merge-status]'])nodes.set(selector,{dataset:{},value:'123456'});
 document.querySelectorAll=()=>[];
 const state={accountLinkDialogOpen:true,accountLinkMode:'supabase',accountLinkStep:'otp',accountLinkEmail:'qa@example.com',accountLinkOtp:'123456',accountMergeProvider:'telegram',accountState:{identities:{email:{linked:true,display:'qa@example.com'},telegram:{linked:false}}},frontendAuthState:{status:'authenticated'}};
 const context=runtime(['setAccountPresentation','refreshAccountPresentation','accountProviderLabel','renderAccountSettings','renderAccountLinkDialog'],{state,document,escapeHtml:String,maskAuthEmail:email=>email,updateAccountBlock(){},updateWebsiteAuthUi(){},setWalletMessage(message){state.walletMessage=message;}});
 for(const [field,key] of [['accountLinkStatus','account.link.verifyFailed'],['accountStateError','account.settings.loadFailed'],['accountSettingsNotice','account.merge.success'],['accountMergeStatus','account.merge.failed'],['websiteLoginError','legacy.auth.networkError']])context.setAccountPresentation(field,key);
 state.walletMessage=state.websiteLoginError;
 const before=JSON.stringify({step:state.accountLinkStep,email:state.accountLinkEmail,otp:state.accountLinkOtp,auth:state.frontendAuthState});context.locale='en';context.refreshAccountPresentation();
 assert.equal(JSON.stringify({step:state.accountLinkStep,email:state.accountLinkEmail,otp:state.accountLinkOtp,auth:state.frontendAuthState}),before);assert.equal(nodes.get('[data-account-link-dialog]').hidden,false);
 for(const field of ['accountLinkStatus','accountStateError','accountSettingsNotice','accountMergeStatus','websiteLoginError','walletMessage'])assert.doesNotMatch(state[field],/[А-Яа-яЁё]/u,field);
 for(const node of nodes.values())assert.doesNotMatch((node.textContent||'')+(node.innerHTML||''),/[А-Яа-яЁё]/u);
});
test('Telegram login network/provider errors refresh dashboard, wallet and auth copy without another login',async()=>{
 for(const network of [true,false]){
  let attempts=0;
  const state={websiteLoginPending:false};const message={textContent:'',dataset:{}};
  const context=runtime(['setAccountPresentation','loginWithTelegram','refreshAccountPresentation','setAuthDialogMessage'],{state,console:{warn(){}},document:{querySelector:selector=>selector==='[data-auth-message]'?message:null},
   getPreparedTelegramLoginResources(){attempts++;throw network?new TypeError('network unavailable'):new Error('provider rejected');},updateWebsiteAuthUi(){},setWalletMessage(value){state.walletMessage=value;},invalidateWebsiteLoginNonce(){},warmWebsiteLoginResources(){},renderAccountSettings(){},renderAccountLinkDialog(){},updateAccountBlock(){}});
  assert.equal(await context.loginWithTelegram(),false);assert.equal(attempts,1);assert.equal(state.websiteLoginPending,false);
  context.setAuthDialogMessage(state.websiteLoginError,true);assert.match(state.websiteLoginError,/[А-Яа-яЁё]/u);
  context.locale='en';context.refreshAccountPresentation();assert.equal(attempts,1);
  assert.doesNotMatch(state.websiteLoginError+state.walletMessage+message.textContent,/[А-Яа-яЁё]/u);
 }
});
test('Result downloads localize success/failure/missing notices and retain download routes',async()=>{
 for(const language of ['ru','en'])for(const outcome of ['started','failed','unavailable']){
  let fetched=0,clicked=0,notified=0;
  const state={renderHistory:outcome==='unavailable'?[]:[{job_id:'A'}],downloadNoticeByJob:{},jobId:'B',resultDownloadUrl:'/jobs/B/download'};
  const context=runtime(['downloadResult'],{locale:language,state,SUPPORTS_DOWNLOAD_FILE:false,
   isGuestRenderJob:()=>false,isWebsiteAuthMode:()=>true,isSupabaseFrontendAuth:()=>false,apiUrl:path=>path,
   notifyRenderBridge(){notified++;},setDownloadButtonState(){},t:()=>'',haptic(){},withAuthHeaders:()=>({Authorization:'Bearer fixture'}),
   authenticatedFetch:async(url,options)=>{fetched++;assert.equal(url,'/jobs/A/download');assert.equal(options.headers.Authorization,'Bearer fixture');return {ok:outcome==='started',blob:async()=>new Blob(['image'])};},
   parseApiError:async()=> 'fixture failed',URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},
   document:{createElement:()=>({click(){clicked++;},remove(){}}),body:{appendChild(){}}},setTimeout:fn=>fn(),console:{error(){}}});
  await context.downloadResult({jobId:'A'});
  assert.equal(state.downloadNoticeByJob.A,copy(`render.download.${outcome}`,language));assert.equal(state.jobId,'B');assert.equal(state.resultDownloadUrl,'/jobs/B/download');
  assert.equal(fetched,outcome==='unavailable'?0:1);assert.equal(clicked,outcome==='started'?1:0);assert.ok(notified>0);
 }
});
test('starter cohorts preserve filtering, order, credits and provider labels in both locales',()=>{
 for(const language of ['ru','en']){
  const state={creditPackages:[{id:'starter',source:'starter_grant',remainingCredits:3,expiresAt:null},{id:'custom',source:'starter_grant',remainingCredits:2,expiresAt:'2099-01-01',label:'User label'},{id:'empty',remainingCredits:0}]};
  const context=runtime(['buildRenderExpiryCohorts'],{locale:language,state});const rows=context.buildRenderExpiryCohorts();
  assert.equal(rows.length,2);assert.equal(rows[0].key,'custom');assert.equal(rows[0].meta,'User label');assert.equal(rows[1].meta,copy('wallet.starterPackage',language));assert.equal(rows[1].credits,3);
 }
});
test('Fitment rejects invalid photo types and oversized files with localized copy before storage',async()=>{
 for(const language of ['ru','en'])for(const file of [{type:'image/gif',size:1},{type:'image/png',size:10*1024*1024+1}]){
  let renders=0,aborts=0;
  const state={fitmentJobId:'A',fitmentRecognitionToken:0,fitmentRecognitionController:{abort(){aborts++;}}};
  const context=runtime(['setFitmentVehiclePhoto'],{locale:language,state,fitmentMutationsLocked:()=>false,renderFitment(){renders++;}});
  await context.setFitmentVehiclePhoto(file);assert.equal(state.fitmentRecognition.status,'failed');assert.equal(state.fitmentRecognition.message,copy('fitment.vehicle.photo.invalid',language));assert.equal(state.fitmentJobId,'A');assert.equal(renders,1);assert.equal(aborts,1);assert.equal(state.fitmentVehiclePhoto,undefined);
 }
});
