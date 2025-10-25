import { z } from 'zod';

// Command Schemas
export const LinkCommandSchema = z.object({
  type: z.literal('link'),
});

export const SendCommandSchema = z.object({
  type: z.literal('send'),
  amount: z.string(),
  token: z.enum(['pyusd', 'usdc']),
  recipient: z.string(),
});

export const RequestCommandSchema = z.object({
  type: z.literal('request'),
  amount: z.string(),
  token: z.enum(['pyusd', 'usdc']),
  from: z.string(),
});

export const BalanceCommandSchema = z.object({
  type: z.literal('balance'),
});

export const HistoryCommandSchema = z.object({
  type: z.literal('history'),
  limit: z.number().optional().default(10),
});

export const ScheduleCommandSchema = z.object({
  type: z.literal('schedule'),
  amount: z.string(),
  token: z.enum(['pyusd', 'usdc']),
  recipient: z.string(),
  scheduledFor: z.date(),
});

export const SetLimitCommandSchema = z.object({
  type: z.literal('setLimit'),
  amount: z.number(),
  period: z.enum(['day', 'week', 'month']),
});

export const LockCommandSchema = z.object({
  type: z.literal('lock'),
});

export const UnlockCommandSchema = z.object({
  type: z.literal('unlock'),
});

export const HelpCommandSchema = z.object({
  type: z.literal('help'),
});

export const CommandSchema = z.discriminatedUnion('type', [
  LinkCommandSchema,
  SendCommandSchema,
  RequestCommandSchema,
  BalanceCommandSchema,
  HistoryCommandSchema,
  ScheduleCommandSchema,
  SetLimitCommandSchema,
  LockCommandSchema,
  UnlockCommandSchema,
  HelpCommandSchema,
]);

export type Command = z.infer<typeof CommandSchema>;
export type LinkCommand = z.infer<typeof LinkCommandSchema>;
export type SendCommand = z.infer<typeof SendCommandSchema>;
export type RequestCommand = z.infer<typeof RequestCommandSchema>;
export type BalanceCommand = z.infer<typeof BalanceCommandSchema>;
export type HistoryCommand = z.infer<typeof HistoryCommandSchema>;
export type ScheduleCommand = z.infer<typeof ScheduleCommandSchema>;
export type SetLimitCommand = z.infer<typeof SetLimitCommandSchema>;
export type LockCommand = z.infer<typeof LockCommandSchema>;
export type UnlockCommand = z.infer<typeof UnlockCommandSchema>;
export type HelpCommand = z.infer<typeof HelpCommandSchema>;

// User types
export interface User {
  id: string;
  phoneNumber: string;
  walletAddress?: string;
  pinHash?: string;
  wcSessionTopic?: string;
  litPkpPublicKey?: string;
  dailyLimit: number;
  isLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Transaction types
export type TransactionType = 'send' | 'receive' | 'request';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';
export type TokenType = 'PYUSD' | 'USDC';

export interface Transaction {
  id: string;
  userId: string;
  txHash?: string;
  type: TransactionType;
  token: TokenType;
  amount: string;
  recipient?: string;
  sender?: string;
  status: TransactionStatus;
  blockNumber?: number;
  gasUsed?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Intent types
export type IntentStatus = 'pending' | 'approved' | 'executed' | 'cancelled';

export interface PendingIntent {
  id: string;
  userId: string;
  intentType: 'send' | 'schedule';
  token: TokenType;
  amount: string;
  recipient: string;
  scheduledFor?: Date;
  status: IntentStatus;
  litActionIpfsCid?: string;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Webhook types
export interface TwilioWebhookPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
}

export interface TwilioStatusCallback {
  MessageSid: string;
  MessageStatus: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';
  ErrorCode?: string;
  ErrorMessage?: string;
}

// Config types
export interface AppConfig {
  port: number;
  nodeEnv: string;
  baseUrl: string;
  twilio: {
    accountSid: string;
    authToken: string;
    whatsappNumber: string;
    verifySignatures: boolean;
  };
  blockchain: {
    chainId: number;
    rpcUrl: string;
    chainName: string;
    pyusdAddress: string;
    usdcAddress: string;
  };
  blockscout: {
    apiUrl: string;
  };
  pyth: {
    endpoint: string;
  };
  walletConnect: {
    projectId: string;
  };
  lit: {
    network: string;
  };
  security: {
    encryptionKey: string;
    jwtSecret: string;
  };
  limits: {
    defaultDailyLimit: number;
    maxDailyLimit: number;
  };
  openai: {
    apiKey: string;
  };
}
