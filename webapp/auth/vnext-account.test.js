import assert from "node:assert/strict";
import test from "node:test";
import { accountPresentation } from "../vnext/shell/account.mjs";
test("account initials use Telegram or email, balance distinguishes zero from unknown", () => {
 assert.equal(accountPresentation({accountIdentifier:"@nick_wheels",balance:29}).initials,"NW");
 assert.equal(accountPresentation({accountIdentifier:"nikolai.k@example.com",balance:1}).initials,"NK");
 for(const [balance,label] of [[0,"0 рендеров"],[1,"1 рендер"],[2,"2 рендера"],[11,"11 рендеров"],[21,"21 рендер"]]) assert.equal(accountPresentation({balance}).subtitle,label);
 assert.equal(accountPresentation({balance:null}).subtitle,"Загружаем баланс");
 assert.equal(accountPresentation({balance:null,error:"failed"}).subtitle,"Баланс недоступен");
});
