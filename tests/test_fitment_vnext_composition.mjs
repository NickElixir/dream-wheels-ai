import { fitmentMarkup } from "../webapp/vnext/views/fitment.js";
import { COPY, copy, legacyTranslations, applicationLocale, localeOf, escapeCopy, unknownVerdictSubtitle } from "../webapp/vnext/copy.mjs";
import { fitmentDisplayValue } from "../webapp/vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "webapp/vnext/views/fitment.js"), "utf8")
  .replaceAll("export function ", "function ")
  .replace(/import \{[^\n]+\} from "\.\.\/copy\.mjs";/u, "")
  .replace(/import \{ fitmentDisplayValue \} from "\.\.\/fitment-display\.mjs";/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};`);
const context = {};
runInCopyContext(`${source}\nglobalThis.fitmentMarkup = fitmentMarkup;`, context);

test("VNext composition keeps independent source cards and a full-width editor before the result", () => {
  const markup = context.fitmentMarkup({
    overview: { vehicle_state: "unconfirmed", rim_setup_state: "confirmed_ready" },
    nextAction: "complete_vehicle_details",
    vehicleTitle: "Zeekr 007", rimTitle: "BBS CI-R",
    rimSourceDomain: "shop.example.ru", rimEditing: true,
    rim: { offset_et_mm: 35.25 },
    check: { execution_status: "completed", verdict: "incompatible", is_current: true },
    canRunCheck: false,
  });
  assert.ok(markup.indexOf('class="vnext-fitment__pair"') < markup.indexOf('class="vnext-fitment__active-editor"'));
  assert.ok(markup.indexOf('class="vnext-fitment__active-editor"') < markup.indexOf('class="vnext-fitment__verdict'));
  assert.ok(markup.indexOf('class="vnext-fitment__verdict') < markup.indexOf('class="vnext-fitment__standard"'));
  assert.match(markup, /data-fitment-action="edit-vehicle"/);
  assert.match(markup, /data-fitment-action="edit-rim"/);
  assert.match(markup, /data-fitment-action="recognize-vehicle"[^>]*disabled/);
  assert.match(markup, /data-fitment-action="resolve-rim"/);
  assert.match(markup, /shop\.example\.ru/);
  assert.equal((markup.match(/data-fitment-action="create-image"/g) || []).length, 1);
  assert.match(markup, /data-fitment-action="check"[^>]*disabled/);
});

test("a Wheel editor remains the only editor when the server requests a Vehicle variant", () => {
  const markup = context.fitmentMarkup({
    overview: { vehicle_state: "confirmed_incomplete", rim_setup_state: "partial" },
    nextAction: "select_vehicle_variant", activeSection: "rim",
    rimEditing: true, vehicleEditing: false,
    vehicleVariants: [{ label: "2.0 AWD" }],
    rim: { offset_et_mm: 35.25 },
  });
  assert.match(markup, /data-wheel-picker-open="rim\.offset_et_mm"/);
  assert.doesNotMatch(markup, /class="vnext-fitment__variant-step"/);
  assert.match(markup, /Выберите комплектацию автомобиля/);
  assert.match(markup, /data-fitment-action="edit-vehicle"/);
  assert.match(markup, /data-fitment-action="check"[^>]*disabled/);
});

const workspace = markup => [...markup.matchAll(/data-fitment-workspace-kind="([^"]+)"/g)].map(match => match[1]);
const cases = [
  ["idle", {}, "none"],
  ...["loading", "proposed", "failed"].map(status => [status, {activeSection:"vehicle", vehicleEditing:true, vehicleRecognition:{status,canRecognize:true,candidates:[{make:"Audi",model:"Q8",year_start:2018,year_end:2023}]}}, "vehicle-recognition"]),
  ["applied", {vehicleEditing:true,vehicleRecognition:{status:"applied"}}, "vehicle-editor"],
  ["base confirmation", {vehicleEditing:true,vehicleAwaitingConfirmation:true}, "vehicle-editor"],
  ["required variant", {nextAction:"select_vehicle_variant"}, "vehicle-variant"],
  ["reselect", {vehicleVariantPickerOpen:true,vehicleVariantMode:"reselect"}, "vehicle-variant"],
  ["manual fallback", {nextAction:"select_vehicle_variant",vehicleEditing:true,manualVehicleEditing:true}, "vehicle-editor"],
  ["Wheel", {rimEditing:true,activeSection:"rim"}, "rim-editor"],
  ["SKU", {rimEditing:true,resolver:{chooserOpen:true,variants:[{sku:"A",values:{}}]}}, "rim-editor"],
  ["Wheel with pending recognition and variant", {nextAction:"select_vehicle_variant",rimEditing:true,vehicleEditing:true,activeSection:"rim",vehicleRecognition:{status:"proposed"},vehicleVariantPickerOpen:true}, "rim-editor"],
  ["manual Vehicle with retained recognition", {vehicleEditing:true,activeSection:"vehicle",vehicleRecognition:{status:"proposed",workspaceOpen:false}}, "vehicle-editor"],
];
for (const [name, model, expected] of cases) test(`single Active Workspace: ${name}`, () => {
  const markup = context.fitmentMarkup(model);
  assert.deepEqual(workspace(markup), expected === "none" ? [] : [expected]);
  assert.equal((markup.match(/data-fitment-active-workspace/g) || []).length,1);
  assert.equal((markup.match(/data-fitment-workspace=/g) || []).length, expected === "none" ? 0 : 1);
  assert.equal((markup.match(/class="vnext-fitment__object(?: |")/g) || []).length,2);
  assert.doesNotMatch(markup, /<hr\b|decorative-divider/);
});

test("recognition candidate uses its whole button and disappears after applying", () => {
  const recognition={status:"proposed",candidates:[{make:"Audi",model:"Q8",year_start:2018,year_end:2023}]};
  const markup=context.fitmentMarkup({vehicleRecognition:recognition});
  assert.match(markup,/Распознавание автомобиля/);
  assert.match(markup,/Распознано по фотографии/);
  assert.match(markup,/aria-label="Audi Q8 2018–2023"/);
  assert.doesNotMatch(markup,/Использовать|Предложено по фотографии/);
  const applied=context.fitmentMarkup({vehicleRecognition:{...recognition,status:"applied"},vehicleEditing:true});
  assert.doesNotMatch(applied,/fitment-recognition-title|Распознано по фотографии/);
  assert.match(applied,/Укажите автомобиль/);
});

test("confirmed configuration is a primary value without duplicate status labels", () => {
  const markup=context.fitmentMarkup({vehicleStatus:"Комплектация подтверждена",vehicleVariantName:"55 TFSI quattro",vehicleVariantTechnical:"Россия+ · 4M Facelift",canReselectVehicleVariant:true});
  assert.match(markup,/<strong>55 TFSI quattro<\/strong>/);
  assert.match(markup,/<small>Россия\+ · 4M Facelift<\/small>/);
  assert.match(markup,/<span>Подтверждено<\/span>/);
  assert.doesNotMatch(markup,/Комплектация подтверждена|Комплектация 55/);
});

test("ET accessible names contain the label once for confirmed, proposed and missing", () => {
  for (const pending of [[],["offset_et_mm"]]) {
    const markup=context.fitmentMarkup({rimEditing:true,rim:{offset_et_mm:40},rimPendingProposals:pending});
    assert.doesNotMatch(markup,/ET ET/);
    assert.match(markup, pending.length ? /aria-label="Подтвердить предложение ET 40"/ : /aria-label="Подтверждено ET 40"/);
  }
  assert.match(context.fitmentMarkup({rimEditing:true}), /aria-label="Выбрать ET Не выбрано"/);
});

test("new workspace copy is translated in EN", () => {
  const markup=context.fitmentMarkup({locale:"en",vehicleRecognition:{status:"proposed",candidates:[{make:"Audi",model:"Q8",year:2020}]}});
  assert.match(markup,/Vehicle recognition|Recognized from the photo/);
  assert.doesNotMatch(markup,/[А-Яа-яЁё]/);
  assert.match(context.fitmentMarkup({locale:"en",rimEditing:true}),/Wheel parameters/);
  assert.match(context.fitmentMarkup({locale:"en",nextAction:"select_vehicle_variant"}),/Vehicle version/);
});

for (const locale of ["ru", "en"]) {
  test(`overall unknown preserves six independent result rows (${locale})`, () => {
    const fieldEvidence = [
      ["wheel_diameter_in", "pass", "19", "19"], ["wheel_width_j", "unknown", "8.5", "10"],
      ["offset_et_mm", "unknown", null, "45"], ["pcd", "pass", "112", "112"],
      ["bolt_count", "pass", "5", "5"], ["center_bore_mm", "pass", "66.6", "66.6"],
    ].map(([field, status, vehicleValue, rimValue]) => ({field, status, vehicleValue, rimValue}));
    const markup = context.fitmentMarkup({locale, overview: {}, executionStatus: "completed", nextAction: "run_standard_check", check: {execution_status: "completed", verdict: "unknown"}, fieldEvidence, blockingIssues: [{label: "Combination missing from reference"}]});
    const table = markup.match(/<table[\s\S]*?<\/table>/u)[0];
    assert.equal([...table.matchAll(/<th scope="row">/gu)].length, 6);
    assert.equal([...table.matchAll(new RegExp(`<td class="vnext-fitment__row-result">${locale === "en" ? "Matches" : "Подходит"}</td>`, "gu"))].length, 4);
    assert.equal([...table.matchAll(new RegExp(`<td class="vnext-fitment__row-result">${locale === "en" ? "No data" : "Нет данных"}</td>`, "gu"))].length, 2);
    assert.match(table, /<th scope="row">PCD<\/th>/u);
    assert.ok(table.includes(`<th scope="row">${locale === "en" ? "Bolt count" : "Количество отверстий"}</th>`));
    assert.doesNotMatch(table, /5×112/u);
    assert.match(markup, /Combination missing from reference/u);
  });
}

test("unknown overall still separates axle tables when only field status differs", () => {
  const fieldEvidence = ["front", "rear"].flatMap(axle => ["pcd", "bolt_count"].map(field => ({axle, field, vehicleValue: "5", rimValue: "5", status: axle === "front" ? "pass" : "fail"})));
  const markup = context.fitmentMarkup({overview: {}, executionStatus: "completed", check: {execution_status: "completed", verdict: "unknown"}, fieldEvidence});
  assert.equal([...markup.matchAll(/<table /gu)].length, 2);
  assert.match(markup, /vnext-fitment__row-result--fail/u);
});

test("overall combination warning and missing contextual ET copy remain explicit in RU/EN", () => {
  const app = fs.readFileSync(path.join(root, "webapp/app.js"), "utf8");
  const start = app.indexOf("function fitmentVerdictMessage(");
  const copy = app.slice(start, app.indexOf("\nfunction ", start + 1));
  for (const locale of ["ru", "en"]) {
    const copyContext = {locale};
    runInCopyContext(`${copy}\nglobalThis.message = fitmentVerdictMessage;`, copyContext);
    assert.match(copyContext.message({code: "size_not_in_reference"}), locale === "ru" ? /Этот размер не найден/u : /This size is not listed/u);
    assert.match(copyContext.message({code: "vehicle_reference_offset_missing"}), locale === "ru" ? /Для выбранного размера нет справочных данных по ET/u : /No ET reference.*selected size/u);
  }
});

function resultCopyApi(locale) {
  const app = fs.readFileSync(path.join(root, "webapp/app.js"), "utf8");
  const extract = name => {
    const start = app.indexOf(`function ${name}(`);
    return app.slice(start, app.indexOf("\nfunction ", start + 1));
  };
  const resultContext = {locale, fitmentDisplayValue, normalizeFitmentText: value => String(value ?? "").trim()};
  runInCopyContext(`${extract("formatIdentityNumber")}\n${extract("fitmentVerdictMessage")}\n${extract("fitmentResultBlockingCopy")}\nglobalThis.copy = fitmentResultBlockingCopy; globalThis.message = fitmentVerdictMessage;`, resultContext);
  return resultContext;
}
const responses = JSON.parse(fs.readFileSync(path.join(root, "docs/evidence/p05e-fitment-field-evidence/representative-api.json"), "utf8"));

for (const locale of ["ru", "en"]) {
  test(`result copy distinguishes unknown and incompatible with backend field evidence (${locale})`, () => {
    const api = resultCopyApi(locale);
    for (const scenario of ["A", "B", "J", "compatible", "dia-conditional"]) {
      const check = responses[scenario];
      const fieldEvidence = check.field_results.map(item => ({field:item.field, axle:item.axle, code:item.code, status:item.status, vehicleValue:item.vehicle_value, rimValue:item.rim_value}));
      const blockingIssues = api.copy(check);
      const markup = context.fitmentMarkup({locale, overview:{}, executionStatus:"completed", check, fieldEvidence, blockingIssues,
        conditions:check.conditions.map(item => ({label:api.message(item)})), diameterReferences:[{title:"DIAMETER DUPLICATE"}], preliminaryWarning:true});
      assert.doesNotMatch(markup,/DIAMETER DUPLICATE|vnext-fitment__diameter-reference|В базе недостаточно|ready-summaries/);
      assert.ok(markup.includes(locale === "ru" ? "Одинаково для обеих осей" : "Same for both axles"));
      if (["A","B"].includes(scenario)) {
        assert.ok(markup.includes(locale === "ru" ? "Не можем подтвердить совместимость" : "Compatibility could not be confirmed"));
        assert.ok(markup.includes(locale === "ru" ? "Что не удалось подтвердить" : "What could not be confirmed"));
        assert.doesNotMatch(markup,/Почему не подходит|Why it does not fit/);
        const size = scenario === "A" ? "19″ × 10J" : (locale === "ru" ? "20″ × 8,5J" : "20″ × 8.5J");
        assert.ok(markup.includes(size));
        assert.ok(markup.includes(locale === "ru" ? "Нет для этого размера" : "None for this size"));
      }
      if (scenario === "J") {
        assert.equal(blockingIssues.length,2); // front/rear duplicates collapsed, both facts retained
        assert.ok(markup.includes(locale === "ru" ? "Почему не подходит" : "Why it does not fit"));
        assert.ok(markup.includes(locale === "ru" ? "Не совпадает количество отверстий: у машины 5, у диска 4." : "Bolt count does not match: vehicle 5, wheel 4."));
        assert.ok(markup.includes(locale === "ru" ? "PCD не совпадает: у машины 112 мм, у диска 114,3 мм." : "PCD does not match: vehicle 112 mm, wheel 114.3 mm."));
      }
      if (scenario === "compatible") assert.doesNotMatch(markup,/vnext-fitment__evidence/);
      if (scenario === "dia-conditional") assert.ok(markup.includes(locale === "ru" ? "С условием" : "With conditions"));
      const disclaimer = markup.match(/<footer class="vnext-fitment__commercial-warning">([\s\S]*?)<\/footer>/u)[1];
      assert.equal([...disclaimer.matchAll(/<p>/gu)].length,1);
      assert.doesNotMatch(disclaimer,/<small>/u);
      if (locale === "en") assert.doesNotMatch(markup,/[А-Яа-яЁё]/u);
    }
  });
}

test("summary renders only backend fail codes, preserving single conflicts and other reasons", () => {
  const api=resultCopyApi("en");
  for (const code of ["pcd_mismatch","bolt_count_mismatch"]) {
    const check={verdict:"incompatible",blocking_issues:[{code:"center_bore_too_small"}],field_results:[
      {code,status:"fail",vehicle_value:"5",rim_value:"4"},
      {code:code==="pcd_mismatch"?"bolt_count_mismatch":"pcd_mismatch",status:"pass",vehicle_value:"5",rim_value:"4"},
    ]};
    const issues=api.copy(check);
    assert.equal(issues.length,2);
    assert.equal(issues.filter(item=>item.code===code).length,1);
    check.verdict="unknown";
    assert.equal(api.copy(check).length,1); // no inferred mismatch from different values
  }
});

test("empty completed metadata is hidden while useful supplied metadata remains", () => {
  const check={execution_status:"completed",verdict:"compatible"};
  const empty=context.fitmentMarkup({overview:{},check,canonicalVehicleSummary:"—",canonicalWheelSummary:" "});
  assert.doesNotMatch(empty,/ready-summaries|<strong>—<\/strong>/u);
  assert.match(empty,/data-fitment-action="create-image"/u);
  const partial=context.fitmentMarkup({overview:{},check,canonicalVehicleSummary:"BMW X5, 2021"});
  assert.match(partial,/<strong>BMW X5, 2021<\/strong>/u);
  assert.doesNotMatch(partial,/<strong>—<\/strong>/u);
});

test("ET no-reference copy stays neutral when submitted size is unavailable", () => {
  const markup=context.fitmentMarkup({overview:{},check:{execution_status:"completed",verdict:"unknown"},fieldEvidence:[{field:"offset_et_mm",status:"unknown",code:"vehicle_reference_offset_missing",vehicleValue:null,rimValue:"45"}]});
  assert.doesNotMatch(markup,/Нет для этого размера/u);
  assert.match(markup,/Нет данных/u);
});

function runInCopyContext(script, context = {}, ...options) {
  return vm.runInNewContext(script, Object.assign(context, { copy, uiCopy: copy, uiText: copy, legacyTranslations, applicationLocale, localeOf, escapeCopy, unknownVerdictSubtitle }), ...options);
}


const unknownBase = (locale, codes) => ({ locale, overview: {}, executionStatus: 'completed', check: { execution_status: 'completed', verdict: 'unknown', is_current: true, blocking_issues: codes.map(code => ({code})) } });
const unknownCases = [['size_not_in_reference','size'],['vehicle_reference_offset_missing','et'],['rim_offset_missing','et'],['center_bore_unknown','dia'],['pcd_unknown','pcd'],['vehicle_variant_required','vehicle'],['vehicle_not_resolved','vehicle'],['size_unknown','wheel'],['rim','wheel']];
for (const locale of ['ru','en']) {
  for (const [code, key] of unknownCases) test(`LOW-1 ${locale}: ${code} uses the server reason`, () => {
    const model = unknownBase(locale, [code]);
    const expected = copy(`fitment.verdict.unknown.${key}`, locale);
    assert.equal(unknownVerdictSubtitle(model), expected);
    assert.ok(fitmentMarkup(model).includes(`<p>${expected}</p>`));
  });
  for (const codes of [[], ['future_reason'], ['pcd_unknown','center_bore_unknown'], ['size_not_in_reference','vehicle_reference_offset_missing']]) test(`LOW-1 ${locale}: neutral fallback ${codes}`, () => {
    assert.equal(unknownVerdictSubtitle(unknownBase(locale,codes)),copy('fitment.verdict.unknown.fallback',locale));
  });
  test(`LOW-1 ${locale}: missing fields are authoritative, redundant projection is not another reason`, () => {
    const model=unknownBase(locale,['pcd_unknown']);
    model.check.missing_fields=['pcd'];model.check.evidence_summary={missing_fields:['pcd']};
    assert.equal(unknownVerdictSubtitle(model),copy('fitment.verdict.unknown.pcd',locale));
    model.check.blocking_issues=[];
    assert.equal(unknownVerdictSubtitle(model),copy('fitment.verdict.unknown.pcd',locale));
    model.check.missing_fields.push('future_missing');
    assert.equal(unknownVerdictSubtitle(model),copy('fitment.verdict.unknown.fallback',locale));
  });
  test(`LOW-1 ${locale}: subtitle does not repeat the reason group verbatim`, () => {
    const model=unknownBase(locale,['center_bore_unknown']);model.blockingIssues=[{label:copy('fitment.verdict.unknown.dia',locale)}];
    assert.equal(unknownVerdictSubtitle(model),copy('fitment.verdict.unknown.fallback',locale));
  });
  for (const state of ['failed','stale']) test(`LOW-1 ${locale}: ${state} has no unknown subtitle`, () => {
    const model=unknownBase(locale,['size_not_in_reference']);
    if(state==='failed') {model.executionStatus='failed';model.check.execution_status='failed';} else model.check.is_current=false;
    assert.equal(unknownVerdictSubtitle(model),'');
    assert.ok(!fitmentMarkup(model).includes(copy('fitment.verdict.unknown.size',locale)));
  });
}

test('LOW-1 mutation: restoring the old universal size subtitle fails the renderer contract', () => {
  const source=fs.readFileSync(new URL('../webapp/vnext/views/fitment.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('export function ','function ');
  const old = 'Доступных данных недостаточно, чтобы подтвердить совместимость этого размера целиком.';
  const context={copy,uiText:copy,applicationLocale,localeOf,unknownVerdictSubtitle,fitmentDisplayValue};
  vm.runInNewContext(source.replace('esc(unknownVerdictSubtitle(model))',JSON.stringify(old))+'\nglobalThis.render = fitmentMarkup;',context);
  const verify=render=>assert.ok(render(unknownBase('ru',['center_bore_unknown'])).includes(copy('fitment.verdict.unknown.dia','ru')));
  verify(fitmentMarkup);
  assert.throws(()=>verify(context.render),assert.AssertionError);
});

test('fitment shipping modules contain no universal size subtitle or целиком',()=>{
  for(const name of ['views/fitment.js','copy.mjs']) {
    const source=fs.readFileSync(new URL(`../webapp/vnext/${name}`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/совместимость этого размера целиком|The available data is not enough to confirm this wheel size as a whole/u);
  }
});

test('P1 glossary: RU keys contain no internal terms and EN keys are present',()=>{
  for (const [key, translations] of Object.entries(COPY)) {
    assert.doesNotMatch(translations.ru,/SKU|идентификац|Источник данных|\bprovider\b|\breference\b|еще|колесн/iu,key);
    assert.ok(translations.en,key);
    assert.doesNotMatch(translations.en,/[А-Яа-яЁё]/u,key);
  }
  const app=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
  const context={legacyTranslations};vm.runInNewContext(app.slice(app.indexOf('const I18N ='),app.indexOf('function detectLocale()')),context);
  vm.runInNewContext('globalThis.ruStrings=I18N.ru;',context);
  const values = value => typeof value === "string" ? [value] : Object.values(value).flatMap(values);
  for (const text of values(context.ruStrings)) assert.doesNotMatch(text,/SKU|идентификац|Источник данных|еще|колесн/iu);
});

test('E-03 keyed headings and notices use separate punctuation contracts',()=>{
  for(const locale of ['ru','en']) {
    for(const key of ['nav.create','nav.createMobile','nav.history','render.again','fitment.proposed','fitment.identity.edit','fitment.identity.hide']) assert.doesNotMatch(copy(key,locale),/[.!?…]$/u,key);
    for(const key of ['fitment.variant.notice','support.fitment','fitment.notice.visualTryOn',...['size','et','dia','pcd','vehicle','wheel','fallback'].map(k=>'fitment.verdict.unknown.'+k)]) assert.match(copy(key,locale),/\.$/u,key);
    const app=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
    const start=app.indexOf('function t('),end=app.indexOf('\n}',start)+2;
    const context={I18N:{[locale]:{heading:'Heading.',notice:'Sentence.',creating:'Creating…'}},locale};
    vm.runInNewContext(app.slice(start,end)+'\nglobalThis.translate=t;',context);
    assert.equal(context.translate('heading'),'Heading');
    assert.equal(context.translate('notice',{sentence:true}),'Sentence.');
    assert.equal(context.translate('creating',{sentence:true}),'Creating…');
  }
});

test('E-03 DOM observer preserves sentences and only trims heading/button/status punctuation',()=>{
  const app=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
  const start=app.indexOf('function enforceUiCopyRule('),end=app.indexOf('\n}',start)+2;
  const nodes=[['P','Explanation.',false,false],['SPAN','Notice.',false,false],['H2','Heading.',true,false],['BUTTON','Action.',true,false],['SPAN','Creating…',true,true]].map(([tagName,nodeValue,isLabel,isSentence])=>({nodeValue,parentElement:{tagName,hasAttribute:()=>false,closest:selector=>selector==='[data-i18n-sentence],.vnext-shell'?(isSentence?{}:null):(isLabel?{}:null)}}));
  let index=0; const context={NodeFilter:{SHOW_TEXT:4},document:{createTreeWalker:()=>({nextNode:()=>nodes[index++]})}};
  vm.runInNewContext(app.slice(start,end)+'\nenforceUiCopyRule({});',context);
  assert.deepEqual(nodes.map(n=>n.nodeValue),['Explanation.','Notice.','Heading','Action','Creating…']);
});

test('P1 RU/EN verdict snapshots: compatible, conditions, unknown, incompatible, failed, stale',()=>{
  const snapshots=JSON.parse(fs.readFileSync(new URL('./evidence/p1-copy/verdict-snapshots.json',import.meta.url),'utf8'));
  for(const {locale,state,markup} of snapshots) {
    const model={locale,overview:{},executionStatus:state==='failed'?'failed':'completed',check:{execution_status:state==='failed'?'failed':'completed',verdict:state==='stale'?'unknown':state,is_current:state!=='stale',blocking_issues:[{code:'center_bore_unknown'}]}};
    assert.equal(fitmentMarkup(model).match(/<section class="vnext-fitment__verdict[\s\S]*?<\/section>/u)[0],markup,`${locale}/${state}`);
  }
});

test('copy keeps the screen renderable when a key is missing', () => {
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  try {
    for (const key of ['fitment.typo', 'toString', '__proto__']) {
      assert.equal(copy(key, 'ru'), key);
      assert.equal(copy(key, 'en'), key);
    }
    assert.equal(warnings.length, 6);
    assert.ok(warnings.every(message => message.startsWith('Unknown copy key: ')));
  } finally {
    console.warn = original;
  }
});

test('PCD unknown copy uses grammatical Russian', () => {
  assert.equal(copy('fitment.verdict.unknown.pcd', 'ru'), 'Не хватает данных о разболтовке.');
});
