import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// Dates et horodatages renvoyés tels quels (chaînes ISO).
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1114, (v) => v); // timestamp
types.setTypeParser(1184, (v) => v); // timestamptz

const g = globalThis as unknown as { kdoPool?: Pool };

function pool(): Pool {
  if (!g.kdoPool) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("DATABASE_URL manquante");
    g.kdoPool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
  }
  return g.kdoPool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Sql = <T extends QueryResultRow = any>(text: string, params?: unknown[]) => Promise<T[]>;

function bind(client: PoolClient): Sql {
  return async (text, params) => (await client.query(text, params)).rows;
}

async function transaction<T>(setup: string, fn: (q: Sql) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query(setup);
    const result = await fn(bind(client));
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Exécute des requêtes au nom de l'utilisateur connecté : rôle kdo_user,
 * règles RLS appliquées, membre déduit de l'empreinte de session.
 */
export function asUser<T>(tokenHash: string, fn: (q: Sql) => Promise<T>): Promise<T> {
  if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error("Session invalide");
  return transaction(
    `BEGIN; SET LOCAL ROLE kdo_user; SELECT set_config('app.session', '${tokenHash}', true);`,
    fn,
  );
}

/**
 * Accès propriétaire (sans RLS) : réservé aux opérations qui vérifient
 * elles-mêmes les droits (connexion, invitations, identifiants enfants).
 */
export function asAdmin<T>(fn: (q: Sql) => Promise<T>): Promise<T> {
  return transaction("BEGIN", fn);
}
