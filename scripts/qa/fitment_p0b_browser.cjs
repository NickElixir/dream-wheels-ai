const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('assert/strict');
const repo=require('path').resolve(__dirname,'../..');
const out=process.env.P0B_QA_OUTPUT || '/tmp/p0b-browser',base=process.env.P0B_QA_BASE_URL || 'http://127.0.0.1:8781';
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)) throw new Error("P0-B browser QA requires a local server; API responses are mocked.");
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ru-RU'});
 const errors=[],requests=[],checks=[];let overview,checkStatus='queued',delayPatch=false,releasePatch,checkCounter=0,launchFailure=false;
 const jobId='11111111-1111-4111-8111-111111111111';
 const job={job_id:jobId,status:'completed',fitment_available:true,created_at:'2026-10-03T00:00:00Z',result_url:base+'/assets/demo-vehicle-zeekr.jpg',assets:{car_original:{download_url:base+'/assets/demo-vehicle-zeekr.jpg'},rim_original:{download_url:base+'/assets/demo-rim-xtrike.png'},result:{url:base+'/assets/demo-vehicle-zeekr.jpg'}}};
 await page.route('**/app.js?*',r=>r.fulfill({contentType:'application/javascript',body:fs.readFileSync(repo+'/webapp/app.js','utf8')+'\nwindow.__qa={state,setView,renderFitment,renderDashboard,buildDefaultDemoFitmentOverview,fitmentFormFromOverview,openFitmentView,runFitmentCheck,setVnextFitmentField,saveVnextFitment,vnextFitmentSnapshot,notifyFitmentBridge,clearFitmentCheckPolling,loadFitmentOverview};'}));
 await page.route('**/auth/app-auth.bundle.js',r=>r.fulfill({body:''}));await page.route('https://telegram.org/**',r=>r.fulfill({body:''}));
 await page.route('**/*',async r=>{let p=new URL(r.request().url()).pathname;if(p.startsWith('/api/backend'))p=p.slice(12);if(!['/jobs','/identity','/cabinet','/fitment','/account','/analytics'].some(x=>p.startsWith(x)))return r.fallback();
  const method=r.request().method();requests.push({method,path:p,body:method==='POST'||method==='PATCH'?r.request().postDataJSON():null});let status=200,body={};
  if(p==='/jobs')body={jobs:[job],has_more:false};
  else if(p==='/jobs/'+jobId)body=job;
  else if(p.endsWith('/fitment')&&method==='PATCH'){
   const payload=r.request().postDataJSON();assert(!payload.vehicle);
   const saved=structuredClone(overview);Object.assign(saved.rim,payload.rim);Object.assign(saved.front_rim.rim,payload.rim);saved.rim_revision++;saved.rim_setup_revision++;saved.rim_setup_state='confirmed_ready';saved.next_action={kind:'run_standard_check'};saved.current_check=null;
   if(delayPatch)await new Promise(resolve=>releasePatch=resolve);overview=saved;body=saved;
  }else if(p.endsWith('/fitment'))body=overview;
  else if(p==='/fitment/checks'&&method==='POST'&&launchFailure){checkCounter++;status=500;body={detail:'provider_timeout'};}
  else if(p==='/fitment/checks'&&method==='POST'){checkCounter++;body={id:'execution-'+checkCounter,execution_status:checkStatus,retry_mode:'retryable',vehicle_identity_id:overview.vehicle_identity_id,rim_setup_id:overview.rim_setup_id};}
  else if(p.startsWith('/fitment/checks/'))body={id:'execution-'+checkCounter,execution_status:checkStatus,retry_mode:'retryable'};
  else if(p==='/cabinet')body={balance:31,credit_packages:[],payments:[],user:{id:77}};
  else if(p.includes('rim-source/resolve')){status=422;body={detail:{code:'no_data'}};}
  else if(p.includes('signed-url'))body={url:base+'/assets/demo-vehicle-zeekr.jpg',expires_at:'2099-10-01T00:00:00Z'};
  await r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text());});
 await page.addInitScript(()=>sessionStorage.setItem('dreamWheelsWebsiteAuth',JSON.stringify({accessToken:'disposable-test-token',expiresAt:Date.now()+3600000,user:{id:77}})));
 await page.goto(base+'/?telegram_user_id=123456');await page.waitForFunction(()=>window.__qa&&window.dreamwheelsFitmentBridge);
 overview=await page.evaluate(()=>{const q=window.__qa,o=q.buildDefaultDemoFitmentOverview();o.job_id='11111111-1111-4111-8111-111111111111';o.vehicle_state='confirmed_ready';o.modification_state='confirmed';o.selected_modification={modification:'Electric Performance'};o.modification_vehicle_revision=o.vehicle_revision;o.rim_setup_state='confirmed_ready';o.front_rim.rim_setup_state='confirmed_ready';o.next_action={kind:'run_standard_check'};o.current_check=null;const values={bolt_count:5,pcd_mm:112,wheel_diameter_in:19,wheel_width_j:8.5,center_bore_mm:66.6,offset_et_mm:35,product_url:''};Object.assign(o.rim,values);Object.assign(o.front_rim.rim,values);for(const [field,value] of Object.entries(values)){if(field==='product_url')continue;o.rim_field_states[field]={state:'confirmed',source:'user_input',is_user_confirmed:true,value};o.front_rim.field_states[field]={state:'confirmed',source:'user_input',is_user_confirmed:true,value};}return o;});
 await page.evaluate(({overview,job})=>{const q=window.__qa;q.state.renderHistory=[job];q.openFitmentView(job.job_id);},{overview,job});await page.waitForSelector('[data-vnext-fitment-root]');await page.waitForFunction(()=>window.__qa.state.fitmentOverview?.next_action.kind==='run_standard_check');
 async function seed(extra={}){await page.evaluate(({o,extra})=>{const q=window.__qa,s=q.state;q.clearFitmentCheckPolling();s.fitmentCheckHistory=[];s.fitmentOverview=structuredClone(o);s.fitmentForm=q.fitmentFormFromOverview(o);s.fitmentFormState={status:'clean',baseline:structuredClone(s.fitmentForm),missingFields:[],invalidFields:[]};s.fitmentCheck=null;s.fitmentChecking=false;s.fitmentCheckStartFailed=false;s.fitmentSaving=false;s.fitmentVehicleDirty=false;s.fitmentVehicleEditing=false;s.fitmentRimEditing=false;s.fitmentActiveSection='result';s.fitmentError='';s.fitmentMessage='';s.fitmentRimManualFields=[];s.fitmentSourceConflicts=[];s.fitmentSourceProposalContexts={};s.fitmentSourceAcceptedContexts={};Object.assign(s,extra);q.renderFitment();},{o:overview,extra});}
 async function capture(name){
  if(name.endsWith('-390')) {
   const selector=/^(dirty|saved|save-race)/.test(name)?'.vnext-fitment__standard':/^(failed|queued|processing|launch-failure|compatible)/.test(name)?'.vnext-fitment__verdict':/^(incompatible|unknown)/.test(name)?'.vnext-fitment__evidence':name.startsWith('balance')?'.vnext-dashboard__balance-content':null;
   if(selector)await page.locator(selector).scrollIntoViewIfNeeded();
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' horizontal overflow');await page.screenshot({path:out+'/'+name+'.jpg',type:'jpeg',quality:75,fullPage:true});checks.push(name);}
 if(process.env.P0B_QA_FOCUS==='medium1') {
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:width===390?844:1000});await seed();
   const root=page.locator('[data-vnext-fitment-root]');
   launchFailure=true;
   await root.locator('[data-fitment-action="check"]').click();
   await page.waitForFunction(()=>window.__qa.state.fitmentCheckStartFailed);
   assert((await root.innerText()).includes('Проверку выполнить не удалось'));
   if(width===390)await root.locator('.vnext-fitment__standard').scrollIntoViewIfNeeded();
   await capture('m1-launch-failed-'+width);
   await root.locator('[data-fitment-action="edit-rim"][data-value=""]').first().click();
   await root.locator('[data-wheel-picker-open="rim.offset_et_mm"]').click();
   const value=width===1440?'36.25':'37.25';
   await root.locator('[data-wheel-picker-search]').fill(value);
   await root.locator('.vnext-fitment__picker-manual [data-wheel-picker-value]').click();
   assert(await page.evaluate(()=>window.__qa.state.fitmentCheckStartFailed));
   const oldRevision=await page.evaluate(()=>window.__qa.state.fitmentOverview.rim_revision);
   await root.locator('[data-fitment-action="save-rim"]').first().click();
   await page.waitForFunction(()=>!window.__qa.state.fitmentSaving&&!window.__qa.state.fitmentCheckStartFailed);
   assert.equal(await page.evaluate(()=>window.__qa.state.fitmentOverview.rim_revision),oldRevision+1);
   assert.equal(await page.evaluate(()=>window.__qa.state.fitmentCheck),null);
   assert(!(await root.innerText()).includes('Проверку выполнить не удалось'));
   assert(await root.locator('[data-fitment-action="check"]').isEnabled());
   if(width===390)await root.locator('.vnext-fitment__standard').scrollIntoViewIfNeeded();
   await capture('m1-wheel-saved-'+width);
   await root.locator('[data-fitment-action="check"]').click();
   await page.waitForFunction(()=>window.__qa.state.fitmentCheckStartFailed);
   await page.evaluate(async()=>{await window.__qa.loadFitmentOverview('11111111-1111-4111-8111-111111111111',{suppressAutomaticResolver:true});});
   assert.equal(await page.evaluate(()=>window.__qa.state.fitmentCheckStartFailed),false);
   assert(!(await root.innerText()).includes('Проверку выполнить не удалось'));
   if(width===390)await root.locator('.vnext-fitment__standard').scrollIntoViewIfNeeded();
   await capture('m1-overview-reloaded-'+width);
  }
  fs.writeFileSync(out+'/evidence.json',JSON.stringify({checks,requests,errors,viewports:[1440,390],environment:'Local runtime with controlled API responses. MEDIUM-1 focused QA, not live staging E2E.'},null,2)+'\n');
  assert.deepEqual(errors,[]);await browser.close();console.log('MEDIUM-1 Browser PASS',checks.length);return;
 }
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await seed();
  const root=page.locator('[data-vnext-fitment-root]');assert(await root.locator('[data-fitment-action="check"]').isEnabled());assert((await root.innerText()).includes('Фото диска'));await capture('clean-'+width);
  await page.evaluate(width=>window.__qa.setVnextFitmentField('rim.offset_et_mm',width===1440?'35.125':'36.25'),width);
  assert(await root.locator('[data-fitment-action="check"]').isDisabled());assert((await root.innerText()).includes('Есть несохранённые изменения'));await capture('dirty-'+width);
  await root.locator('[data-fitment-action="save-rim"]').last().click();await page.waitForFunction(()=>!window.__qa.state.fitmentSaving);assert(await root.locator('[data-fitment-action="check"]').isEnabled());await capture('saved-'+width);
  await page.evaluate(()=>window.__qa.setVnextFitmentField('rim.center_bore_mm',''));await root.locator('[data-fitment-action="save-rim"]').last().click();
  await page.waitForFunction(()=>(document.activeElement?.dataset.wheelPickerOpen||document.activeElement?.dataset.fitmentField)==='rim.center_bore_mm');await capture('invalid-focused-'+width);
  await seed({fitmentCheck:{id:'failed',execution_status:'failed',error_code:'provider_timeout',retry_mode:'retryable'}});
  assert((await root.innerText()).includes('Проверку выполнить не удалось'));assert(!(await root.innerText()).includes('provider_timeout'));assert(await root.getByRole('button',{name:'Повторить проверку',exact:true}).isEnabled());await capture('failed-'+width);
  const before=checkCounter;await root.getByRole('button',{name:'Повторить проверку',exact:true}).click();await page.evaluate(()=>window.__qa.runFitmentCheck());await page.waitForFunction(()=>window.__qa.state.fitmentCheck?.execution_status==='queued');assert.equal(checkCounter,before+1);await capture('queued-'+width);await seed({fitmentCheck:{id:'processing',execution_status:'processing'}});assert(await root.locator('[data-fitment-action="check"]').isDisabled());await capture('processing-'+width);await seed({fitmentCheckStartFailed:true});assert((await root.innerText()).includes('Проверку выполнить не удалось'));await capture('launch-failure-'+width);
  for(const verdict of ['compatible','compatible_with_conditions','unknown','incompatible']){
   const c={id:verdict,execution_status:'completed',verdict,is_current:true,is_preliminary:true,blocking_issues:verdict==='incompatible'?[{code:'pcd_mismatch'},{code:'center_bore_too_small'}]:[],conditions:['incompatible','compatible_with_conditions'].includes(verdict)?[{code:'hub_rings_required'}]:[],advisories:verdict==='incompatible'?[{code:'fastener_unknown'}]:[],missing_fields:verdict==='unknown'?['offset_et','center_bore']:[]};
   await seed({fitmentCheck:c});const text=await root.innerText();assert.equal(text.includes('Почему не подходит'),verdict==='incompatible');assert.equal(text.includes('Что нужно уточнить'),verdict==='unknown');await capture(verdict+'-'+width);
  }
  for(const n of [1,2,4]){
   await page.evaluate(n=>{const q=window.__qa;q.state.creditPackages=Array.from({length:n},(_,i)=>({id:String(i),source:'purchase',remainingCredits:(i+1)*3,expiresAt:i===3?null:`2099-${String(10+i).padStart(2,'0')}-01T00:00:00Z`}));q.state.balance=q.state.creditPackages.reduce((a,b)=>a+b.remainingCredits,0);q.setView('dashboard',{refreshData:false});q.renderDashboard();},n);
   await page.waitForSelector('.vnext-dashboard');assert.equal(await page.locator('.vnext-dashboard__expiry-row').count(),n);await capture('balance-'+n+'-'+width);
  }
  await page.evaluate(()=>window.__qa.setView('fitment',{refreshData:false}));
 }
 await page.setViewportSize({width:1440,height:1000});await seed();await page.evaluate(()=>window.__qa.setVnextFitmentField('rim.offset_et_mm','40'));
 delayPatch=true;await page.locator('[data-fitment-action="save-rim"]').last().click();while(!releasePatch)await page.waitForTimeout(20);
 await page.evaluate(()=>window.__qa.setVnextFitmentField('rim.offset_et_mm','41'));releasePatch();await page.waitForFunction(()=>!window.__qa.state.fitmentSaving);
 assert.equal(await page.evaluate(()=>window.__qa.state.fitmentForm.rim.offset_et_mm),'41');assert(await page.locator('[data-fitment-action="check"]').isDisabled());await capture('save-race-desktop');
 fs.writeFileSync(out+'/evidence.json',JSON.stringify({checks,requests,errors,viewports:[1440,390],environment:'Local runtime with controlled API responses. Not live staging E2E.'},null,2)+'\n');assert.deepEqual(errors,[]);await browser.close();console.log('Browser PASS',checks.length);
})().catch(e=>{console.error(e);process.exit(1)});
