/**
 * db-extras.ts — Run all custom SQL migrations that Prisma doesn't manage.
 *
 * This script runs after `prisma db push` / `prisma migrate deploy` to set up
 * tables and functions that need raw SQL (UNLOGGED tables, custom functions, etc.).
 *
 * Usage: bun run db:extras
 *
 * To add new custom migrations:
 *   1. Create a .sql file in prisma/migrations/
 *   2. Add the filename to the EXTRAS array below
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const EXTRAS = [
    'rate_limit.sql',
    // Add future custom SQL files here
];

async function main() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        console.error('❌ DATABASE_URL is not set');
        process.exit(1);
    }

    // Strip Prisma-specific query params (e.g. ?schema=public) that pg doesn't understand
    const cleanUrl = url.split('?')[0];
    const client = new pg.Client({ connectionString: cleanUrl });

    try {
        await client.connect();
        console.log('✅ Connected to database\n');

        for (const file of EXTRAS) {
            const filePath = join(import.meta.dirname, '..', 'prisma', 'migrations', file);
            const sql = readFileSync(filePath, 'utf-8');

            console.log(`▸ Running ${file}...`);
            await client.query(sql);
            console.log(`  ✓ ${file} applied\n`);
        }

        console.log('✅ All database extras applied successfully');
    } catch (err) {
        console.error('❌ Database extras failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
