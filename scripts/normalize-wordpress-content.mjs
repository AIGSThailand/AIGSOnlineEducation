/**
 * One-time fix: normalize WordPress block markup in existing courses & lessons.
 *
 * Usage: node scripts/normalize-wordpress-content.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { wordpressContentToHtml } from './lib/wordpress-content.mjs';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        process.env[key.trim()] = rest.join('=').trim();
      }
    });
}

loadEnv();

const isDryRun = process.argv.includes('--dry-run');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function normalizeTable(table, column) {
  let offset = 0;
  const pageSize = 100;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`id, ${column}`)
      .not(column, 'is', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const raw = row[column];
      if (!raw || !raw.includes('<!--')) continue;

      const clean = wordpressContentToHtml(raw);
      if (clean === raw) continue;

      if (!isDryRun) {
        const { error: upErr } = await supabase
          .from(table)
          .update({ [column]: clean })
          .eq('id', row.id);
        if (upErr) console.error(`${table} ${row.id}:`, upErr.message);
        else updated++;
      } else {
        updated++;
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return updated;
}

async function main() {
  console.log(isDryRun ? '=== DRY RUN ===' : 'Normalizing WordPress content...');

  const courses = await normalizeTable('courses', 'description');
  const lessons = await normalizeTable('lessons', 'content');

  console.log(`Courses updated: ${courses}`);
  console.log(`Lessons updated: ${lessons}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
