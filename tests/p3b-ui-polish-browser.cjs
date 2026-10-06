const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.P3B_EVIDENCE_DIR||'docs/evidence/p3b-ui-polish/corrective';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch(),results=[];
const probe=await b.newPage();for(const file of ['favicon.svg','favicon.ico']){const response=await probe.request.get('http://127.0.0.1:8779/webapp/'+file);if(response.status()!==200)throw Error('favicon asset');}await probe.close();
for(const [width,height]of [[1440,1000],[1280,900],[1024,900],[768,900],[390,844],[360,740],[320,625]])for(const locale of ['ru','en'])for(const scenario of ['result','result43','result-no-fitment','loading','portrait','history','dashboard','failed','compatible','conditions','unknown','incompatible','stale','editor','editor-empty']){
 if(scenario==='result43'&&width<=760)continue;
 const p=await b.newPage({viewport:{width,height},locale:locale==='ru'?'ru-RU':'en-US'}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await p.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:8779'?r.continue():r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 if(scenario==='result43') await p.route('**/demo-render-zeekr-xtrike.jpg', r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#12191f"/></svg>'}));
 if(scenario==='portrait') await p.route('**/demo-render-zeekr-xtrike.jpg', r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="600"><rect width="300" height="600" fill="#12191f"/></svg>'}));
 await p.goto('http://127.0.0.1:8779/tests/browser-fixtures/p3b-ui-polish.html?scenario='+scenario);try{await p.waitForFunction(()=>window.qaReady,{},{timeout:10000});}catch(e){throw Error(JSON.stringify({width,locale,scenario,errors}));}
 await p.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.complete?Promise.resolve():new Promise(r=>{e.onload=r;e.onerror=r}))));
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),broken=await p.locator('img').evaluateAll(es=>es.filter(e=>!e.naturalWidth).length);
 if(overflow||broken||errors.length)throw Error(JSON.stringify({width,locale,scenario,overflow,broken,errors}));
 const metric={width,height,locale,scenario,overflow,broken,errors};
 if(!['result','result43','result-no-fitment','loading','portrait','history'].includes(scenario)&&await p.locator('h1').count()!==1)throw Error('page H1 count');
 if(scenario==='portrait'){const box=await p.locator('[data-compare]').boundingBox();const handle=await p.locator('.vnext-compare-handle').boundingBox();metric.frame=box;metric.handle=handle;if(box.height>height*(width<=760?.6:.8)+1||Math.abs(box.width/box.height-.5)>.01||handle.y<0||handle.y+handle.height>height)throw Error('portrait frame');}
 if(scenario==='result43'&&[1440,1024,768].includes(width)){const before=JSON.parse(fs.readFileSync('docs/evidence/p3b-ui-polish/corrective/baseline.json')).find(x=>x.scenario==='result'&&x.width===width&&x.locale===locale);const box=await p.locator('[data-compare]').boundingBox(),cap=Math.min(height*.75,820),h=Math.min(before.frame.width*.75,cap);if(Math.abs(box.height-h)>1||Math.abs(box.width-h*4/3)>1)throw Error('landscape 4:3 geometry');}
 if(scenario.startsWith('result')){
  metric.actions=await p.locator('.vnext-result-actions button').evaluateAll(es=>es.map(e=>({action:e.dataset.renderAction,height:e.getBoundingClientRect().height,bottom:e.getBoundingClientRect().bottom,left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width})));
  metric.navTop=await p.locator('.vnext-shell__bottom-nav').evaluate(e=>e.getBoundingClientRect().top);
  if(metric.actions.some(x=>x.height<44))throw Error('touch');
  if([390,360].includes(width)&&metric.actions.some(x=>x.bottom>metric.navTop))throw Error(JSON.stringify(metric));
  if(width===320&&metric.actions[0].bottom>metric.navTop)throw Error(JSON.stringify(metric));
  const actions=metric.actions.map(x=>x.action);if(JSON.stringify(actions)!==JSON.stringify(scenario!=='result-no-fitment'?['repeat','fitment','download']:['repeat','download']))throw Error('order');
  if(scenario==='result'||scenario==='result43'){
   const labels=await p.locator('[data-render-action="fitment"],[data-render-action="download"]').evaluateAll(es=>es.map(e=>{const css=getComputedStyle(e),range=document.createRange();range.selectNodeContents(e);const bounds=range.getBoundingClientRect(),box=e.getBoundingClientRect();return {text:e.innerText,textHeight:bounds.height,lineHeight:parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.5,clipped:e.scrollWidth>e.clientWidth+1||bounds.left<box.left||bounds.right>box.right};}));
   metric.labels=labels;if(labels.some(x=>x.clipped||x.textHeight>x.lineHeight*1.5))throw Error(JSON.stringify({width,locale,labels}));
   if(scenario==='result'&&width===1440){const before=JSON.parse(fs.readFileSync('docs/evidence/p3b-ui-polish/corrective/baseline.json')).find(x=>x.scenario==='result'&&x.width===1440&&x.locale===locale);const box=await p.locator('[data-compare]').boundingBox();if(Math.abs(box.width-before.frame.width)>1||Math.abs(box.height-before.frame.height)>1)throw Error('landscape geometry changed');}
   assertEqualWidths(metric.actions[1],metric.actions[2]);await p.locator('[data-render-action="repeat"]').focus();await p.keyboard.press('Tab');if(!await p.locator('[data-render-action="fitment"]').evaluate(e=>e===document.activeElement))throw Error('tab order');await p.keyboard.press('Tab');if(!await p.locator('[data-render-action="download"]').evaluate(e=>e===document.activeElement))throw Error('tab order');}
  await p.locator('[data-render-action="download"]').click();if(!(await p.evaluate(()=>window.qaActions)).includes('download'))throw Error('download delegation');
  const borders=await p.locator('.vnext-result-meta,.vnext-rating,.vnext-shell__topbar').evaluateAll(es=>es.map(e=>[getComputedStyle(e).borderTopWidth,getComputedStyle(e).borderBottomWidth]));if(borders.some(x=>x.some(y=>y!=='0px')))throw Error('divider');
 }
 if(scenario==='editor'){
  await p.locator('[data-fitment-focus="rim.offset_et_mm"]').focus();await p.keyboard.press('Tab');
  if(!await p.locator('[data-wheel-picker-open="rim.offset_et_mm"]').evaluate(e=>e===document.activeElement))throw Error('ET tab sequence');
  await p.keyboard.press('Tab');if(!await p.locator('[data-fitment-focus="rim.center_bore_mm"]').evaluate(e=>e===document.activeElement))throw Error('DIA tab sequence');
  await p.locator('[data-wheel-picker-open="rim.offset_et_mm"]').click();await p.locator('[data-wheel-picker-value="40"]').first().click();
  if(!await p.locator('[data-wheel-picker-open="rim.offset_et_mm"]').evaluate(e=>e===document.activeElement))throw Error('picker focus restore');
  if(!(await p.evaluate(()=>window.qaActions)).some(x=>x.path==='rim.offset_et_mm'&&x.value==='40'))throw Error('picker field delegation');
 }
 if(scenario==='loading'){
  const spin=await p.locator('.vnext-compare-loading').boundingBox(),handle=await p.locator('.vnext-compare-handle').boundingBox();
  if(!spin||spin.x+spin.width>handle.x&&spin.x<handle.x+handle.width)throw Error('loading overlap');
 }
 if(scenario==='failed'){
  const text=await p.locator('[data-vnext-fitment-root]').innerText();if(text.split(locale==='ru'?'Проверку выполнить не удалось':'The check could not be completed').length-1!==1)throw Error('failure repeats');
  if(!await p.locator('[data-fitment-action="check"]').isDisabled()||!await p.locator('.vnext-fitment__retry-reason').isVisible())throw Error('disabled reason');
 }
 if(['compatible','conditions'].includes(scenario)){const values=await p.locator('.vnext-fitment__comparison-table tbody tr').evaluateAll(es=>es.flatMap(row=>[row.cells[1].textContent,row.cells[2].textContent]));if(values.some(v=>v.includes(locale==='ru'?'Нет данных':'No data')))throw Error('fixture missing reference values');}
 if(scenario==='history'){const text=await p.locator('.vnext-history-list').innerText();if(text.includes(locale==='ru'?'Готово':'Ready'))throw Error('completed status');}
 if(scenario==='dashboard'){const model=await p.evaluate(()=>window.qaDashboard);if(model.latest!=='qa-completed'||!model.latestFailed)throw Error('dashboard selection');await p.getByRole('button',{name:locale==='ru'?'Открыть историю':'Open History',exact:true}).click();if(!(await p.evaluate(()=>window.qaActions)).includes('renders'))throw Error('history delegation');}
 const capture=(scenario==='portrait'&&[1440,1024].includes(width)&&locale==='ru')||(scenario==='result'&&[1440,1024,390].includes(width))||(scenario==='dashboard'&&[1440,1024,390].includes(width)&&locale==='ru')||(['compatible','editor'].includes(scenario)&&[1440,390].includes(width)&&locale==='ru');
 if(capture)await p.screenshot({path:path.join(out,`after-focused-${scenario}-${width}-${locale}.jpg`),type:'jpeg',quality:72,fullPage:!['result','portrait'].includes(scenario)});
 results.push(metric);await p.close();
}
await b.close();fs.writeFileSync(path.join(out,'focused-browser-results.json'),JSON.stringify(results,null,2)+'\n');console.log(results.length+' focused states PASS');
function assertEqualWidths(a,b){if(Math.abs(a.width-b.width)>1||Math.abs(a.bottom-b.bottom)>1)throw Error('secondary row');}
})().catch(e=>{console.error(e);process.exit(1)});
