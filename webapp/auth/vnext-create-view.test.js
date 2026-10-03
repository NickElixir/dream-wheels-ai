import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

class ElementStub {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.value = "";
    this.className = "";
    this.textContent = "";
  }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); return item; }
  replaceChildren(...items) { this.children = items; }
  replaceWith(item) { this.replacement = item; }
  contains(item) { return this === item || this.children.some((child) => child.contains?.(item)); }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      if (node.tagName === "input" && (selector === "input" || node.name)) result.push(node);
      node.children.forEach(visit);
    };
    visit(this);
    return result;
  }
  dispatchEvent(event) { this.listeners[event.type]?.(event); }
  focus() { document.activeElement = this; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  get nodeType() { return this.tagName === "#text" ? 3 : 1; }
  get childNodes() { return this.children; }
  get childElementCount() { return this.children.length; }
  get allText() { return this.textContent + this.children.map((child) => child.allText || child.textContent || "").join(""); }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) {
      const found = child.find?.(predicate);
      if (found) return found;
    }
    return null;
  }
}

globalThis.document = {
  createElement: (tag) => new ElementStub(tag),
  createTextNode: (text) => Object.assign(new ElementStub("#text"), { textContent: text }),
  querySelector: () => null,
};
const { createCreateView, refreshCreateView } = await import("../vnext/views/create.js");

const photo={previewUrl:'/photo.jpg'};
const ready={files:{car:photo,wheel:photo},bothReady:true,consentAccepted:true};
for(const [snapshot,reason,disabled] of [
  [{},'Добавьте фото автомобиля',true],
  [{files:{car:photo}},'Добавьте фото диска',true],
  [{...ready,consentAccepted:false},'Подтвердите согласие на обработку фотографий',true],
  [ready,'',false],
  [{...ready,submitting:true},'',true],
])test(`Create has one always present primary CTA: ${reason||'ready/submitting'}`,()=>{
  const view=createCreateView(snapshot);
  const cta=view.find(n=>n.textContent==='Создать изображение');
  assert(cta);assert.equal(cta.disabled,disabled);
  if(reason)assert.match(view.allText,new RegExp(reason));
  assert.doesNotMatch(view.allText,/Определить автомобиль|Подтвердить автомобиль|Проверить совместимость|Марка|Модель/);
});

test('legacy recognition/provider states and verdicts cannot gate visual render',()=>{
  for(const verdict of ['incompatible','unknown','failed','stale']){
    const view=createCreateView({...ready,identityResolving:true,identityError:'legacy',proposal:{vehicle:{primary:{make:'AI Ghost'}},rim:{variant_state:'selection_required'}},fitmentVerdict:verdict});
    assert.equal(view.find(n=>n.textContent==='Создать изображение').disabled,false);
    assert.doesNotMatch(view.allText,/AI Ghost|Определяем|Требуется выбрать/);
  }
});

test('product URL save delegates storage and explains deferred Fitment ownership',()=>{
  let saved;const view=createCreateView({...ready,sourceEditing:true},{saveRimProductUrl:value=>saved=value});
  assert.match(view.allText,/Сохраним её для последующей проверки совместимости/);
  assert.doesNotMatch(view.allText,/Определить параметры|Получаем данные/);
  const input=view.find(n=>n.name==='rim_product_url');input.value='https://shop.example/wheel';
  view.find(n=>n.textContent==='Сохранить ссылку').listeners.click();
  assert.equal(saved,'https://shop.example/wheel');
});

test('picker and consent callbacks remain functional',()=>{
  let consent;const picked=[];const view=createCreateView({...ready,consentAccepted:false},{pickFile:kind=>picked.push(kind),setConsent:value=>consent=value});
  view.find(n=>n.className.includes('vnext-create__stage')).listeners.click();assert.deepEqual(picked,['car']);
  const checkbox=view.find(n=>n.type==='checkbox');checkbox.checked=true;checkbox.listeners.change();assert.equal(consent,true);
});

test('Create preserves RU/EN language selection',()=>{
  const view=createCreateView({...ready,locale:'en',sourceEditing:true});
  assert.match(view.allText,/Create image/);assert.match(view.allText,/later compatibility check/);
  assert.doesNotMatch(view.allText,/Ссылка на товар|Создать изображение/);
});
