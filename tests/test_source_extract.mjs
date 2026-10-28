import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFunction, extractFunctions, extractDeclaration } from './helpers/source-extract.mjs';
const target = 'async function target() { const literal = "}"; const re = /[{}]/u; /* } */ return `value ${(() => ({ value: "😀" }))().value}`; }';
test('source extraction ignores braces in literals, comments, regex and nested templates', () => {
    assert.equal(extractFunction(`const prefix = "😀"; ${target}\nfunction neighbor() { return 1; }`, 'target'), target);
});
test('source extraction is independent of neighboring declarations and source order', () => {
    for (const source of [target, `function other() {}\n${target}`, `${target}\nconst unrelated = {};`]) assert.equal(extractFunction(source, 'target'), target);
    assert.equal(extractFunctions(`function b() {}\n${target}`, ['target', 'b']), `${target}\n\nfunction b() {}`);
});
test('source extraction supports exported functions and explicit window bridge assignments', () => {
    const source = `export ${target}\nwindow.dreamwheelsFitmentBridge = { snapshot: target };`;
    assert.equal(extractFunction(source, 'target'), target);
    assert.equal(extractDeclaration(source, 'window.dreamwheelsFitmentBridge'), 'window.dreamwheelsFitmentBridge = { snapshot: target };');
});
test('source extraction rejects missing targets, variables, nested-only functions and invalid syntax', () => {
    for (const source of ['const target = 1;', 'function outer() { function target() {} }']) assert.throws(() => extractFunction(source, 'target'), /Missing top-level function/);
    assert.throws(() => extractFunction('function target() {', 'target'), SyntaxError);
});
