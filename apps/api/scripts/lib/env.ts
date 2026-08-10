/**
 * Load `.env` dari `apps/api/.env` SEBELUM modul lain di-import (terutama
 * `@serumah/db` yang membaca `DATABASE_URL` saat module load). Tanpa dotenv —
 * parser sederhana KEY=value, override selalu dari file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export function loadEnv(): void {
  // Script selalu dijalankan dari apps/api (npm script `notif:test`).
  const envFile = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = value;
  }
}

// Side-effect: dipanggil saat module ini di-import (harus jadi import pertama
// di script) sehingga DATABASE_URL sudah ter-load sebelum `@serumah/db` dibaca.
loadEnv();
