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

test('P2-A: legacy catalogue digest is a secondary reviewed-change detector',()=>{
 const canonical=value=>value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 // Semantic groups, leaves, intentional empties and concepts are checked independently below.
 assert.equal(createHash('sha256').update(JSON.stringify(canonical(legacyTranslations()))).digest('hex'),'fca177956b5d3d0c516c55301831048ad5a9b1a1905e793df69fd514b1d49c50');
});

test('E-01 corrective: every dynamic reason/error mapping exists and resolves in RU/EN',()=>{
 const source=fs.readFileSync(new URL('webapp/vnext/copy.mjs',root),'utf8');
 for(const name of ['unknownReasonKeys','errorKeys']){
  const match=source.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\});`));assert.ok(match,name);
  const entries=Function(`return (${match[1]})`)();assert.ok(Object.keys(entries).length>0);
  for(const [code,value] of Object.entries(entries))for(const locale of ['ru','en']){
   const key=name==='unknownReasonKeys'?`fitment.verdict.unknown.${value}`:value;
   assert.ok(Object.hasOwn(COPY,key),`${name}.${code}: ${key}`);assert.ok(COPY[key][locale]);
   const actual=name==='errorKeys'?errorCopy({code},locale):unknownVerdictSubtitle({locale,check:{execution_status:'completed',verdict:'unknown',blocking_issues:[{code}]}});
   assert.equal(actual,copy(key,locale),`${name}.${code} ${locale}`);
  }
 }
 assert.equal(copy('fitment.confirmation.remaining','en',{count:1}),'Parameters left to confirm: 1');
});

test('P2-A: required legacy groups, bilingual leaves and intentional empties have an explicit contract',()=>{
 const dictionaries=legacyTranslations();
 const required=['auth','menu','caption','dashboard','create','fitment','wallet','renders','settings','photoGuide','support','docs','status','actions','errors','warnings','consent','steps','result','share'];
 const intentionalEmpty=['wallet.stepChooseSub','wallet.confirmHint','wallet.securePaymentTitle','wallet.securePaymentText','wallet.paymentHistoryHint','wallet.topUpHistoryHint','renders.lede'].sort();
 const leaves=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>typeof item==='object'?leaves(item,prefix+key+'.'):[[prefix+key,item]]);
 for(const path of intentionalEmpty)assert.equal(Object.hasOwn(COPY,`legacy.${path}`),false,`${path}: empty compatibility slots must not hide catalog text`);
 const paths={};
 for(const locale of ['ru','en']){
  for(const group of required){assert.ok(Object.hasOwn(dictionaries[locale],group),`${locale}.${group}`);assert.equal(typeof dictionaries[locale][group],'object',`${locale}.${group}`);}
  paths[locale]=Object.fromEntries(leaves(dictionaries[locale]));
  assert.deepEqual(Object.entries(paths[locale]).filter(([,value])=>value==='').map(([path])=>path).sort(),intentionalEmpty,`${locale}: only known slots may be empty`);
  for(const [path,value] of Object.entries(paths[locale])){
   assert.equal(typeof value,'string',`${locale}.${path}`);
   if(intentionalEmpty.includes(path))continue;
   const key=`legacy.${path}`;assert.ok(Object.hasOwn(COPY,key),`${locale}.${path} must derive from COPY`);
   assert.equal(value,COPY[key][locale],`${locale}.${path}`);assert.ok(value.trim(),`${locale}.${path}`);
  }
  for(const key of Object.keys(COPY).filter(key=>key.startsWith('legacy.')))assert.ok(Object.hasOwn(paths[locale],key.slice(7)),`${locale}: ${key} missing from adapter`);
 }
 assert.deepEqual(Object.keys(paths.ru).sort(),Object.keys(paths.en).sort());
});

test('P2-A: equivalent concepts agree with approved canonical keys, with context distinctions preserved',()=>{
 const concepts=[
  ['auth.login','Войти','Sign in',['legacy.auth.loginShort','legacy.auth.verify']],
  ['nav.wallet','Баланс','Balance',['legacy.menu.wallet','legacy.caption.wallet','legacy.wallet.title','legacy.wallet.balanceLabel']],
  ['account.cabinet','Кабинет','Account',['legacy.wallet.eyebrow']],
  ['nav.create','Создать примерку','Create a try-on',['legacy.menu.create','legacy.caption.create','legacy.create.title','legacy.create.createRender']],
  ['nav.history','История','History',['legacy.menu.renders','legacy.caption.renders','legacy.renders.title']],
  ['fitment.vehicleVersion2','Комплектация','Vehicle version',['legacy.fitment.modification']],
  ['page.fitment','Совместимость','Compatibility',['legacy.caption.fitment']],
  ['fitment.compatibilityCheck','Проверка совместимости','Compatibility check',['legacy.fitment.eyebrow']],
  ['create.vehiclePhoto','Фото автомобиля','Vehicle photo',['legacy.create.carPhoto','legacy.photoGuide.carSection']],
  ['photoguide.theWholeCarIsVisible','Автомобиль виден целиком','The whole vehicle is visible',['legacy.photoGuide.carCheck1']],
  ['documents.refundTerms','Условия возврата','Refund terms',['legacy.wallet.refundLink','legacy.support.refundTitle','legacy.docs.refund']],
  ['nav.photoGuide','Как подготовить фото','How to prepare photos',['legacy.caption.photoGuide','legacy.photoGuide.title','legacy.support.photoGuideTitle']],
  ['account.settings.linked','Подключено','Linked',['legacy.settings.linked']],
  ['account.link.preparing','Подготавливаем вход…','Preparing sign-in…',['legacy.auth.preparing']],
  ['generation.error.vehicle.replace','Заменить фото автомобиля','Replace vehicle photo',['legacy.create.replaceCar']],
 ];
 for(const [key,ru,en,equivalents] of concepts){assert.deepEqual(COPY[key],{ru,en},`${key}: canonical meaning`);for(const equivalent of equivalents){assert.ok(Object.hasOwn(COPY,equivalent),equivalent);assert.equal(COPY[equivalent].en,en,`${equivalent}: same user concept`);}}
 assert.equal(COPY['legacy.status.upTo90'].en,COPY['create.thisMayTakeUpToSeconds'].en);
 assert.equal(COPY['render.thisCanTakeUpToSeconds'].en,COPY['create.thisMayTakeUpToSeconds'].en);
 assert.deepEqual(COPY['render.generatingRender'],COPY['legacy.status.generating']);
 for(const [key,expected] of [['fitment.row.matches','Matches'],['fitment.compatible','Compatible'],['legacy.photoGuide.carGoodLabel','Works well'],['fitment.checkAgain','Check again'],['legacy.errors.identityRetryAction','Retry'],['legacy.menu.photoGuide','Photo guide'],['legacy.wallet.refreshInvoice','Refresh invoice'],['action.refreshStatus','Refresh status'],['legacy.auth.sessionExpiredTitle','Session expired'],['auth.sessionExpired','Your session has expired.']])assert.equal(COPY[key].en,expected,`${key}: intentionally different context`);
 assert.equal(COPY['legacy.wallet.paymentHistory'].en,'Payment history');
 assert.equal(COPY['legacy.wallet.topUpHistory'].en,'Top-up history');
});

test('P2-A: controlled UI ellipses normalize without rewriting external strings or technical tokens',()=>{
 for(const [key,pair]of Object.entries(COPY))for(const locale of ['ru','en'])assert.ok(!pair[locale].includes('...'),`${key}.${locale}`);
 const raw='User ... text https://example.test/a...b Coupe AWD FWD ET PCD DIA';
 assert.equal(errorCopy({safe_text:raw},'en'),raw);
 assert.equal(copy('fitment.requiredField','en',{value0:raw}),`Fill in “${raw}”`);
 for(const token of ['ET','PCD','DIA'])assert.equal(copy(`wheel.${token.toLowerCase()}`,'en'),token);
 assert.ok(fs.readFileSync(new URL('webapp/index.html',root),'utf8').includes('data-i18n="wallet.loading" data-i18n-sentence>Загружаем кабинет…'));
});
