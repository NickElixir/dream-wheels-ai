import type { PoolClient, QueryResultRow } from "pg";

export async function queryReadOnly<T extends QueryResultRow>(
  client: Pick<PoolClient, "query" | "release">,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  let discard = false;
  try {
    // Also works through transaction-pooling endpoints; the setting is transaction-local.
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await client.query<T>(sql, params);
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    try { await client.query("ROLLBACK"); }
    catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}
