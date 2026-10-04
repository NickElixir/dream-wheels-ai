const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const base = process.env.P2B_BASE || '260c3516c286dc37c3647a2dca465e05985c38e5';
const baseline = execFileSync('git', ['show', `${base}:webapp/app.js`], { cwd: root, encoding: 'utf8' });
const current = fs.readFileSync(path.join(root, 'webapp/app.js'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'browser-fixtures/e01-i18n.html'), 'utf8')
    .replace("if(scenario==='p2a-copy-consistency') {", `if(scenario.startsWith('p2b-fallback-')) {
 const html=await(await fetch("\${new URL('../../webapp/index.html',location.href)}")).text();
 content=new DOMParser().parseFromString(html,'text/html').querySelector('[data-view="fitment"]');
 content.hidden=false;document.querySelector('#fixture').append(content);
 state.view='fitment';state.fitmentJobId='p2b-demo';state.fitmentOverview=buildDefaultDemoFitmentOverview();
 state.fitmentForm=fitmentFormFromOverview(state.fitmentOverview);state.fitmentFormState.baseline=cloneFitmentForm(state.fitmentForm);
 state.fitmentActiveSection=scenario.endsWith('editor')?'rim':'result';state.fitmentRimEditing=scenario.endsWith('editor');
 state.fitmentCheck=structuredClone(data.compatible);state.fitmentCheck.is_current=true;
 if(scenario.endsWith('failed')){state.fitmentCheck.execution_status='failed';state.fitmentCheck.retry_mode='retryable';}
 renderFitment();title='Fallback';
 if(scenario.endsWith('result')&&!content.querySelector('[data-fitment-verdict-title]').textContent)throw Error('fallback result missing');
 if(scenario.endsWith('editor')&&!content.querySelector('[data-fitment-input="rim.wheel_diameter_in"]'))throw Error('fallback editor missing');
} else if(scenario==='p2a-copy-consistency') {`)
    .replace('window.qaScenario=scenario;', `window.qaP2BState=()=>({view:state.view,jobId:state.fitmentJobId,section:state.fitmentActiveSection,form:state.fitmentForm,check:state.fitmentCheck,renderHistory:state.renderHistory,creditPackages:state.creditPackages,auth:state.frontendAuthState,model:window.qaModel||null,bridges:Object.fromEntries(['Create','Render','Fitment','Wallet'].map(name=>[name,Object.keys(window['dreamwheels'+name+'Bridge']).sort()]))});window.qaScenario=scenario;`);
const scenarios = ['dashboard', 'create', 'history', 'result', 'refunded', 'missing-asset', 'editor', 'compatible', 'failed', 'stale', 'wallet', 'pending-payment', 'auth-email', 'auth-restored', 'p2b-fallback-editor', 'p2b-fallback-result', 'p2b-fallback-failed'];
(async () => {
    const browser = await chromium.launch({ headless: true });
    const checks = [];
    try {
        for (const width of [390, 1440]) for (const locale of ['ru', 'en']) for (const scenario of scenarios) {
            const outputs = [];
            for (const source of [baseline, current]) {
                const page = await browser.newPage({ viewport: { width, height: 900 }, locale: locale === 'ru' ? 'ru-RU' : 'en-US' });
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.route('**/*', route => {
                    const url = new URL(route.request().url());
                    if (url.origin !== 'http://127.0.0.1:8779') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                    if (url.pathname.endsWith('/webapp/app.js')) return route.fulfill({ contentType: 'text/javascript', body: source });
                    if (url.pathname.endsWith('/tests/browser-fixtures/e01-i18n.html')) return route.fulfill({ contentType: 'text/html', body: fixture });
                    return route.continue();
                });
                await page.goto(`http://127.0.0.1:8779/tests/browser-fixtures/e01-i18n.html?scenario=${scenario}`);
                try { await page.waitForFunction(() => window.qaReady, {}, { timeout: 10000 }); }
                catch (error) { throw Error(JSON.stringify({ width, locale, scenario, errors, error: error.message })); }
                assert.deepEqual(errors, []);
                outputs.push(await page.evaluate(() => ({
                    route: { pathname: location.pathname, search: location.search, view: document.querySelector('#fixture').dataset.view || null },
                    visibleStatus: document.querySelector('#fixture').innerText,
                    actions: [...document.querySelectorAll('#fixture button,#fixture a,#fixture input,#fixture select')].filter(node => node.getClientRects().length && !node.closest('[hidden]')).map(node => ({ tag: node.tagName, text: node.textContent, disabled: node.disabled || false, type: node.type || null, href: node.getAttribute('href'), data: { ...node.dataset } })),
                    criticalState: window.qaP2BState(),
                })));
                await page.close();
            }
            assert.deepEqual(outputs[1], outputs[0], `${width}/${locale}/${scenario} presentation/state parity`);
            checks.push({ width, locale, scenario, parity: true, route: outputs[1].route, hashes: Object.fromEntries(Object.entries(outputs[1]).map(([key, value]) => [key, createHash('sha256').update(JSON.stringify(value)).digest('hex')])) });
        }
        const directory = process.env.P2B_EVIDENCE_DIR || 'docs/evidence/p2b-dead-code-dedup';
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'presentation-parity.json'), JSON.stringify({ base, checks }, null, 2) + '\n');
        console.log(`${checks.length} BASE/HEAD browser parity cases PASS (route/status/actions/critical state)`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
