#!/usr/bin/env tsx
/**
 * Migration: Add pin_hash column to users table
 */
import Database from 'better-sqlite3';
import { resolve } from 'path';

const dbPath = resolve(__dirname, '../../data/giggle.db');
console.log(`Migrating database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if column already exists
  const tableInfo = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  const columnExists = tableInfo.some((col) => col.name === 'pin_hash');

  if (columnExists) {
    console.log('✓ Column pin_hash already exists, skipping migration');
  } else {
    console.log('Adding pin_hash column to users table...');

    // Add the pin_hash column
    db.exec(`
      ALTER TABLE users ADD COLUMN pin_hash TEXT;
    `);

    console.log('✓ Successfully added pin_hash column');
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
