import assert from "node:assert/strict";
import { test } from "node:test";
import { queryReadOnly } from "../src/lib/read-only-query.ts";

test("every admin query runs in an explicit read-only transaction with a timeout", async () => {
  const calls = [];
  const rows = [{ id: 1 }];
  const client = {
    query: async (sql, params) => { calls.push([sql, params]); return { rows }; },
    release: (discard) => calls.push(["release", discard]),
  };
  assert.equal(await queryReadOnly(client, "SELECT id FROM jobs WHERE id = $1", [1]), rows);
  assert.deepEqual(calls, [
    ["BEGIN READ ONLY", undefined], ["SET LOCAL statement_timeout = '15s'", undefined],
    ["SELECT id FROM jobs WHERE id = $1", [1]], ["COMMIT", undefined], ["release", false],
  ]);
});

test("query failure rolls back and releases the client", async () => {
  const calls = [];
  const failure = new Error("read-only violation");
  await assert.rejects(queryReadOnly({
    query: async (sql) => { calls.push(sql); if (sql === "UPDATE jobs") throw failure; return { rows: [] }; },
    release: (discard) => calls.push(["release", discard]),
  }, "UPDATE jobs"), (error) => error === failure);
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", ["release", false]]);
  assert.ok(!calls.includes("COMMIT"));
});

test("a broken transaction is discarded if rollback fails", async () => {
  const released = [];
  await assert.rejects(queryReadOnly({
    query: async (sql) => { if (["SELECT 1", "ROLLBACK"].includes(sql)) throw new Error("connection lost"); return { rows: [] }; },
    release: (discard) => released.push(discard),
  }, "SELECT 1"));
  assert.deepEqual(released, [true]);
});
