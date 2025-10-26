#!/usr/bin/env tsx
/**
 * Migration: Add onboarding fields to users table
 * - onboarding_completed (boolean, default false)
 * - onboarding_step (text, default 'welcome')
 * - default_network (text, default 'sepolia')
 * - default_token (text, default 'PYUSD')
 */
import Database from 'better-sqlite3';
import { resolve } from 'path';

const dbPath = resolve(__dirname, '../../data/giggle.db');
console.log(`Migrating database at: ${dbPath}`);

const db = new Database(dbPath);

const migrations = [
  {
    name: 'onboarding_completed',
    sql: `ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;`
  },
  {
    name: 'onboarding_step',
    sql: `ALTER TABLE users ADD COLUMN onboarding_step TEXT DEFAULT 'welcome';`
  },
  {
    name: 'default_network',
    sql: `ALTER TABLE users ADD COLUMN default_network TEXT DEFAULT 'sepolia';`
  },
  {
    name: 'default_token',
    sql: `ALTER TABLE users ADD COLUMN default_token TEXT DEFAULT 'PYUSD';`
  }
];

try {
  // Get current table structure
  const tableInfo = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  const existingColumns = new Set(tableInfo.map(col => col.name));

  // Run migrations
  for (const migration of migrations) {
    if (existingColumns.has(migration.name)) {
      console.log(`✓ Column ${migration.name} already exists, skipping`);
    } else {
      console.log(`Adding ${migration.name} column...`);
      db.exec(migration.sql);
      console.log(`✓ Successfully added ${migration.name} column`);
    }
  }

  // Verify the migration
  const updatedTableInfo = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  console.log('\nUsers table structure:');
  updatedTableInfo.forEach((col) => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  console.log('\n✓ Migration completed successfully!');
} catch (error) {
  console.error('✗ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
