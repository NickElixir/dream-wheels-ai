import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { extractFunction } from "../../tests/helpers/source-extract.mjs";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function setup() {
    const handlers = new Map();
    const state = { authDialogOpen: true, authDialogStep: "email", authDialogBusy: false };
    let document;
    const node = (id, extra = {}) => ({
        id, isConnected: true, disabled: false, tabIndex: 0, inert: false,
        closest() { return this.hidden ? this : null; },
        getClientRects() { return this.hidden ? [] : [{}]; },
        contains(other) { return this === other; },
        focus() { document.activeElement = this; handlers.get("focusin")?.({ target: this }); },
        ...extra,
    });
    const opener = node("opener"), close = node("close"), email = node("email"), last = node("last"), hidden = node("hidden", { hidden: true });
    const background = node("background"), preserved = node("preserved", { inert: true });
    const controls = [close, email, hidden, last];
    const dialog = node("dialog", {
        contains(other) { return this === other || controls.includes(other); },
        querySelectorAll() { return controls; },
        querySelector() { return email; },
    });
    document = {
        activeElement: opener, body: { children: [background, dialog, preserved] },
        addEventListener(name, handler) { handlers.set(name, handler); },
        removeEventListener(name) { handlers.delete(name); },
        querySelectorAll() { return [opener]; },
    };
    const context = { state, document, closeAuthDialog() { state.authDialogOpen = false; context.syncAuthDialogFocus(dialog); } };
    vm.runInNewContext(extractFunction(source, "syncAuthDialogFocus"), context);
    const sync = () => context.syncAuthDialogFocus(dialog);
    const key = (value, shiftKey = false) => {
        const event = { key: value, shiftKey, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {} };
        handlers.get("keydown")?.(event);
        return event;
    };
    return { state, document, handlers, opener, close, email, last, background, preserved, dialog, controls, node, sync, key };
}

test("auth dialog traps both Tab boundaries and excludes hidden controls", () => {
    const s = setup(); s.sync();
    assert.equal(s.document.activeElement, s.email);
    s.close.focus(); assert.equal(s.key("Tab", true).prevented, true);
    assert.equal(s.document.activeElement, s.last);
    assert.equal(s.key("Tab").prevented, true);
    assert.equal(s.document.activeElement, s.close);
});

test("Escape closes an idle auth dialog, restores opener and existing inert states", () => {
    const s = setup(); s.sync();
    assert.equal(s.background.inert, true);
    assert.equal(s.key("Escape").prevented, true);
    assert.equal(s.state.authDialogOpen, false);
    assert.equal(s.document.activeElement, s.opener);
    assert.equal(s.background.inert, false);
    assert.equal(s.preserved.inert, true);
    assert.equal(s.handlers.size, 0);
});

test("Escape cannot interrupt OTP or Telegram authentication in progress", () => {
    for (const field of ["authDialogBusy", "websiteLoginPending"]) {
        const s = setup(); s.sync(); s.state[field] = true; s.key("Escape");
        assert.equal(s.state.authDialogOpen, true);
        assert.equal(s.background.inert, true);
    }
});

test("redraw isolates new background siblings without replacing the return target", () => {
    const s = setup(); s.sync();
    const late = s.node("late"); s.document.body.children.push(late); s.sync();
    assert.equal(late.inert, true);
    s.state.authDialogOpen = false; s.sync();
    assert.equal(late.inert, false);
    assert.equal(s.document.activeElement, s.opener);
});

test("focusin redirects external focus and repeated open/close cleans up listeners", () => {
    const s = setup();
    for (let i = 0; i < 3; i++) {
        s.state.authDialogOpen = true; s.sync();
        s.opener.focus(); assert.equal(s.document.activeElement, s.email);
        s.key("Escape"); assert.equal(s.handlers.size, 0);
        assert.equal(s.document.activeElement, s.opener);
    }
});
