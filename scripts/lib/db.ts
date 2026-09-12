import { Client } from "pg";
import { loadEnv, requireEnv } from "./env";

/**
 * Direct Postgres client for scripts. Uses DATABASE_URL, which on this machine
 * points at the Supabase *session* pooler (port 5432) because the db.<ref>
 * host is IPv6-only. The pooler requires TLS; the Supabase cert chain is not in
 * the default Node trust store so it is accepted explicitly.
 */
export async function connectDb(): Promise<Client> {
  loadEnv();
  const client = new Client({
    connectionString: requireEnv("DATABASE_URL"),
    ssl: { rejectUnauthorized: false },
    application_name: "vgbd-scripts",
    statement_timeout: 120_000,
  });
  await client.connect();
  return client;
}
