import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const authDirectory = new URL("./", import.meta.url);
const webappDirectory = new URL("../", authDirectory);

async function readWebappFile(relativePath) {
    return readFile(new URL(relativePath, webappDirectory), "utf8");
}

test("Account screen exposes explicit Email and Telegram linking without a client user id", async () => {
    const [html, app] = await Promise.all([
        readWebappFile("index.html"),
        readWebappFile("app.js"),
    ]);

    assert.match(html, /data-nav="settings"/);
    assert.match(html, /Способы входа/);
    assert.match(app, /\/auth\/account\/link/);
    assert.match(app, /\/auth\/account\/merge/);
    assert.match(app, /createEphemeralEmailLinkController/);
    assert.doesNotMatch(app, /target_user_id\s*:/);
    assert.doesNotMatch(app, /current_user_id\s*:/);
});

test("Email-link controller is deliberately isolated from the primary browser session", async () => {
    const source = await readWebappFile("auth/supabase-client.js");

    assert.match(source, /createEphemeralEmailLinkController/);
    assert.match(source, /persistSession:\s*false/);
    assert.match(source, /autoRefreshToken:\s*false/);
    assert.match(source, /detectSessionInUrl:\s*false/);
});
