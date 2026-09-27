import assert from "node:assert/strict";
import test from "node:test";
import { createAppShell, updateAppShellAuth } from "../vnext/shell/app-shell.js";

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.listeners = {};
  }

  append(...elements) { this.children.push(...elements); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  click() { this.listeners.click?.forEach((callback) => callback({ currentTarget: this })); }

  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }

  querySelectorAll(selector) {
    const className = selector.startsWith(".") ? selector.slice(1) : "";
    const matches = [];
    for (const child of this.children) {
      if (className && child.className.split(/\s+/).includes(className)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
}

function withDocument(callback) {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tagName) => new TestElement(tagName) };
  try { callback(); } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test("anonymous shell exposes desktop and mobile login buttons through the shared auth callback", () => {
  withDocument(() => {
    let authCalls = 0;
    const shell = createAppShell({ openAuth: () => { authCalls += 1; }, content: new TestElement("section") });
    const desktopLogin = shell.querySelector(".vnext-shell__login--sidebar");
    const mobileLogin = shell.querySelector(".vnext-shell__login--topbar");

    assert.equal(desktopLogin.textContent, "Войти");
    assert.equal(mobileLogin.textContent, "Войти");
    assert.equal(desktopLogin.hidden, false);
    assert.equal(mobileLogin.hidden, false);
    assert.equal(desktopLogin.type, "button");
    assert.equal(mobileLogin.type, "button");
    desktopLogin.click();
    mobileLogin.click();
    assert.equal(authCalls, 2);
  });
});

test("shell auth presentation updates from snapshot without rebuilding actions and keeps profile navigation", () => {
  withDocument(() => {
    const navigated = [];
    let authCalls = 0;
    const shell = createAppShell({
      navigate: (view) => navigated.push(view),
      openAuth: () => { authCalls += 1; },
      content: new TestElement("section"),
    });
    const profile = shell.querySelector(".vnext-shell__account-action");
    const desktopLogin = shell.querySelector(".vnext-shell__login--sidebar");
    const mobileLogin = shell.querySelector(".vnext-shell__login--topbar");
    const eventListenersBefore = desktopLogin.listeners.click.length + mobileLogin.listeners.click.length;

    updateAppShellAuth(shell, true);
    assert.equal(shell.dataset.authenticated, "true");
    assert.equal(profile.hidden, false);
    assert.equal(desktopLogin.hidden, true);
    assert.equal(mobileLogin.hidden, true);
    profile.click();
    updateAppShellAuth(shell, false);
    assert.equal(shell.dataset.authenticated, "false");
    assert.equal(profile.hidden, true);
    assert.equal(desktopLogin.hidden, false);
    assert.equal(mobileLogin.hidden, false);
    desktopLogin.click();
    assert.deepEqual(navigated, ["settings"]);
    assert.equal(authCalls, 1);
    assert.equal(desktopLogin.listeners.click.length + mobileLogin.listeners.click.length, eventListenersBefore);
  });
});
