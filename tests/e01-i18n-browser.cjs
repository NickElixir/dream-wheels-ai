const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
const browser=await chromium.launch({headless:true});const checks=[];
const scenarios=['dashboard','logged-out','create','result','history','processing','refunded','missing-asset','compatible','conditions','unknown','incompatible','failed','stale','editor','wallet','pending-payment','support','photo-guide','docs','auth-email','auth-otp','auth-restored','auth-restoring'];
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
 checks.push({width,locale,scenario,text,aria,overflow,clipped,errors});
 if(width===390&&locale==='en'&&['dashboard','editor','pending-payment','support','photo-guide','docs','refunded'].includes(scenario))await page.screenshot({path:`docs/evidence/e01-i18n/${scenario}-${width}-${locale}.jpg`,fullPage:true,type:'jpeg',quality:75});
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
fs.writeFileSync('docs/evidence/e01-i18n/browser-results.json',JSON.stringify(checks,null,2)+'\n');await browser.close();console.log(`${checks.length} browser states PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
