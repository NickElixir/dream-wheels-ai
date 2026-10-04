const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const snapshotFile='tests/evidence/p1-copy/browser-snapshots.json';
const baseline=process.env.UPDATE_P1_SNAPSHOTS==='1'?null:JSON.parse(fs.readFileSync(snapshotFile,'utf8'));
(async()=>{
const browser=await chromium.launch({headless:true});const checks=[];
for(const width of [390,1440])for(const locale of ['ru','en'])for(const scenario of ['create','result','history','compatible','conditions','unknown','incompatible','failed','stale']){
 const page=await browser.newPage({viewport:{width,height:900},locale:locale==='ru'?'ru-RU':'en-US'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8779'?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await page.goto(`http://127.0.0.1:8779/tests/browser-fixtures/p1-copy.html?scenario=${scenario}`);
 await page.waitForFunction(()=>window.qaReady);
 const text=await page.locator('#fixture').innerText();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 const clipped=await page.locator('button,.vnext-status').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width && (el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1)).map(el=>({text:el.textContent,scroll:el.scrollWidth,width:el.clientWidth})));
 if(overflow||clipped.length||errors.length)throw Error(JSON.stringify({width,locale,scenario,overflow,clipped,errors}));
 if(!text.includes(locale==='en'?'History':'История'))throw Error('history navigation');
 if(scenario==='unknown'&&!text.includes(locale==='en'?'This size is not listed in the reference data for your vehicle.':'Этого размера нет в справочных данных для вашей машины.'))throw Error('unknown fallback');
 if(scenario==='result'&&!text.includes(locale==='en'?'Create another version':'Создать ещё вариант'))throw Error('result CTA');
 if(scenario==='create'&&!text.includes(locale==='en'?'Create a try-on':'Создать примерку'))throw Error('Create title');
 const snapshot={width,locale,scenario,text,overflow,clipped,errors};checks.push(snapshot);
 await page.screenshot({path:`tests/evidence/p1-copy/${scenario}-${width}-${locale}.jpg`,fullPage:true,type:'jpeg',quality:80});await page.close();
}
if(baseline)assert.deepEqual(checks,baseline,'Browser copy snapshots changed; review before updating the baseline.');
else fs.writeFileSync(snapshotFile,JSON.stringify(checks,null,2)+'\n');await browser.close();console.log(`${checks.length} browser snapshots PASS`);
})().catch(e=>{console.error(e);process.exit(1)});
