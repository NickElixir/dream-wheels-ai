const fs=require('node:fs');
const path=require('node:path');
const evidenceDirectory=process.env.E01_EVIDENCE_DIR||'docs/evidence/e01-i18n';
fs.mkdirSync(evidenceDirectory,{recursive:true});
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const browser=await chromium.launch({headless:true});const checks=[];
const scenarios=['dashboard','logged-out','create','result','history','processing','refunded','missing-asset','compatible','conditions','unknown','incompatible','failed','stale','editor','wallet','pending-payment','support','photo-guide','docs','auth-email','auth-otp','auth-restored','auth-restoring','vehicle-editor-loading','vehicle-editor-empty','vehicle-editor-failed','create-generation-service','create-generation-wheel','create-generation-timeout','account-settings','account-settings-error','account-link-email','account-link-otp','account-merge','result-download-started','result-download-failed','result-download-unavailable','starter-expiry','vehicle-photo-invalid','p2a-copy-consistency'];
for(const width of [390,1440])for(const locale of ['ru','en'])for(const scenario of scenarios){
 const page=await browser.newPage({viewport:{width,height:900},locale:locale==='ru'?'ru-RU':'en-US'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8779'?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.goto(`http://127.0.0.1:8779/tests/browser-fixtures/e01-i18n.html?scenario=${scenario}`);
 try{await page.waitForFunction(()=>window.qaReady,{},{timeout:10000});}catch(e){throw Error(JSON.stringify({scenario,locale,errors}));}
 const text=await page.locator('#fixture').innerText();
 const aria=await page.locator('#fixture').evaluate(root=>[...root.querySelectorAll('[aria-label],[alt],[placeholder]')].flatMap(el=>['aria-label','alt','placeholder'].map(name=>el.getAttribute(name)||'')).join('\n'));
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 const clipped=await page.locator('button,.vnext-status').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width && (el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)).map(el=>({text:el.textContent,scroll:el.scrollWidth,width:el.clientWidth})));
 const cyrillic=locale==='en'?[...(text+'\n'+aria).matchAll(/[^\n]*[А-Яа-яЁё][^\n]*/gu)].map(x=>x[0]):[];
 if(overflow||clipped.length||errors.length||cyrillic.length)throw Error(JSON.stringify({width,locale,scenario,overflow,clipped,errors,cyrillic}));

 if(scenario==='p2a-copy-consistency'){
  const expected=locale==='en'?{'auth.loginShort':'Sign in','menu.wallet':'Balance','wallet.title':'Balance','wallet.eyebrow':'Account','create.createRender':'Create a try-on','caption.fitment':'Compatibility','fitment.eyebrow':'Compatibility check','fitment.modification':'Vehicle version','photoGuide.carSection':'Vehicle photo','caption.photoGuide':'How to prepare photos','settings.linked':'Linked','auth.preparing':'Preparing sign-in…','status.generating':'Creating the try-on…'}:{'auth.loginShort':'Войти','menu.wallet':'Баланс','fitment.modification':'Комплектация','auth.preparing':'Подготавливаем вход…','status.generating':'Создаём примерку…'};
  for(const [key,value]of Object.entries(expected))if(await page.locator(`[data-p2-copy="${key}"]`).textContent()!==value)throw Error('legacy semantic copy mismatch: '+key);
  if(text.includes('...'))throw Error('legacy UI has ASCII ellipsis');
 }
 if(locale==='en'){
  const expected={'result-download-started':'Image download started','result-download-failed':'Could not download the image. Try again.','result-download-unavailable':'This try-on is unavailable. Refresh History and try again.','starter-expiry':'Starter package','vehicle-photo-invalid':'Choose a JPEG, PNG or WebP image up to 10 MB.'}[scenario];
  if(expected&&!text.includes(expected))throw Error('new runtime notice missing: '+expected);
 }
 if(scenario.startsWith('vehicle-editor-')){
  if(await page.locator('[data-fitment-field="vehicle.model"]').isEnabled())throw Error('model must wait for make');
  if(locale==='en'){
   if(!text.includes('Select a make first'))throw Error('missing make dependency');
   const expected=scenario.endsWith('empty')?'No makes available':scenario.endsWith('failed')?'Failed to load makes':'Loading makes';
   if(!text.includes(expected))throw Error('catalogue status missing: '+expected);
   const placeholder=await page.locator('[data-fitment-field="vehicle.make"]').innerText();if(!placeholder.includes('Select make'))throw Error('make placeholder');
  }
 }
 if(scenario.startsWith('create-generation-')&&locale==='en'){
  const expected=scenario.endsWith('timeout')?'Refresh status':scenario.endsWith('wheel')?'Replace wheel photo':'Retry';
  if(!text.includes(expected))throw Error('generation action missing: '+expected);
  const lifecycle=await page.evaluate(()=>window.qaLifecycle);if(!lifecycle.includes('Preparing the try-on'))throw Error('preparing status missing');
  if(scenario.endsWith('timeout')&&!lifecycle.includes('Creating the try-on'))throw Error('generating status missing');
 }
 if(scenario.startsWith('account-')&&locale==='ru'){
  const before=await page.evaluate(()=>window.qaAccountState());
  await page.evaluate(()=>window.qaRemount('en'));
  const after=await page.evaluate(()=>window.qaAccountState());if(JSON.stringify(before)!==JSON.stringify(after))throw Error('locale change altered account flow');
  const switched=await page.locator('#fixture').innerText();const attrs=await page.locator('#fixture').evaluate(root=>[...root.querySelectorAll('[aria-label],[alt],[placeholder]')].map(el=>[el.getAttribute('aria-label'),el.getAttribute('alt'),el.getAttribute('placeholder')].join(' ')).join(' '));
  if(/[А-Яа-яЁё]/.test(switched+attrs))throw Error('stale RU account presentation: '+switched);
  checks.push({width,locale:'en',scenario:scenario+'-locale-switch',preserved:after,text:switched});
 }
 checks.push({width,locale,scenario,text,aria,overflow,clipped,errors});
 if(width===390&&locale==='en'&&['dashboard','editor','pending-payment','support','photo-guide','docs','refunded'].includes(scenario))await page.screenshot({path:path.join(evidenceDirectory,`${scenario}-${width}-${locale}.jpg`),fullPage:true,type:'jpeg',quality:75});
 await page.close();
}
// Exercise the production bootstrap and the application locale event on mounted surfaces.
for(const width of [390,1440]) {
 const page=await browser.newPage({viewport:{width,height:900},locale:'ru-RU'});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8779'?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.goto('http://127.0.0.1:8779/tests/browser-fixtures/e01-i18n.html?scenario=support');await page.waitForFunction(()=>window.qaReady);
 await page.evaluate(()=>window.qaBootstrapSurface('support'));
 for(const locale of ['en','ru','en']) {
  await page.evaluate(locale=>window.qaRemount(locale),locale);
  const text=await page.locator('#fixture').innerText();
  if(!text.includes(locale==='en'?'Support':'Поддержка')||(locale==='en'&&/[А-Яа-яЁё]/.test(text)))throw Error('locale switch/remount failed');
  checks.push({width,locale,scenario:'runtime-locale-switch',text});
 }
 await page.close();
}
fs.writeFileSync(path.join(evidenceDirectory,'browser-results.json'),JSON.stringify(checks,null,2)+'\n');await browser.close();console.log(`${checks.length} browser states PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
