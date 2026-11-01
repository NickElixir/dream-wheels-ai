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

for (const reducedMotion of [false, true]) {
  for (const previousWorkspace of ["none", "vehicle-recognition"]) {
    test(`explicit recognition focuses and scrolls on entry/reentry (${previousWorkspace}, reduced=${reducedMotion})`, () => {
      const scrolls = [];
      let focused = 0;
      const heading = {tagName:"H2", setAttribute(){}, focus(options){assert.equal(options.preventScroll,true);focused++;}, getBoundingClientRect(){return {top:1000,bottom:1040};}, scrollIntoView(options){scrolls.push(options);}};
      const root = {className:"vnext-fitment", fitmentWorkspaceKind:previousWorkspace, fitmentWorkspaceAction:"recognize-vehicle", querySelector(selector){return selector === "#fitment-recognition-title" ? heading : null;}, replaceChildren(){}};
      const context = {innerHeight:600, matchMedia:()=>({matches:reducedMotion}), document:{createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
      runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
      context.refresh(root,{vehicleRecognition:{status:"loading"}});
      assert.equal(focused,1);
      assert.equal(scrolls.length,1);
      assert.equal(scrolls[0].behavior,reducedMotion ? "auto" : "smooth");
      assert.equal(scrolls[0].block,"center");
      root.fitmentWorkspaceAction = null;
      context.refresh(root,{vehicleRecognition:{status:"loading",slow:true}});
      assert.equal(scrolls.length,1,"background redraw must not scroll again");
    });
  }
}

function runInCopyContext(script, context = {}, ...options) {
  return vm.runInNewContext(script, Object.assign(context, { copy, uiCopy: copy, uiText: copy, baseUiText: copy, applicationLocale, localeOf, escapeCopy, unknownVerdictSubtitle }), ...options);
}


for (const [name,patch,targetSelector] of [
  ["ready wheel save",{rimEditing:false,nextAction:"run_standard_check"},"#fitment-standard-title"],
  ["wheel save requiring vehicle version",{rimEditing:false,nextAction:"select_vehicle_variant"},"#fitment-variant-title"],
  ["vehicle save requiring vehicle version",{vehicleEditing:false,nextAction:"select_vehicle_variant", completedVehicleSave:true},"#fitment-variant-title"],
  ["vehicle save retaining a required editor",{vehicleEditing:true,nextAction:"complete_vehicle_details",completedVehicleSave:true},"#fitment-vehicle-editor-title"],
  ["failed wheel save",{rimEditing:true,rimError:"Save failed"},'[role="alert"]'],
]) test(`${name} focuses the next meaningful target`,()=>{
  let selected="";
  const origin={dataset:{fitmentAction:"save-rim",value:""},tagName:"BUTTON"};
  const targetFor=selector=>({tagName:"H2",setAttribute(){},focus(){selected=selector;}});
  const root={className:"vnext-fitment",fitmentFocusIntent:{action:patch.completedVehicleSave?"save-vehicle":"save-rim",origin,busySeen:true},fitmentWorkspaceKind:"rim-editor",querySelector(selector){if(selector.startsWith(":focus"))return origin;if(selector===".vnext-fitment__configuration" || selector.includes("aria-invalid") || selector.includes('[role="alert"]') && !patch.rimError)return null;return targetFor(selector);},replaceChildren(){}};
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

for(const key of ["error:rim-save","check-verdict"]) test(`${key} retains its focus on repeated redraw`,()=>{
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

test("refreshing a URL field never reads unsupported selection properties", () => {
  const numberInput = {
    dataset: { fitmentField: "rim.product_url" },
    type: "url",
    get selectionStart() { throw new DOMException("unsupported", "InvalidStateError"); },
    get selectionEnd() { throw new DOMException("unsupported", "InvalidStateError"); },
    focus() {},
    setSelectionRange() { throw new DOMException("unsupported", "InvalidStateError"); },
  };
  const root = {
    className: "vnext-fitment", fitmentCallbacks: {},
    querySelector(selector) {
      return selector.startsWith(":focus") || selector.includes("rim.product_url") ? numberInput : null;
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


test("variant application waits for the request before moving to Summary",()=>{
  let focused="";
  const origin={dataset:{fitmentAction:"confirm-vehicle-variant",value:""},tagName:"BUTTON"};
  const root={className:"vnext-fitment",fitmentFocusIntent:{action:"confirm-vehicle-variant",origin},querySelector(selector){if(selector.startsWith(":focus"))return origin;if(selector===".vnext-fitment__configuration")return null;return {tagName:"H2",focus(){focused=selector;}};},replaceChildren(){}};
  const context={CSS:{escape:v=>v},document:{body:{},activeElement:origin,createElement:()=>({childNodes:[],querySelectorAll:()=>[]})}};
  runInCopyContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{vehicleVariantApplying:true,nextAction:"select_vehicle_variant",vehicleVariantPickerOpen:false});
  assert.equal(root.fitmentFocusIntent.busySeen,true);
  assert.notEqual(focused,"#fitment-standard-title");
  context.refresh(root,{vehicleVariantApplying:false,nextAction:"run_standard_check",vehicleVariantPickerOpen:false});
  assert.equal(focused,"#fitment-standard-title");
  assert.equal(root.fitmentFocusIntent,null);
});

test("WebView ignoring preventScroll restores position before smooth scrolling",()=>{
 const events=[];
 const context={scrollY:100,innerHeight:600,matchMedia:()=>({matches:false}),scrollTo(options){events.push(["restore",options.top]);context.scrollY=options.top;}};
 const heading={tagName:"H2",setAttribute(){},getBoundingClientRect:()=>({top:1000,bottom:1040}),focus(){context.scrollY=800;events.push(["focus"]);},scrollIntoView(options){events.push(["scroll",options.behavior]);}};
 runInCopyContext(`${source}\nglobalThis.focusTarget=focusWorkflowTarget;`,context);
 context.focusTarget({},heading,true);
 assert.deepEqual(events,[["focus"],["restore",100],["scroll","smooth"]]);
});


test("WebView focus restores nested mobile scroll container before animation",()=>{
 const events=[];
 const scroller={scrollTop:100,scrollLeft:0,parentElement:null,scrollTo(options){events.push(["restore-container",options.top]);this.scrollTop=options.top;this.scrollLeft=options.left;}};
 const context={scrollY:0,innerHeight:600,matchMedia:()=>({matches:false})};
 const heading={parentElement:scroller,tagName:"H2",setAttribute(){},getBoundingClientRect:()=>({top:1000,bottom:1040}),focus(){scroller.scrollTop=800;events.push(["focus"]);},scrollIntoView(options){events.push(["scroll",options.behavior,scroller.scrollTop]);}};
 runInCopyContext(`${source}\nglobalThis.focusTarget=focusWorkflowTarget;`,context);
 context.focusTarget({},heading,true);
 assert.deepEqual(events,[["focus"],["restore-container",100],["scroll","smooth",100]]);
});

for (const reduced of [false, true]) {
 test(`clipped mobile target restores nested position (reduced=${reduced})`,()=>{
  const events=[];
  const scroller={scrollTop:100,scrollLeft:0,clientTop:0,clientHeight:200,parentElement:null,getBoundingClientRect:()=>({top:100,bottom:300}),scrollTo(options){this.scrollTop=options.top;events.push("restore");}};
  const context={scrollY:0,innerHeight:900,getComputedStyle:()=>({overflowY:"auto"}),matchMedia:()=>({matches:reduced})};
  const heading={parentElement:scroller,tagName:"H2",setAttribute(){},getBoundingClientRect:()=>({top:400,bottom:440}),focus(){scroller.scrollTop=300;},scrollIntoView(options){events.push(options.behavior);}};
  runInCopyContext(`${source}\nglobalThis.focusTarget=focusWorkflowTarget;`,context);
  context.focusTarget({},heading,true);
  assert.deepEqual(events,["restore",reduced?"auto":"smooth"]);
  assert.equal(scroller.scrollTop,100);
 });
}

test("background focus restoration preserves container position without navigation",()=>{
 const scroller={scrollTop:300,scrollLeft:5,parentElement:null,scrollTo(options){this.scrollTop=options.top;this.scrollLeft=options.left;}};
 const context={scrollY:100,innerHeight:600,scrollTo(options){context.scrollY=options.top;}};
 const heading={parentElement:scroller,tagName:"H2",setAttribute(){},getBoundingClientRect:()=>({top:1000,bottom:1040}),focus(){scroller.scrollTop=800;scroller.scrollLeft=30;context.scrollY=500;},scrollIntoView(){assert.fail("background redraw must not navigate");}};
 runInCopyContext(`${source}\nglobalThis.focusTarget=focusWorkflowTarget;`,context);
 context.focusTarget({},heading);
 assert.equal(scroller.scrollTop,300);
 assert.equal(scroller.scrollLeft,5);
 assert.equal(context.scrollY,100);
});


test("runtime recognition action publishes only its own loading redraw",()=>{
 const app=fs.readFileSync(path.join(ROOT,"webapp/app.js"),"utf8");
 const bridge=app.slice(app.indexOf("window.dreamwheelsFitmentBridge = {"));
 const method=bridge.match(/    action\(action, value = ""\) \{[\s\S]*?\n    \},\n\};/)[0].replace(/,\n\};$/, "");
 let redraws=0,starts=0;
 const context={fitmentMutationsLocked:()=>false,clearFitmentEntryIntent(){},notifyFitmentBridge(){redraws++;},recognizeFitmentVehicle(){starts++;context.notifyFitmentBridge();}};
 vm.runInNewContext(`globalThis.bridge=({${method}})`,context);
 context.bridge.action("recognize-vehicle");
 assert.equal(starts,1);
 assert.equal(redraws,1,"a redundant redraw removes the smooth-scroll target before the first frame");
});
