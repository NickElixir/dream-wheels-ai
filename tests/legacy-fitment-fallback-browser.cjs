const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const checks = [];
    try {
        for (const width of [390, 1440]) for (const locale of ['ru', 'en']) for (const scenario of ['editor', 'result', 'incompatible', 'failed', 'failed-no-retry']) {
            const page = await browser.newPage({ viewport: { width, height: 900 }, locale: locale === 'ru' ? 'ru-RU' : 'en-US' });
            const errors = [], blocked = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', route => {
                if (new URL(route.request().url()).origin === 'http://127.0.0.1:8779') return route.continue();
                blocked.push(new URL(route.request().url()).origin);
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
            await page.goto(`http://127.0.0.1:8779/tests/browser-fixtures/legacy-fitment-fallback.html?scenario=${scenario}`);
            try { await page.waitForFunction(() => window.qaReady, {}, { timeout: 10000 }); }
            catch (error) { throw Error(JSON.stringify({ width, locale, scenario, errors, message: error.message })); }
            assert.deepEqual(errors, []);
            assert.equal(await page.locator('[data-vnext-fitment-root]').count(), 0);
            const title = await page.locator('[data-fitment-render-copy]').textContent();
            const helper = await page.locator('[data-fitment-render-helper]').textContent();
            assert.equal(title, locale === 'en' ? 'Visual try-on' : 'Визуальная примерка');
            assert.equal(helper, scenario === 'incompatible'
                ? (locale === 'en' ? 'You can still create an image to see how the wheels look.' : 'Вы всё ещё можете создать изображение, чтобы оценить внешний вид дисков.')
                : (locale === 'en' ? 'See how the selected wheel looks on your vehicle' : 'Посмотрите, как выбранный диск выглядит на вашем автомобиле'));
            if (locale === 'en') assert.doesNotMatch(title + helper, /[А-Яа-яЁё]/u);
            const state = await page.evaluate(() => window.qaFallback);
            assert.equal(state.before, state.after, 'presentation must not mutate canonical form/overview/check/job');
            assert.equal(state.locale, locale);
            const retry = page.locator('[data-fitment-check]');
            if (scenario === 'failed') { assert.equal(await retry.isVisible(), true); assert.equal(await retry.isEnabled(), true); if (locale === 'ru') assert.equal(await retry.textContent(), 'Повторить'); }
            if (scenario === 'failed-no-retry') assert.equal(await retry.isVisible(), false);
            for (const name of ['Create', 'Render', 'Fitment', 'Wallet']) assert.ok(state.bridges[name].includes('snapshot'));
            checks.push({ width, locale, scenario, title, helper, canonicalStateUnchanged: true, blockedExternalOrigins: [...new Set(blocked)], retryVisible: await retry.isVisible() });
            await page.close();
        }
        const directory = process.env.P2C_EVIDENCE_DIR || 'docs/evidence/p2c-test-hardening';
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, 'legacy-fallback-results.json'), JSON.stringify(checks, null, 2) + '\n');
        console.log(`${checks.length} legacy fallback DOM regression cases PASS`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
