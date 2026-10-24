import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractFunction} from '../../tests/helpers/source-extract.mjs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const functions=['accountTryOnTitle','homeRenderTitle','historyGalleryTitle'];
for (const locale of ['ru','en']) test(`stable server numbers and safe title fallback ${locale}`,()=>{
 const ctx={locale};vm.createContext(ctx);
 for(const fn of functions)vm.runInContext(extractFunction(source,fn),ctx);
 const label=locale==='ru'?'Примерка':'Try-on';
 const job={job_id:'abcdef-uuid',try_on_number:12,render_input_snapshot:{rim:{brand:'BBS',model:'CH-R'}}};
 for(const fn of functions){
   assert.equal(ctx[fn](job),`${label} #12`);
   for(const n of [undefined,null,0,-1,'12',1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(ctx[fn]({...job,try_on_number:n}),label);
   assert.equal(ctx[fn]({...job,vehicle_identity:{make:'BMW',model:'3 Series',is_user_confirmed:true}}),'BMW 3 Series');
   assert.equal(ctx[fn]({...job,vehicle_identity:{make:'AI Ghost',is_user_confirmed:false}}),`${label} #12`);
   for (const row of [{...job,try_on_number:20},job].reverse())assert.equal(ctx[fn](row),`${label} #${row.try_on_number}`);
 }
 assert.match(extractFunction(source,'vnextRenderJob'),/title: accountTryOnTitle\(job\)/);
});
