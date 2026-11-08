import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAdminAuth } from "../src/lib/admin-auth.ts";
import { legacyAsset, legacyResult, safeReturnPath, signAsset, storageBase, validStorageKey } from "../src/lib/job-media.ts";
import { getJobDetails, resolveJobAsset } from "../src/lib/job-data.ts";
import { GET } from "../src/app/api/jobs/[id]/assets/[kind]/route.ts";

const id = "23f2c72f-9d34-47e1-8c5d-1a2f6e3d5b58";
const base = "https://example.supabase.co/storage/v1";
const asset = { id, bucket: "raw", storage_key: `users/1/drafts/${id}/car_original/photo.jpg` };

test("Basic auth fails closed, including malformed credentials", () => {
  const oldUser = process.env.ADMIN_USERNAME;
  const oldPass = process.env.ADMIN_PASSWORD;
  try {
    delete process.env.ADMIN_USERNAME;
    assert.equal(checkAdminAuth(null), 503);
    process.env.ADMIN_USERNAME = "admin"; process.env.ADMIN_PASSWORD = "secret:with:colon";
    for (const value of [null, "Bearer x", "Basic !!!", `Basic ${btoa("admin")}`, `Basic ${btoa("admin:wrong")}`]) {
      assert.equal(checkAdminAuth(value), 401);
    }
    assert.equal(checkAdminAuth(`Basic ${btoa("admin:secret:with:colon")}`), 200);
  } finally {
    if (oldUser === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = oldUser;
    if (oldPass === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = oldPass;
  }
});

test("return link only preserves dashboard filters", () => {
  for (const value of ["https://evil.test", "//evil.test", "/jobs/x", undefined]) assert.equal(safeReturnPath(value), "/");
  assert.equal(safeReturnPath("/?status=failed&user=42&redirect=https://evil.test"), "/?status=failed&user=42");
});

test("legacy source fallback only accepts the historical job-local uploader path", () => {
  assert.equal(legacyAsset(id, "car_original", `${id}/car.jpg`).bucket, "raw");
  for (const value of [`${id}/wheel.jpg`, "https://api.telegram.org/file/botSECRET/photo.jpg", `${id}/../car.jpg`, "other/car.jpg"]) {
    assert.equal(legacyAsset(id, "car_original", value), null);
  }
  assert.equal(legacyAsset(id, "result", `${id}/car.jpg`), null);
});

test("legacy result cannot redirect to external hosts or other buckets", () => {
  assert.equal(legacyResult(`${base}/object/public/results/${id}/render.jpg`, base).bucket, "results");
  for (const value of ["https://evil.test/a.jpg", `${base}/object/public/raw/secret.jpg`, `${base}/object/public/results/a.jpg?token=secret`]) {
    assert.equal(legacyResult(value, base), null);
  }
});

test("storage origin and keys reject unsafe input", () => {
  assert.equal(storageBase("https://example.supabase.co"), base);
  for (const value of ["http://example.supabase.co", "https://evil.test", "https://example.supabase.co@evil.test", "https://example.supabase.co/other"]) {
    assert.throws(() => storageBase(value));
  }
  for (const key of ["", "/a.jpg", "a/../b", "a\\b", "a\nb", "a//b"]) assert.equal(validStorageKey(key), false);
});

test("signing has fixed expiry, private cache policy and server-only credentials", async () => {
  const signedPath = `/object/sign/raw/${asset.storage_key}?token=temporary`;
  const url = await signAsset(asset, { url: base, key: "server-secret" }, async (url, init) => {
    assert.equal(url, `${base}/object/sign/raw/${asset.storage_key}`);
    assert.equal(init.headers.Authorization, "Bearer server-secret");
    assert.equal(init.cache, "no-store"); assert.equal(init.redirect, "error");
    assert.deepEqual(JSON.parse(init.body), { expiresIn: 300 });
    return Response.json({ signedURL: signedPath });
  });
  assert.equal(url, `${base}${signedPath}`);
});

test("signing handles missing configuration, deleted object and provider failures safely", async () => {
  await assert.rejects(signAsset(asset, { url: "", key: "" }), { status: 503 });
  await assert.rejects(signAsset({ ...asset, bucket: "other" }, { url: base, key: "secret" }), { status: 404 });
  for (const [response, status] of [
    [new Response("", { status: 404 }), 404],
    [Response.json({ statusCode: "404", error: "not_found" }, { status: 400 }), 404],
    [new Response("SECRET", { status: 500 }), 502],
    [Response.json({ signedURL: "https://evil.test?token=SECRET" }), 502],
    [Response.json({ signedURL: "/object/sign/raw/other.jpg?token=SECRET" }), 502],
  ]) {
    await assert.rejects(signAsset(asset, { url: base, key: "secret" }, async () => response), (error) => {
      assert.equal(error.status, status); assert.ok(!error.message.includes("SECRET")); return true;
    });
  }
  await assert.rejects(signAsset(asset, { url: base, key: "secret" }, async () => { throw new Error("SECRET"); }), { status: 502 });
});

test("details use explicit FK, owner and kind constraints, not mutable asset.job_id", async () => {
  let calls = 0;
  assert.equal(await getJobDetails("invalid", async () => { calls++; return []; }), null);
  assert.equal(calls, 0);
  await getJobDetails(id, async (sql, params) => {
    assert.deepEqual(params, [id]);
    for (const [alias, fk, kind] of [["car", "car_asset_id", "car_original"], ["wheel", "rim_asset_id", "rim_original"], ["result", "result_asset_id", "result"]]) {
      assert.ok(sql.includes(`${alias}.id = j.${fk}`));
      assert.ok(sql.includes(`${alias}.owner_user_id = j.user_id`));
      assert.ok(sql.includes(`${alias}.kind = '${kind}'`));
    }
    assert.ok(!sql.includes("car.job_id"));
    return [];
  });
});

test("reused draft assets work; broken or foreign FK never falls back to a legacy path", () => {
  const job = { id, car: asset, car_asset_id: id, car_image_url: `${id}/car.jpg` };
  assert.equal(resolveJobAsset(job, "car_original"), asset);
  assert.equal(resolveJobAsset({ ...job, car: null }, "car_original"), null);
  assert.equal(resolveJobAsset({ ...job, car: null, car_asset_id: null }, "car_original").bucket, "raw");
});

test("media route authenticates before DB access and rejects invalid IDs and kinds", async () => {
  const oldUser = process.env.ADMIN_USERNAME;
  const oldPass = process.env.ADMIN_PASSWORD;
  try {
    process.env.ADMIN_USERNAME = "admin"; process.env.ADMIN_PASSWORD = "test-only";
    const params = Promise.resolve({ id, kind: "car_original" });
    const denied = await GET(new Request("http://localhost/api/jobs/test"), { params });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
    assert.ok(denied.headers.get("WWW-Authenticate").startsWith("Basic"));
    for (const bad of [{ id: "invalid", kind: "car_original" }, { id, kind: "../raw" }]) {
      const response = await GET(new Request("http://localhost/api/jobs/test", {
        headers: { Authorization: `Basic ${btoa("admin:test-only")}` },
      }), { params: Promise.resolve(bad) });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
    }
    delete process.env.ADMIN_USERNAME;
    const missing = await GET(new Request("http://localhost/api/jobs/test"), { params });
    assert.equal(missing.status, 503);
  } finally {
    if (oldUser === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = oldUser;
    if (oldPass === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = oldPass;
  }
});
