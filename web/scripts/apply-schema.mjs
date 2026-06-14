// Finds the project's pooler region, then applies supabase/schema.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, '..', 'supabase', 'schema.sql'), 'utf8');

const REF = process.env.REF;
const PASS = process.env.PASS;
const regions = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-central-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1',
  'ca-central-1', 'sa-east-1',
];

function connStr(prefix, region) {
  return `postgresql://postgres.${REF}:${encodeURIComponent(PASS)}@${prefix}-${region}.pooler.supabase.com:5432/postgres`;
}

async function tryConn(cs) {
  const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000, query_timeout: 8000 });
  try { await c.connect(); return c; }
  catch (e) { try { await c.end(); } catch {} return null; }
}

let client = null, used = null;
outer:
for (const region of regions) {
  for (const prefix of ['aws-0', 'aws-1']) {
    const cs = connStr(prefix, region);
    const c = await tryConn(cs);
    if (c) { client = c; used = `${prefix}-${region}`; break outer; }
  }
}

if (!client) { console.error('Could not connect to any pooler region.'); process.exit(1); }
console.log('Connected via', used);

try {
  await client.query(sql);
  const t = await client.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('profiles','lore_entries') order by table_name");
  console.log('OK tables:', t.rows.map((r) => r.table_name).join(', '));
  const p = await client.query("select count(*)::int n from pg_policies where schemaname='public'");
  console.log('RLS policies:', p.rows[0].n);
  console.log('POOLER_HOST=' + used + '.pooler.supabase.com');
} catch (e) {
  console.error('SCHEMA FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
