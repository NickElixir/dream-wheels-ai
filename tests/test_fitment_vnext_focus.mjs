import { copy, applicationLocale, localeOf, escapeCopy, unknownVerdictSubtitle } from "../webapp/vnext/copy.mjs";
import { fitmentDisplayValue } from "../webapp/vnext/fitment-display.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(ROOT, "webapp/vnext/views/fitment.js"), "utf8")
  .replaceAll("export function ", "function ")
  .replace(/import \{[^\n]+\} from "\.\.\/copy\.mjs";/u, "")
  .replace(/import \{ fitmentDisplayValue \} from "\.\.\/fitment-display\.mjs";/u, `const fitmentDisplayValue = ${fitmentDisplayValue.toString()};`);

test("refreshing a numeric Wheel field never reads unsupported selection properties", () => {
  const numberInput = {
    dataset: { fitmentField: "rim.offset_et_mm" },
    type: "number",
    get selectionStart() { throw new DOMException("unsupported", "InvalidStateError"); },
    get selectionEnd() { throw new DOMException("unsupported", "InvalidStateError"); },
    focus() {},
    setSelectionRange() { throw new DOMException("unsupported", "InvalidStateError"); },
  };
  const root = {
    className: "vnext-fitment", fitmentCallbacks: {},
    querySelector(selector) {
      return selector.startsWith(":focus") || selector.includes("rim.offset_et_mm") ? numberInput : null;
    },
    replaceChildren() {},
  };
  const context = {
    DOMException,
    CSS: { escape: (value) => value },
    document: { createElement: () => ({ className: "", innerHTML: "", childNodes: [], querySelectorAll: () => [] }) },
  };
  runInCopyContext(`${source}\nglobalThis.refreshFitmentView = refreshFitmentView;`, context);
  assert.doesNotThrow(() => context.refreshFitmentView(root, { loading: true }));
});

test("accepting a proposal keeps focus on the same compound control", () => {
  let focused=false;
  const active={dataset:{fitmentFocus:"rim.center_bore_mm"},tagName:"BUTTON"};
  const replacement={tagName:"BUTTON",focus(options){focused=options.preventScroll;}};
  const root={className:"vnext-fitment",querySelector(selector){return selector.startsWith(":focus")?active:selector.includes('data-fitment-focus="rim.center_bore_mm"')?replacement:null;},replaceChildren(){}};
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh = refreshFitmentView;`,context);
  context.refresh(root,{rimEditing:true,rim:{center_bore_mm:66.6}});
  assert.equal(focused,true);
});

test("resolving a focused conflict chip restores its compound control without scrolling", () => {
  for (const path of ["rim.offset_et_mm","rim.center_bore_mm","rim.wheel_width_j","rim.pcd"]) {
    let focused=null;
    const chip={dataset:{fitmentFocus:path},tagName:"BUTTON"};
    const compound={tagName:"BUTTON",focus(options){focused={path,preventScroll:options.preventScroll};}};
    const root={className:"vnext-fitment",querySelector(selector){return selector.startsWith(":focus")?chip:selector===`[data-fitment-focus="${path}"]`?compound:null;},replaceChildren(){}};
    const context={CSS:{escape:value=>value},document:{body:{},createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
    runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
    context.refresh(root,{rimEditing:true,resolver:{conflicts:[]}});
    assert.deepEqual(focused,{path,preventScroll:true});
  }
});

test("resolving one PCD conflict focuses the same compound opener while its other conflict remains", () => {
  let focused=false;
  const chip={dataset:{fitmentFocus:"rim.pcd",fitmentAction:"conflict-keep"},tagName:"BUTTON"};
  const disabled={tagName:"BUTTON",disabled:true,focus(){throw Error("cannot focus unresolved compound");}};
  const opener={focus(options){focused=options.preventScroll;}};
  const root={className:"vnext-fitment",querySelector(selector){return selector.startsWith(":focus")?chip:selector.includes("data-wheel-picker-open")?opener:selector.includes("data-fitment-focus")?disabled:null;},replaceChildren(){}};
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{rimEditing:true});
  assert.equal(focused,true);
});

test("background workspace transitions without an initiating control do not capture focus", () => {
  const seen=[];
  const target={getBoundingClientRect:()=>({height:100}),focus(){seen.push("heading");}};
  const summary={focus(){seen.push("summary");}};
  const root={className:"vnext-fitment",fitmentWorkspaceKind:"rim-editor",querySelector(selector){return selector.startsWith(":focus")?null:selector.includes("reselect-vehicle")?summary:target;},replaceChildren(){}};
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  for(const model of [{vehicleRecognition:{status:"loading"}},{vehicleEditing:true,vehicleRecognition:{status:"applied"}},{nextAction:"select_vehicle_variant"},{nextAction:"run_standard_check"}])context.refresh(root,model);
  assert.deepEqual(seen,[]);
});

test("loading → proposal redraw restores the same recognition heading instead of BODY", () => {
  let focused=false;
  const heading={id:"fitment-recognition-title",dataset:{},tagName:"H2"};
  const replacement={focus(){focused=true;}};
  const root={className:"vnext-fitment",fitmentWorkspaceKind:"vehicle-recognition",querySelector(selector){return selector.startsWith(":focus")?heading:selector==="#fitment-recognition-title"?replacement:null;},replaceChildren(){}};
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{vehicleRecognition:{status:"proposed"}});
  assert.equal(focused,true);
});

function runInCopyContext(script, context = {}, ...options) {
  return vm.runInNewContext(script, Object.assign(context, { copy, uiCopy: copy, uiText: copy, baseUiText: copy, applicationLocale, localeOf, escapeCopy, unknownVerdictSubtitle }), ...options);
}


for (const [name,patch,targetSelector] of [
  ["ready wheel save",{rimEditing:false,nextAction:"run_standard_check"},"#fitment-standard-title"],
  ["wheel save requiring vehicle version",{rimEditing:false,nextAction:"select_vehicle_variant"},"#fitment-variant-title"],
  ["failed wheel save",{rimEditing:true,rimError:"Save failed"},'[role="alert"]'],
]) test(`${name} focuses the next meaningful target`,()=>{
  let selected="";
  const origin={dataset:{fitmentAction:"save-rim",value:""},tagName:"BUTTON"};
  const targetFor=selector=>({tagName:"H2",setAttribute(){},focus(){selected=selector;}});
  const root={className:"vnext-fitment",fitmentFocusIntent:{action:"save-rim",origin},fitmentWorkspaceKind:"rim-editor",querySelector(selector){if(selector.startsWith(":focus"))return origin;if(selector===".vnext-fitment__configuration")return null;return targetFor(selector);},replaceChildren(){}};
  const context={CSS:{escape:v=>v},document:{body:{},activeElement:origin,createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,patch);
  if (targetSelector === '[role="alert"]') assert.match(selected, /role="alert"/);
  else assert.equal(selected,targetSelector);
});


test("focused check button without activation never creates a completion intent",()=>{
  let selected="";
  const origin={dataset:{fitmentAction:"check",value:""},tagName:"BUTTON"};
  const root={className:"vnext-fitment",fitmentWorkspaceKind:"none",querySelector(selector){if(selector.startsWith(":focus"))return origin;if(selector===".vnext-fitment__configuration")return null;return {tagName:"BUTTON",focus(){selected=selector;}};},replaceChildren(){}};
  const context={CSS:{escape:v=>v},document:{body:{},activeElement:origin,createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{check:{execution_status:"completed",is_current:true,verdict:"compatible"}});
  assert.equal(root.fitmentFocusIntent,undefined);
  assert.equal(selected,'[data-fitment-action="check"][data-value=""]');
});

for(const key of ["rim-error-0","verdict-heading-0"]) test(`${key} retains its focus on repeated redraw`,()=>{
  let selected="";
  const active={dataset:{fitmentFocusKey:key},tagName:key.includes("error")?"P":"H2"};
  const root={className:"vnext-fitment",fitmentWorkspaceKind:"none",querySelector(selector){if(selector.startsWith(":focus"))return active;if(selector===".vnext-fitment__configuration")return null;return {tagName:active.tagName,setAttribute(){},focus(){selected=selector;}};},replaceChildren(){}};
  const context={CSS:{escape:v=>v},document:{body:{},activeElement:active,createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{});
  assert.equal(selected,`[data-fitment-focus-key="${key}"]`);
});


test("background workspace change preserves a focused action without activation",()=>{
  let selected="";
  const origin={dataset:{fitmentAction:"resolve-rim",value:""},tagName:"BUTTON"};
  const root={className:"vnext-fitment",fitmentWorkspaceKind:"none",querySelector(selector){if(selector.startsWith(":focus"))return origin;if(selector===".vnext-fitment__configuration")return null;return {tagName:"BUTTON",focus(){selected=selector;}};},replaceChildren(){}};
  const context={CSS:{escape:v=>v},document:{body:{},activeElement:origin,createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{vehicleEditing:true,resolver:{url:"https://example.com/wheel"}});
  assert.equal(selected,'[data-fitment-action="resolve-rim"][data-value=""]');
});
