import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");

function apiRouting(hostname, config, apiBaseUrl) {
    const resolveStart = app.indexOf("function resolveApiBaseUrl()");
    const resolveEnd = app.indexOf("function appendSearchParams", resolveStart);
    const apiStart = app.indexOf("function apiUrl(", resolveEnd);
    const apiEnd = app.indexOf("function loadTelegramLoginLibrary", apiStart);
    assert.ok(resolveStart >= 0 && resolveEnd > resolveStart && apiStart > resolveEnd && apiEnd > apiStart);

    const context = {
        URL,
        URLSearchParams,
        window: { location: { hostname }, __DREAM_WHEELS_DEPLOYMENT_CONFIG__: config },
        state: { apiBaseUrl },
        WEBSITE_PROXY_BASE_URL: "/api/backend",
        TIMEWEB_API_ORIGIN: "https://dream-wheels-ai-prod-vnext.onrender.com",
        DENO_TEST_API_BASE_URL: "https://gateway-test.dreamwheels.deno.net/api/backend",
        LOCAL_API_BASE_URL: "http://127.0.0.1:10000",
        API_MODE_STORAGE_KEY: "dreamWheelsApiMode",
        localStorage: { getItem: () => "", setItem() {} },
        appendSearchParams: (url) => url,
        getIdentitySearchParams: () => new URLSearchParams(),
    };
    runInNewContext(`${app.slice(resolveStart, resolveEnd)}\n${app.slice(apiStart, apiEnd)}\nthis.result = { configuredDeploymentApiBaseUrl, shouldUseBrowserApiProxy, apiUrl };`, context);
    return context.result;
}

test("Timeweb direct API selection rewrites relative protected asset paths to Render", () => {
    const routes = apiRouting("app.dream-wheels.ru", {
        apiBaseUrl: "https://dream-wheels-ai-prod-vnext.onrender.com",
    }, "https://dream-wheels-ai-prod-vnext.onrender.com");
    assert.equal(routes.configuredDeploymentApiBaseUrl(), "https://dream-wheels-ai-prod-vnext.onrender.com");
    assert.equal(routes.shouldUseBrowserApiProxy(), false);
    assert.equal(routes.apiUrl("/jobs/job-1/assets/result/download"),
        "https://dream-wheels-ai-prod-vnext.onrender.com/jobs/job-1/assets/result/download");
});

test("Vercel, unknown hosts, and invalid configured origins retain the same-origin gateway", () => {
    const config = { apiBaseUrl: "https://dream-wheels-ai-prod-vnext.onrender.com" };
    for (const hostname of ["dream-wheels-ai-webapp.vercel.app", "unknown.example"]) {
        const routes = apiRouting(hostname, config, "/api/backend");
        assert.equal(routes.shouldUseBrowserApiProxy(), true);
        assert.equal(routes.apiUrl("/jobs/job-1"), "/api/backend/jobs/job-1");
    }
    const invalid = apiRouting("app.dream-wheels.ru", { apiBaseUrl: "https://user@dream-wheels-ai-prod-vnext.onrender.com" }, "/api/backend");
    assert.equal(invalid.configuredDeploymentApiBaseUrl(), "");
    assert.equal(invalid.shouldUseBrowserApiProxy(), true);
    assert.equal(invalid.apiUrl("/auth/me"), "/api/backend/auth/me");
});

test("Deno gateway is selected only by the exact test deployment config", () => {
    const config = {
        apiBaseUrl: "https://gateway-test.dreamwheels.deno.net/api/backend",
        environment: "test",
    };
    const routes = apiRouting("app-test.dream-wheels.ru", config, config.apiBaseUrl);
    assert.equal(routes.configuredDeploymentApiBaseUrl(), config.apiBaseUrl);
    assert.equal(routes.apiUrl("/jobs/job-1"), "https://gateway-test.dreamwheels.deno.net/api/backend/jobs/job-1");

    for (const invalidConfig of [
        { ...config, apiBaseUrl: "https://evil.example/api/backend" },
        { ...config, apiBaseUrl: "https://gateway-test.dreamwheels.deno.net/api/backend.evil" },
        { ...config, apiBaseUrl: "https://user@gateway-test.dreamwheels.deno.net/api/backend" },
        { apiBaseUrl: config.apiBaseUrl },
    ]) {
        const invalid = apiRouting("app-test.dream-wheels.ru", invalidConfig, "/api/backend");
        assert.equal(invalid.configuredDeploymentApiBaseUrl(), "");
        assert.equal(invalid.apiUrl("/jobs/job-1"), "/api/backend/jobs/job-1");
    }
    const wrongHost = apiRouting("app.dream-wheels.ru", config, "/api/backend");
    assert.equal(wrongHost.configuredDeploymentApiBaseUrl(), "");
});
