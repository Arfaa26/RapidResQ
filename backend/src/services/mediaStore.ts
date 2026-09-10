import fs from 'node:fs/promises';
import { getDatabase } from './database.js';

export async function saveMedia(file: Express.Multer.File): Promise<string> {
  const sql = await getDatabase();
  if (!sql) return `/uploads/${file.filename}`;
  const content = (await fs.readFile(file.path)).toString('base64');
  await sql`INSERT INTO rapidresq_media (id, mime_type, content)
    VALUES (${file.filename}, ${file.mimetype}, ${content})`;
  // Serverless temporary files can disappear; the database keeps the attachment.
  await fs.unlink(file.path).catch(() => undefined);
  return `/api/media/${file.filename}`;
}

export async function readMedia(id: string): Promise<{ content: Buffer; mimeType: string } | null> {
  const sql = await getDatabase();
  if (!sql) return null;
  const [row] = await sql`SELECT content, mime_type FROM rapidresq_media WHERE id = ${id}`;
  return row ? { content: Buffer.from(row.content, 'base64'), mimeType: row.mime_type } : null;
}
