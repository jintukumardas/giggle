#!/usr/bin/env tsx
/**
 * Database migration script
 * Creates tables and indexes for the Giggle application
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_URL || './data/giggle.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`✅ Created directory: ${dbDir}`);
}

const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

console.log('🔄 Running migrations...');

// Run migrations
try {
  // Since we're not using drizzle-kit generate for this demo,
  // we'll create tables manually using SQL

  // Users table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL UNIQUE,
      wallet_address TEXT,
      wc_session_topic TEXT,
      lit_pkp_public_key TEXT,
      daily_limit REAL DEFAULT 100,
      is_locked INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Address book table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS address_book (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      alias TEXT NOT NULL,
      address TEXT NOT NULL,
      phone_number TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Transactions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      tx_hash TEXT,
      type TEXT NOT NULL,
      token TEXT NOT NULL,
      amount TEXT NOT NULL,
      recipient TEXT,
      sender TEXT,
      status TEXT NOT NULL,
      block_number INTEGER,
      gas_used TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Pending intents table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pending_intents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      intent_type TEXT NOT NULL,
      token TEXT NOT NULL,
      amount TEXT NOT NULL,
      recipient TEXT NOT NULL,
      scheduled_for INTEGER,
      status TEXT NOT NULL,
      lit_action_ipfs_cid TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Daily spending table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS daily_spending (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      token TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Audit logs table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      twilio_message_sid TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // Create indexes
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
    CREATE INDEX IF NOT EXISTS idx_address_book_user ON address_book(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(tx_hash);
    CREATE INDEX IF NOT EXISTS idx_pending_intents_user ON pending_intents(user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_intents_scheduled ON pending_intents(scheduled_for);
    CREATE INDEX IF NOT EXISTS idx_daily_spending_user_date ON daily_spending(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  `);

  console.log('✅ Migrations completed successfully');

  // Show database info
  const tables = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  ).all();

  console.log('\n📊 Database tables:');
  tables.forEach((table: any) => {
    console.log(`  - ${table.name}`);
  });

  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
