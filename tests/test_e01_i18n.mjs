import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import { COPY, copy, applicationLocale, localeOf, legacyTranslations, errorCopy, unknownVerdictSubtitle } from '../webapp/vnext/copy.mjs';
import { fitmentMarkup } from '../webapp/vnext/views/fitment.js';
import { processingMarkup, resultMarkup, historyMarkup } from '../webapp/vnext/views/render.js';
import { supportViewModel } from '../webapp/vnext/models/support.js';
import { photoGuideViewModel } from '../webapp/vnext/models/photo-guide.js';
import { documentsViewModel } from '../webapp/vnext/models/documents.js';
const root=new URL('../',import.meta.url);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(dir,item.name)):[path.join(dir,item.name)]);}
test('E-01: every static copy reference has two nonempty translations',()=>{
 const sources=[...files(fileURLToPath(new URL('webapp/vnext/',root))),new URL('webapp/app.js',root)].filter(file=>/\.(?:js|mjs)$/.test(String(file))&&!String(file).endsWith('copy.mjs'));
 for(const file of sources)for(const [,key] of fs.readFileSync(file,'utf8').matchAll(/\b(?:copy|uiCopy|uiText)\("([^"]+)"/gu))assert.ok(Object.hasOwn(COPY,key),`${file}: ${key}`);
 for(const [key,pair] of Object.entries(COPY))for(const locale of ['ru','en']){assert.equal(typeof pair[locale],'string',key);assert.ok(pair[locale].trim(),key);assert.equal(pair[locale],pair[locale].trim(),key);if(locale==='en')assert.doesNotMatch(pair.en,/[А-Яа-яЁё]/u,key);}
 for(const [,key] of fs.readFileSync(new URL('webapp/index.html',root),'utf8').matchAll(/data-copy-(?:aria|placeholder)="([^"]+)"/gu))assert.ok(Object.hasOwn(COPY,key),key);
 for(const row of JSON.parse(fs.readFileSync(new URL('docs/evidence/e01-i18n/key-inventory.json',root))))if(row.new_key)assert.ok(Object.hasOwn(COPY,row.new_key),row.new_key);
});
test('E-01: absent and prototype keys warn and safely return the requested key',()=>{
 const warnings=[],previous=console.warn;console.warn=message=>warnings.push(message);
 try{for(const key of ['typo.key','toString','constructor','__proto__'])assert.equal(copy(key,'en'),key);}finally{console.warn=previous;}
 assert.equal(warnings.length,4);
});
test('E-01: interpolation uses complete phrases and preserves punctuation',()=>{
 assert.equal(copy('fitment.requiredField','en',{value0:'ET'}),'Fill in “ET”');
 assert.equal(copy('fitment.requiredField','ru',{value0:'ET'}),'Заполните поле «ET»');
 assert.equal(copy('fitment.picker.etHint','ru'),'ET — от −150 до +150 мм. Без округления.');
 assert.equal(copy('fitment.picker.etHint','en'),'ET — from −150 to +150 mm. Do not round the value.');
 assert.equal(Object.hasOwn(COPY,'fitment.picker.noRounding'),false);
});
test('E-01: explicit locale overrides the application default in models and renderers',()=>{
 const previous=globalThis.document;globalThis.document={documentElement:{lang:'ru'}};
 try{
 assert.equal(applicationLocale(),'ru');assert.equal(localeOf({locale:'en'}),'en');
 for(const factory of [supportViewModel,photoGuideViewModel,documentsViewModel])assert.doesNotMatch(JSON.stringify(factory('en')),/[А-Яа-яЁё]/u);
 for(const render of [fitmentMarkup,processingMarkup,resultMarkup,historyMarkup])assert.doesNotMatch(render({locale:'en',rows:[],status:'processing',overview:{}}),/[А-Яа-яЁё]/u);
 globalThis.document.documentElement.lang='en';assert.equal(localeOf({}), 'en');
 assert.match(fitmentMarkup({locale:'ru'}),/Проверка совместимости/u);
 }finally{globalThis.document=previous;}
});
test('E-01: user/provider labels are preserved and dynamic markup is escaped',()=>{
 const title='Автомобиль Coupe AWD FWD <script>';
 const markup=fitmentMarkup({locale:'en',vehicleTitle:title,rimTitle:'Диск',overview:{}});
 assert.ok(markup.includes('Автомобиль Coupe AWD FWD &lt;script&gt;'));
 assert.ok(markup.includes('Диск'));
 const conflict=fitmentMarkup({locale:'en',rimEditing:true,resolver:{conflicts:[{field:'wheel_width_j',current:'<script>',suggested:'8.5'}]}});
 assert.doesNotMatch(conflict,/<script>/u);
 assert.match(conflict,/Current Width value/u);
 assert.equal(unknownVerdictSubtitle({locale:'en',check:{execution_status:'completed',verdict:'unknown',blocking_issues:[{code:'constructor'}]}}),copy('fitment.verdict.unknown.fallback','en'));
});

test('E-01: error codes are localized, unknown codes are neutral and safe text is preserved',()=>{
 assert.equal(errorCopy({code:'throttled'},'en'),copy('errors.throttled','en'));
 assert.equal(errorCopy({code:'constructor'},'ru'),copy('errors.generic','ru'));
 assert.equal(errorCopy({code:'unknown_code'},'en'),copy('errors.generic','en'));
 assert.equal(errorCopy({safe_text:'Автомобиль Coupe AWD FWD'},'en'),'Автомобиль Coupe AWD FWD');
});

test('E-01: legacy catalogue adapter preserves the approved bilingual dictionary',()=>{
 const canonical=value=>value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 // Staging dictionary plus translations for three missing EN result keys and the missing RU wallet details label.
 assert.equal(createHash('sha256').update(JSON.stringify(canonical(legacyTranslations()))).digest('hex'),'9b465cf4c4331f584aeff1aa7b85dabb5e8a2d9dab2bbecd1377bd8acb44f44d');
});
