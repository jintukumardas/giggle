import { eq, desc } from 'drizzle-orm';
import { db, transactions } from '../db';
import { randomUUID } from 'crypto';
import { Transaction, TransactionType, TransactionStatus, TokenType } from '../types';

export class TransactionService {
  /**
   * Create a new transaction record
   */
  async createTransaction(
    userId: string,
    type: TransactionType,
    token: TokenType,
    amount: string,
    recipient?: string,
    sender?: string
  ): Promise<Transaction> {
    const now = new Date();
    const tx: Transaction = {
      id: randomUUID(),
      userId,
      txHash: undefined,
      type,
      token,
      amount,
      recipient,
      sender,
      status: 'pending',
      blockNumber: undefined,
      gasUsed: undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(transactions).values({
      ...tx,
      createdAt: now,
      updatedAt: now,
    });

    return tx;
  }

  /**
   * Update transaction with hash
   */
  async updateTransactionHash(id: string, txHash: string): Promise<void> {
    await db
      .update(transactions)
      .set({
        txHash,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    id: string,
    status: TransactionStatus,
    blockNumber?: number,
    gasUsed?: string
  ): Promise<void> {
    await db
      .update(transactions)
      .set({
        status,
        blockNumber,
        gasUsed,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction | null> {
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    return tx ? (tx as Transaction) : null;
  }

  /**
   * Get transaction by hash
   */
  async getTransactionByHash(txHash: string): Promise<Transaction | null> {
    const tx = await db.query.transactions.findFirst({
      where: eq(transactions.txHash, txHash),
    });
    return tx ? (tx as Transaction) : null;
  }

  /**
   * Get user's transaction history
   */
  async getUserTransactions(userId: string, limit: number = 10): Promise<Transaction[]> {
    const txs = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.createdAt)],
      limit,
    });
    return txs as Transaction[];
  }

  /**
   * Get pending transactions for a user
   */
  async getPendingTransactions(userId: string): Promise<Transaction[]> {
    const txs = await db.query.transactions.findMany({
      where: (transactions, { and, eq }) =>
        and(eq(transactions.userId, userId), eq(transactions.status, 'pending')),
      orderBy: [desc(transactions.createdAt)],
    });
    return txs as Transaction[];
  }

  /**
   * Format transaction for display
   */
  formatTransaction(tx: Transaction): string {
    const emoji = tx.type === 'send' ? '📤' : tx.type === 'receive' ? '📥' : '💳';
    const status = tx.status === 'confirmed' ? '✅' : tx.status === 'failed' ? '❌' : '⏳';
    const direction = tx.type === 'send' ? 'to' : 'from';
    const peer = tx.type === 'send' ? tx.recipient : tx.sender;

    return `${emoji} ${status} ${tx.amount} ${tx.token} ${direction} ${peer || 'unknown'}`;
  }
}

export const transactionService = new TransactionService();
