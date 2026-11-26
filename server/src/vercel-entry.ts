/**
 * Vercel Serverless entry for PiGigz — NOT used by the Muse runtime.
 *
 * On Vercel there is no Muse daemon to host `server/src/actions.ts`, so
 * this module re-hosts the exact same building blocks behind one Node
 * `(req, res)` handler that `server/gen-vercel.mjs` bundles into
 * `.vercel/output/functions/actions.func/` (Vercel Build Output API):
 *
 *   - the same `Actions` map from `./actions` (same zod request/response
 *     validation, same handlers, same wire protocol the client speaks:
 *     POST { action, args } → 200 { data } / 4xx { error });
 *   - the same privileged handlers from `./privileged` (Pi Platform API +
 *     app-wallet payout signing), executed in-process through
 *     `createPrivilegedExecutor` — the server env vars
 *     PI_NETWORK_API_KEY / PI_WALLET_SEED are read by those handlers from
 *     `process.env`, exactly as on the host;
 *   - the same Drizzle schema, backed by a libSQL database (the same
 *     driver family the Muse runtime uses for `ctx.db`).
 *
 * Database: serverless functions have no durable local disk, so the
 * database must live outside the function. Set TURSO_DATABASE_URL (a
 * libSQL/Turso database URL) and TURSO_AUTH_TOKEN in the Vercel project
 * env vars for real, durable storage. While TURSO_DATABASE_URL is unset
 * the function falls back to a local libSQL file (on Vercel that is the
 * instance's /tmp: fine for a first smoke test, but data is per-instance
 * and temporary — it is NOT durable storage).
 *
 * The SQL migrations in `drizzle/` are applied once per cold start,
 * tracked in a `__pigigz_migrations` marker table so warm instances and
 * concurrent cold starts never re-apply them.
 */
import {
  createClient,
  type Client,
  type InStatement,
} from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import {
  createPrivilegedExecutor,
  type ActionDefinition,
  type Ctx,
  type PrivilegedTransport,
} from "@hatch/space-sdk";
import { Actions } from "./actions";
import * as schema from "./schema";
import { privilegedHandlers } from "./privileged";
import { MIGRATIONS } from "./migrations-data.generated";

/* ------------------------------------------------------------------ */
/* Minimal Node req/res shapes (avoids needing @types/node here).      */
/* ------------------------------------------------------------------ */

interface NodeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;
}

interface NodeResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void;
  end(chunk?: string): void;
}

/* ------------------------------------------------------------------ */
/* Database (libSQL / Turso)                                           */
/* ------------------------------------------------------------------ */

let dbPromise: Promise<LibSQLDatabase<typeof schema>> | null = null;

function createDbClient(): Client {
  const url =
    process.env.TURSO_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  const authToken =
    process.env.TURSO_AUTH_TOKEN?.trim() ||
    process.env.DATABASE_AUTH_TOKEN?.trim() ||
    "";
  if (url) {
    return createClient({
      url,
      ...(authToken ? { authToken } : {}),
    });
  }
  // No hosted database configured: local file fallback. On Vercel this is
  // the function instance's /tmp (temporary, per-instance). Locally it is
  // a file next to wherever the function runs.
  const file =
    process.env.PIGIGZ_DB_FILE?.trim() ||
    (process.env.VERCEL ? "/tmp/pigigz.db" : "pigigz-local.db");
  return createClient({ url: `file:${file}` });
}

async function applyMigrations(client: Client): Promise<void> {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS __pigigz_migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const appliedRows = await client.execute(
    "SELECT tag FROM __pigigz_migrations",
  );
  const applied = new Set(appliedRows.rows.map((r) => String(r.tag)));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.tag)) continue;
    const statements = migration.sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    try {
      // Marker insert first, inside the same write transaction: if a
      // concurrent cold start already applied this migration, the batch
      // fails on the primary key and rolls back cleanly.
      await client.batch(
        [
          {
            sql: "INSERT INTO __pigigz_migrations (tag, applied_at) VALUES (?, ?)",
            args: [migration.tag, Date.now()],
          },
          ...statements.map((sql): InStatement => ({ sql, args: [] })),
        ],
        "write",
      );
    } catch (err) {
      const check = await client.execute({
        sql: "SELECT tag FROM __pigigz_migrations WHERE tag = ?",
        args: [migration.tag],
      });
      if (check.rows.length === 0) throw err;
    }
    applied.add(migration.tag);
  }
}

function getDb(): Promise<LibSQLDatabase<typeof schema>> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const client = createDbClient();
      await applyMigrations(client);
      return drizzle(client, { schema });
    })();
    // Don't cache a rejected promise forever: a later request may retry
    // (e.g. after the developer fixes the database env vars).
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/* ------------------------------------------------------------------ */
/* ctx shim                                                            */
/* ------------------------------------------------------------------ */

/** Runs the real privileged handlers (Pi payments/payouts) in-process. */
const privilegedTransport: PrivilegedTransport = async (contract, args) => {
  const entry = privilegedHandlers.entries.find(
    (e) => e.contract.name === contract.name,
  );
  if (!entry) {
    throw new Error(
      `no privileged handler registered for "${contract.name}"`,
    );
  }
  const handler = entry.handler as (a: unknown) => Promise<unknown>;
  return await handler(args);
};

const unavailable = (what: string) => () => {
  throw new Error(`${what} is not available in the Vercel serverless runtime`);
};

function makeCtx(
  def: ActionDefinition,
  db: LibSQLDatabase<typeof schema>,
): Ctx {
  const executor = createPrivilegedExecutor(def.privileged, privilegedTransport);
  const ctx = {
    slug: "pigigz",
    invocationId: crypto.randomUUID(),
    spaceDir: process.cwd(),
    db: () => db,
    blobs: {
      put: unavailable("ctx.blobs"),
      getUrl: unavailable("ctx.blobs"),
      delete: unavailable("ctx.blobs"),
      head: unavailable("ctx.blobs"),
      list: unavailable("ctx.blobs"),
    },
    viewer: undefined,
    agent: {
      spawnTask: async () => ({
        ok: false as const,
        error: "ctx.agent is not available in the Vercel serverless runtime",
      }),
      send: async () => ({
        ok: false as const,
        error: "ctx.agent is not available in the Vercel serverless runtime",
      }),
      status: async (taskId: string) => ({
        taskId,
        status: "not_found" as const,
      }),
    },
    inference: { complete: unavailable("ctx.inference") },
    tool: {},
    emit: () => {},
    // The Vercel deployment is a public single-page app: there is no
    // host bridge to push invalidations through, and React Query already
    // refetches on mutation settle, so this is a safe no-op.
    invalidateQueries: () => {},
    executePrivileged: executor.executePrivileged,
  };
  return ctx as unknown as Ctx;
}

/* ------------------------------------------------------------------ */
/* Dispatch — mirrors the Muse worker's wire protocol.                 */
/* ------------------------------------------------------------------ */

async function dispatch(
  actionName: string,
  rawArgs: unknown,
): Promise<{ status: number; body: unknown }> {
  const def = (Actions as Record<string, ActionDefinition>)[actionName];
  if (!def || typeof def.handler !== "function") {
    return { status: 404, body: { error: `unknown action: ${actionName}` } };
  }
  const parsed = def.request.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    return {
      status: 400,
      body: { error: `invalid args: ${JSON.stringify(parsed.error.issues)}` },
    };
  }
  let db: LibSQLDatabase<typeof schema>;
  try {
    db = await getDb();
  } catch (err) {
    return {
      status: 500,
      body: {
        error: `database unavailable: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
  let result: unknown;
  try {
    result = await def.handler(makeCtx(def, db), parsed.data);
  } catch (err) {
    // Diagnostic logging (2026-11-25): Vercel runtime logs were empty because
    // the server never logged anything. Log every failed action with its
    // action name + exact message (no secrets) so the next failed payment
    // shows up in Vercel > Logs instead of disappearing.
    console.error(
      `[pigigz] ${actionName} failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return {
      status: 400,
      body: { error: err instanceof Error ? err.message : String(err) },
    };
  }
  const out = def.response.safeParse(result);
  if (!out.success) {
    return {
      status: 500,
      body: { error: `response validation failed: ${out.error.message}` },
    };
  }
  return { status: 200, body: { data: out.data } };
}

/* ------------------------------------------------------------------ */
/* HTTP handler                                                        */
/* ------------------------------------------------------------------ */

const MAX_BODY_BYTES = 1_000_000;

async function readBody(req: NodeRequest): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("request body too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: NodeResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body) ?? "null");
}

export default async function handler(
  req: NodeRequest,
  res: NodeResponse,
): Promise<void> {
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed: use POST" });
      return;
    }
    let payload: { action?: unknown; args?: unknown };
    try {
      payload = JSON.parse(await readBody(req)) as {
        action?: unknown;
        args?: unknown;
      };
    } catch {
      sendJson(res, 400, { error: "invalid JSON body" });
      return;
    }
    if (!payload || typeof payload.action !== "string") {
      sendJson(res, 400, { error: "missing action name" });
      return;
    }
    const { status, body } = await dispatch(payload.action, payload.args ?? {});
    sendJson(res, status, body);
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "internal error",
    });
  }
}
