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
    document: { createElement: () => ({ className: "", innerHTML: "", childNodes: [] }) },
  };
  vm.runInNewContext(`${source}\nglobalThis.refreshFitmentView = refreshFitmentView;`, context);
  assert.doesNotThrow(() => context.refreshFitmentView(root, { loading: true }));
});

test("accepting a proposal keeps focus on the same compound control", () => {
  let focused=false;
  const active={dataset:{fitmentFocus:"rim.center_bore_mm"},tagName:"BUTTON"};
  const replacement={tagName:"BUTTON",focus(options){focused=options.preventScroll;}};
  const root={className:"vnext-fitment",querySelector(selector){return selector.startsWith(":focus")?active:selector.includes('data-fitment-focus="rim.center_bore_mm"')?replacement:null;},replaceChildren(){}};
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[]})}};
  vm.runInNewContext(`${source}\nglobalThis.refresh = refreshFitmentView;`,context);
  context.refresh(root,{rimEditing:true,rim:{center_bore_mm:66.6}});
  assert.equal(focused,true);
});

test("resolving a focused conflict chip restores its compound control without scrolling", () => {
  for (const path of ["rim.offset_et_mm","rim.center_bore_mm","rim.wheel_width_j","rim.pcd"]) {
    let focused=null;
    const chip={dataset:{fitmentFocus:path},tagName:"BUTTON"};
    const compound={tagName:"BUTTON",focus(options){focused={path,preventScroll:options.preventScroll};}};
    const root={className:"vnext-fitment",querySelector(selector){return selector.startsWith(":focus")?chip:selector===`[data-fitment-focus="${path}"]`?compound:null;},replaceChildren(){}};
    const context={CSS:{escape:value=>value},document:{body:{},createElement:()=>({childNodes:[]})}};
    vm.runInNewContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
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
  const context={CSS:{escape:value=>value},document:{createElement:()=>({childNodes:[]})}};
  vm.runInNewContext(`${source}\nglobalThis.refresh=refreshFitmentView;`,context);
  context.refresh(root,{rimEditing:true});
  assert.equal(focused,true);
});
