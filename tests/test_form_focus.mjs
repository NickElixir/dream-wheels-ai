import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractFunction} from './helpers/source-extract.mjs';
const source=fs.readFileSync(new URL('../webapp/vnext/views/fitment.js',import.meta.url),'utf8');
function runtime(){
 const listeners=new Map();
 const document={activeElement:null,addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
 const context=vm.createContext({document,innerHeight:900,matchMedia:()=>({matches:false})});
 for(const name of ['focusWorkflowTarget','fitmentFormTarget','clearFitmentFormFocus','beginFitmentFormFocus','applyFitmentFormFocus'])vm.runInContext(extractFunction(source,name),context);
 function control(value='',disabled=false,path=''){
  return {value,disabled,tagName:'SELECT',dataset:{wheelPickerOpen:path},closest:()=>null,getAttribute:()=>null,focus(){document.activeElement=this;listeners.get('focusin')?.({type:'focusin',target:this});},getBoundingClientRect:()=>({top:100,bottom:140})};
 }
 const heading={tagName:'H2',setAttribute(){},focus(){document.activeElement=this;listeners.get('focusin')?.({type:'focusin',target:this});},getBoundingClientRect:()=>({top:100,bottom:140})};
 const root={fitmentModel:{jobId:'A'},querySelector:()=>heading,querySelectorAll:()=>[],};
 return {context,document,listeners,control,heading,root};
}
for(const [values,index] of [[['','',''],0],[['BMW','',''],1],[['BMW','5 Series','2024'],0]])test(`vehicle opening targets the required control: ${values.join('/')}`,()=>{
 const {context,control,root}=runtime();const fields=values.map(v=>control(v));root.querySelectorAll=()=>fields;
 assert.equal(context.fitmentFormTarget(root,'vehicle',{}).target,fields[index]);
});
test('wheel opening prioritizes missing required picker over optional identity inputs',()=>{
 const {context,control,root}=runtime();const brand=control('BBS'),diameter=control('',false,'rim.wheel_diameter_in'),et=control('',false,'rim.offset_et_mm');root.querySelectorAll=()=>[brand,diameter,et];
 assert.equal(context.fitmentFormTarget(root,'rim',{rim:{wheel_diameter_in:18,offset_et_mm:''}}).target,et);
 assert.equal(context.fitmentFormTarget(root,'rim',{rim:{wheel_diameter_in:18,offset_et_mm:35}}).target,brand);
});
for(const selected of [0,1])test(`variant opening targets selected option ${selected}`,()=>{
 const {context,control,root}=runtime();const choices=[control(),control()];choices.forEach((node,i)=>node.getAttribute=()=>String(i===selected));root.querySelectorAll=()=>choices;
 assert.equal(context.fitmentFormTarget(root,'variant',{}).target,choices[selected]);
});
test('deferred opening uses the heading until a control appears then releases all listeners',()=>{
 const {context,control,root,document,listeners,heading}=runtime();const make=control('',true);root.querySelectorAll=()=>[make];
 const model={jobId:'A',catalogue:{states:{makes:{status:'loading'}}}};
 context.beginFitmentFormFocus(root,'vehicle');context.applyFitmentFormFocus(root,model);
 assert.equal(document.activeElement,heading);assert.equal(listeners.size,4);
 make.disabled=false;context.applyFitmentFormFocus(root,model);
 assert.equal(document.activeElement,make);assert.equal(listeners.size,0);assert.equal(root.fitmentFormFocusIntent,null);
});
for(const type of ['pointerdown','keydown','input','focusin'])test(`new ${type} cancels deferred focus`,()=>{
 const {context,control,root,document,listeners}=runtime();const external=control('outside');document.activeElement=external;
 context.beginFitmentFormFocus(root,'variant');listeners.get(type)({type,target:external===root.fitmentFormFocusIntent.origin?control('other'):external});
 assert.equal(root.fitmentFormFocusIntent,null);assert.equal(listeners.size,0);
 assert.equal(context.applyFitmentFormFocus(root,{jobId:'A'}),false);assert.equal(document.activeElement,external);
});
test('different try-on cancels pending focus without moving the active control',()=>{
 const {context,root,document,listeners}=runtime();context.beginFitmentFormFocus(root,'vehicle');context.applyFitmentFormFocus(root,{jobId:'B'});
 assert.equal(root.fitmentFormFocusIntent,null);assert.equal(listeners.size,0);assert.equal(document.activeElement,null);
});
test('failed catalogue terminates deferred focus at the fallback heading',()=>{
 const {context,root,listeners,heading,document}=runtime();context.beginFitmentFormFocus(root,'vehicle');context.applyFitmentFormFocus(root,{jobId:'A',catalogue:{states:{makes:{status:'failed'}}}});
 assert.equal(document.activeElement,heading);assert.equal(listeners.size,0);
});
test('unmount cleanup prevents a late response from reusing the old opening',()=>{
 const {context,root,listeners}=runtime();context.beginFitmentFormFocus(root,'vehicle');context.clearFitmentFormFocus(root);
 assert.equal(listeners.size,0);assert.equal(context.applyFitmentFormFocus(root,{jobId:'A'}),false);
});

const appSource=fs.readFileSync(new URL('../webapp/app.js',import.meta.url),'utf8');
for(const event of ['pointerdown','keydown','input','focusin'])test(`auth request cancels its pending focus on ${event}`,()=>{
 const handlers=new Map(),session={};const origin={};const dialog={authFocusSession:session};
 const document={activeElement:origin,querySelector:()=>dialog,addEventListener(name,fn){handlers.set(name,fn);},removeEventListener(name,fn){if(handlers.get(name)===fn)handlers.delete(name);}};
 const state={authDialogOpen:true};const context=vm.createContext({document,state});vm.runInContext(extractFunction(appSource,'trackAuthDialogFocusAction'),context);
 const guard=context.trackAuthDialogFocusAction();assert.equal(handlers.size,4);handlers.get(event)({type:event,target:{}});assert.equal(guard.allowed,false);
 guard.cleanup();assert.equal(handlers.size,0);assert.equal(session.pendingFocusCleanup,undefined);
});
test('a reopened auth dialog rejects the old request session',()=>{
 const dialog={authFocusSession:{}};const handlers=new Map();const document={activeElement:{},querySelector:()=>dialog,addEventListener(n,f){handlers.set(n,f);},removeEventListener(n,f){if(handlers.get(n)===f)handlers.delete(n);}};const context=vm.createContext({document,state:{authDialogOpen:true}});vm.runInContext(extractFunction(appSource,'trackAuthDialogFocusAction'),context);
 const guard=context.trackAuthDialogFocusAction();assert.equal(guard.ownsDialog(),true);dialog.authFocusSession={};assert.equal(guard.ownsDialog(),false);guard.cleanup();assert.equal(handlers.size,0);
});
test('manual vehicle transition has no competing legacy animation-frame focus',()=>{
 assert.doesNotMatch(appSource,/requestAnimationFrame\(\(\) => document.querySelector\('\[data-fitment-field="vehicle.make"\]'/);
});

for(const kind of ['email','otp','message'])test(`auth ${kind} error focuses its existing accessible element`,()=>{
 let focused='';const elements=Object.fromEntries(['email','otp','message'].map(name=>[name,{dataset:{tone:name==='message'?'error':''},closest:()=>null,setAttribute(){},focus(){focused=name;},getBoundingClientRect:()=>({top:100,bottom:130})}]));
 const document={querySelector(selector){return elements[selector.includes('message')?'message':selector.includes('otp')?'otp':'email'];}};
 const state={authDialogEmailError:kind==='email'?'invalid':'',authDialogOtpError:kind==='otp'?'invalid':''};
 const context=vm.createContext({document,state,window:{innerHeight:900}});vm.runInContext(extractFunction(appSource,'focusAuthDialogError'),context);context.focusAuthDialogError();assert.equal(focused,kind);
});

const bootstrapSource=fs.readFileSync(new URL('../webapp/vnext/bootstrap.js',import.meta.url),'utf8');
test('locale remount restores a form control by semantic identity despite translated labels',()=>{
 let focused=false;const target={tagName:'BUTTON',disabled:false,className:'same',textContent:'Choose another',getAttribute:()=> 'Choose another',focus(){focused=true;}};
 const host={querySelector:selector=>selector.includes('data-wheel-picker-open')?target:null,querySelectorAll:()=>[target]};const context=vm.createContext({CSS:{escape:x=>x}});vm.runInContext(extractFunction(bootstrapSource,'restoreSurfaceFocus'),context);
 context.restoreSurfaceFocus(host,{tagName:'BUTTON',className:'same',label:'Выбрать другое',selector:'[data-wheel-picker-open="rim.offset_et_mm"]'});assert.equal(focused,true);
});
test('locale remount falls back to the owning heading while its field is disabled',()=>{
 let focused=false;const heading={tagName:'H2',setAttribute(){},focus(){focused=true;}};const host={querySelector:selector=>selector.startsWith('#')?heading:{disabled:true},querySelectorAll:()=>[]};const context=vm.createContext({CSS:{escape:x=>x}});vm.runInContext(extractFunction(bootstrapSource,'restoreSurfaceFocus'),context);
 context.restoreSurfaceFocus(host,{selector:'[data-fitment-field="vehicle.make"]',owner:'fitment-vehicle-editor-title'});assert.equal(focused,true);
});
