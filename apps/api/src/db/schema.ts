import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  phoneNumber: text('phone_number').notNull().unique(),
  walletAddress: text('wallet_address'),
  wcSessionTopic: text('wc_session_topic'),
  litPkpPublicKey: text('lit_pkp_public_key'),
  dailyLimit: real('daily_limit').default(100),
  isLocked: integer('is_locked', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const addressBook = sqliteTable('address_book', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  alias: text('alias').notNull(),
  address: text('address').notNull(),
  phoneNumber: text('phone_number'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  txHash: text('tx_hash'),
  type: text('type').notNull(), // 'send' | 'receive' | 'request'
  token: text('token').notNull(), // 'PYUSD' | 'USDC'
  amount: text('amount').notNull(), // stored as string to avoid precision loss
  recipient: text('recipient'),
  sender: text('sender'),
  status: text('status').notNull(), // 'pending' | 'confirmed' | 'failed'
  blockNumber: integer('block_number'),
  gasUsed: text('gas_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const pendingIntents = sqliteTable('pending_intents', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  intentType: text('intent_type').notNull(), // 'send' | 'schedule'
  token: text('token').notNull(),
  amount: text('amount').notNull(),
  recipient: text('recipient').notNull(),
  scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
  status: text('status').notNull(), // 'pending' | 'approved' | 'executed' | 'cancelled'
  litActionIpfsCid: text('lit_action_ipfs_cid'),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const dailySpending = sqliteTable('daily_spending', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  date: text('date').notNull(), // YYYY-MM-DD
  token: text('token').notNull(),
  amountUsd: real('amount_usd').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: text('details'), // JSON string
  twilioMessageSid: text('twilio_message_sid'),
  ipAddress: text('ip_address'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  addressBook: many(addressBook),
  transactions: many(transactions),
  pendingIntents: many(pendingIntents),
  dailySpending: many(dailySpending),
  auditLogs: many(auditLogs),
}));

export const addressBookRelations = relations(addressBook, ({ one }) => ({
  user: one(users, {
    fields: [addressBook.userId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const pendingIntentsRelations = relations(pendingIntents, ({ one }) => ({
  user: one(users, {
    fields: [pendingIntents.userId],
    references: [users.id],
  }),
}));

export const dailySpendingRelations = relations(dailySpending, ({ one }) => ({
  user: one(users, {
    fields: [dailySpending.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
