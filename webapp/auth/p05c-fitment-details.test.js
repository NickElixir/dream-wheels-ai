import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { fitmentMarkup } from '../vnext/views/fitment.js';
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const extract = name => { const start = source.indexOf(`function ${name}(`); return source.slice(start, source.indexOf('\nfunction ', start + 1)); };
function presentation(locale) {
  const context = { locale };
  const dictionary = source.slice(source.indexOf('const I18N ='), source.indexOf('function detectLocale'));
  vm.runInNewContext(`${dictionary}\nconst normalizeFitmentText=value=>String(value??'').trim();const fitmentMarketLabel=()=> 'Europe';\n${extract('fitmentVariantDisplayName')}\n${extract('fitmentPresentationText')}\n${extract('fitmentVariantTechnicalSeries')}\n${extract('formatIdentityNumber')}\nconst t=key=>key.split('.').reduce((o,k)=>o[k],I18N[locale]);\n${extract('fitmentDiameterPresentation')}\nglobalThis.api={variant:fitmentVariantTechnicalSeries,diameter:fitmentDiameterPresentation};`, context);
  return context.api;
}
test('C0 variant distinctions use explicit units/attributes and legacy fallback', () => {
  const p = presentation('en');
  assert.equal(p.variant({modification:'3.0 Turbo',trim_body_types:['Coupe'],power_kw:250,production_year_from:2019,production_year_to:2023}), 'Coupe / 250 kW / 2019–2023');
  assert.equal(p.variant({modification:'1.5 TSI',power_kw:110,power_ps:150,power_hp:148,engine_code:'DADA'}), '110 kW / DADA');
  assert.equal(p.variant({modification:'Long Range',power_kw:340,trim_attributes:['AWD']}), '340 kW / AWD');
  assert.equal(p.variant({modification:'Legacy',generation:'E3'}), 'Europe / E3');
  assert.equal(p.variant({power_ps:150}), '150 PS');
  assert.equal(p.variant({power_hp:148}), '148 hp');
  assert.equal(p.variant({trim_body_types:['Coupe']}), 'Coupe');
  assert.doesNotMatch(p.variant({modification:'xDrive',power_kw:100}), /AWD/);
});
test('backend diameter relation drives RU/EN copy independently of width', () => {
  for (const locale of ['ru','en']) {
    const p = presentation(locale);
    for (const [relation,exact,diameter] of [['below',false,16],['above',false,23],['within_bounds',false,19],['within_bounds',true,20],['unknown',null,null]]) {
      const detail={axle:'front',rim_diameter_in:diameter,reference_diameters_in:relation==='unknown'?[]:[18,20],reference_relation:relation,exact_diameter_match:exact};
      assert.equal(JSON.stringify(p.diameter({...detail,rim_width_j:8.5})),JSON.stringify(p.diameter({...detail,rim_width_j:10})));
      const formatted=p.diameter(detail);
      const markup=fitmentMarkup({locale,overview:{},executionStatus:'completed',check:{execution_status:'completed',verdict:'unknown'},diameterReferences:[formatted]});
      assert.ok(!markup.includes(formatted.title));
      assert.doesNotMatch(markup,/vnext-fitment__diameter-reference/);
      assert.doesNotMatch(markup,/incompatible|точно не подойдёт|диск не подходит/);
      if (locale==='en') assert.doesNotMatch(formatted.title,/Размер|Диаметр|справоч/);
      if (relation==='within_bounds'&&exact===false) assert.match(formatted.copy,locale==='en'?/not among/:/отсутствует/);
    }
  }
});
test('variant picker retains long secondary distinction and selectable action', () => {
 const markup=fitmentMarkup({overview:{},nextAction:'select_vehicle_variant',vehicleVariants:[{label:'3.0 Turbo',technical:'Coupe / 250 kW / 2019–2023'},{label:'3.0 Turbo',technical:'250 kW / 2017–2023'}],selectedVehicleVariant:0});
 assert.ok(markup.includes("Coupe / 250 kW / 2019–2023"));
 assert.ok(markup.includes("250 kW / 2017–2023"));
 assert.match(markup,/data-fitment-action="confirm-vehicle-variant"/);
});
