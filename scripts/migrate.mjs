// Applique les migrations SQL de db/migrations (dans l'ordre, une seule fois chacune).
// Lancé automatiquement avant `next build` ; sans base configurée, il ne fait rien.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.log("migrate : aucune DATABASE_URL, migrations ignorées");
  process.exit(0);
}

const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  await client.query("revoke all on schema_migrations from public");
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (done.has(file)) continue;
    console.log(`migrate : ${file}`);
    await client.query("begin");
    try {
      await client.query(await readFile(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("migrate : base à jour");
} finally {
  await client.end();
}
