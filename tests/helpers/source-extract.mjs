import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const { parse } = createRequire(new URL('../../webapp/package.json', import.meta.url))('acorn');
let cachedSource, cachedIndex;
function declarations(source) {
    if (source === cachedSource) return cachedIndex;
    const index = new Map();
    for (const statement of parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body) {
        const node = statement.type.startsWith('Export') ? statement.declaration : statement;
        if (!node) continue;
        if (node.type === 'FunctionDeclaration') index.set(node.id.name, { kind: 'function', text: source.slice(node.start, node.end) });
        if (node.type === 'VariableDeclaration') for (const binding of node.declarations) {
            if (binding.id.type === 'Identifier') index.set(binding.id.name, { kind: 'variable', text: source.slice(node.start, node.end) });
        }
        const expression = node.type === 'ExpressionStatement' && node.expression;
        if (expression?.type === 'AssignmentExpression' && expression.left.type === 'MemberExpression' && !expression.left.computed && expression.left.object.name === 'window') {
            index.set(`window.${expression.left.property.name}`, { kind: 'window', text: source.slice(node.start, node.end) });
        }
    }
    cachedSource = source; cachedIndex = index;
    return index;
}
export function extractDeclaration(source, name) {
    const entry = declarations(source).get(name);
    if (!entry) throw Error(`Missing top-level declaration: ${name}`);
    return entry.text;
}
export function extractFunction(source, name) {
    const entry = declarations(source).get(name);
    if (entry?.kind !== 'function') throw Error(`Missing top-level function: ${name}`);
    return entry.text;
}
export const extractFunctions = (source, names) => names.map(name => extractFunction(source, name)).join('\n\n');
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const index = declarations(fs.readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(Object.fromEntries([...index].filter(([, value]) => value.kind === 'function').map(([name, value]) => [name, value.text]))));
}
