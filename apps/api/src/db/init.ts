#!/usr/bin/env tsx
/**
 * Database Initialization Script
 * Creates all tables if they don't exist
 */
import Database from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbPath = resolve(__dirname, '../../data/giggle.db');
const dbDir = resolve(__dirname, '../../data');

console.log('🗄️  Database Initialization');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📍 Database path: ${dbPath}`);

// Ensure data directory exists
if (!existsSync(dbDir)) {
  console.log('📁 Creating data directory...');
  mkdirSync(dbDir, { recursive: true });
  console.log('✓ Data directory created');
}

// Check if database file exists
const dbExists = existsSync(dbPath);
console.log(`📊 Database exists: ${dbExists ? 'Yes' : 'No'}`);

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

try {
  console.log('\n📋 Creating tables...\n');

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL UNIQUE,
      wallet_address TEXT,
      pin_hash TEXT,
      wc_session_topic TEXT,
      lit_pkp_public_key TEXT,
      daily_limit REAL DEFAULT 100,
      is_locked INTEGER DEFAULT 0,
      onboarding_completed INTEGER DEFAULT 0,
      onboarding_step TEXT DEFAULT 'welcome',
      default_network TEXT DEFAULT 'sepolia',
      default_token TEXT DEFAULT 'PYUSD',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  console.log('✓ users table created');

  // Create address_book table
  db.exec(`
    CREATE TABLE IF NOT EXISTS address_book (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      alias TEXT NOT NULL,
      address TEXT NOT NULL,
      phone_number TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  console.log('✓ address_book table created');

  // Create transactions table
  db.exec(`
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
    );
  `);
  console.log('✓ transactions table created');

  // Create pending_intents table
  db.exec(`
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
    );
  `);
  console.log('✓ pending_intents table created');

  // Create daily_spending table
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_spending (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      token TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  console.log('✓ daily_spending table created');

  // Create audit_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      details TEXT,
      twilio_message_sid TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  console.log('✓ audit_logs table created');

  // Create gift_coupons table
  db.exec(`
    CREATE TABLE IF NOT EXISTS gift_coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      creator_id TEXT NOT NULL REFERENCES users(id),
      amount TEXT NOT NULL,
      token TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL,
      redeemed_by TEXT REFERENCES users(id),
      redeemed_at INTEGER,
      expires_at INTEGER,
      tx_hash TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  console.log('✓ gift_coupons table created');

  // Verify all tables
  console.log('\n📊 Verifying tables...\n');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all() as Array<{ name: string }>;

  console.log('Tables found:');
  tables.forEach((table) => {
    if (table.name !== 'sqlite_sequence') {
      console.log(`  - ${table.name}`);
    }
  });

  // Check users table structure
  const usersColumns = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  console.log('\n👤 Users table columns:');
  usersColumns.forEach((col) => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database initialization completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (error) {
  console.error('\n❌ Database initialization failed:', error);
  process.exit(1);
} finally {
  db.close();
}
