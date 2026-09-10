import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false> | null = null;
let ready: Promise<void> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

export async function getDatabase(): Promise<NeonQueryFunction<false, false> | null> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    if (process.env.VERCEL) throw new Error('Database is not connected. Connect Neon in Vercel Storage and redeploy the project.');
    return null; // Local demonstration mode only.
  }
  if (!sql) sql = neon(url);
  const connection = sql;
  if (!ready) {
    ready = (async () => {
      await connection`CREATE TABLE IF NOT EXISTS rapidresq_incidents (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL
      )`;
      await connection`CREATE TABLE IF NOT EXISTS rapidresq_media (
        id TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        content TEXT NOT NULL
      )`;
    })().catch((error) => { ready = null; throw error; });
  }
  await ready;
  return connection;
}
