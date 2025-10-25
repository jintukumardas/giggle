import { randomUUID } from 'crypto';

/**
 * In-memory storage for pending transactions awaiting confirmation
 * In production, you'd want to use Redis or a database
 */
interface PendingTransaction {
  id: string;
  userId: string;
  phoneNumber: string;
  type: 'send' | 'request';
  amount: string;
  recipient: string;
  recipientPhone: string;
  currency: 'PYUSD';
  pin?: string; // User-provided PIN for this transaction
  createdAt: Date;
  expiresAt: Date;
}

class PendingTransactionService {
  private pendingTransactions: Map<string, PendingTransaction> = new Map();
  private userPendingTx: Map<string, string> = new Map(); // userId -> txId

  /**
   * Create a pending transaction that needs confirmation
   */
  createPendingTransaction(params: {
    userId: string;
    phoneNumber: string;
    type: 'send' | 'request';
    amount: string;
    recipient: string;
    recipientPhone: string;
  }): PendingTransaction {
    // Cancel any existing pending transaction for this user
    this.cancelPendingTransaction(params.userId);

    const txId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    const pendingTx: PendingTransaction = {
      id: txId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      type: params.type,
      amount: params.amount,
      recipient: params.recipient,
      recipientPhone: params.recipientPhone,
      currency: 'PYUSD',
      createdAt: now,
      expiresAt,
    };

    this.pendingTransactions.set(txId, pendingTx);
    this.userPendingTx.set(params.userId, txId);

    // Auto-expire after 5 minutes
    setTimeout(() => {
      this.cancelPendingTransaction(params.userId);
    }, 5 * 60 * 1000);

    return pendingTx;
  }

  /**
   * Get pending transaction for a user
   */
  getPendingTransaction(userId: string): PendingTransaction | null {
    const txId = this.userPendingTx.get(userId);
    if (!txId) return null;

    const tx = this.pendingTransactions.get(txId);
    if (!tx) return null;

    // Check if expired
    if (new Date() > tx.expiresAt) {
      this.cancelPendingTransaction(userId);
      return null;
    }

    return tx;
  }

  /**
   * Confirm and retrieve a pending transaction (with PIN if provided)
   */
  confirmPendingTransaction(userId: string, pin?: string): PendingTransaction | null {
    const tx = this.getPendingTransaction(userId);
    if (!tx) return null;

    // If PIN provided, store it in the transaction
    if (pin) {
      tx.pin = pin;
    }

    // Remove from pending
    this.pendingTransactions.delete(tx.id);
    this.userPendingTx.delete(userId);

    return tx;
  }

  /**
   * Cancel a pending transaction
   */
  cancelPendingTransaction(userId: string): boolean {
    const txId = this.userPendingTx.get(userId);
    if (!txId) return false;

    this.pendingTransactions.delete(txId);
    this.userPendingTx.delete(userId);

    return true;
  }

  /**
   * Check if user has a pending transaction
   */
  hasPendingTransaction(userId: string): boolean {
    return this.getPendingTransaction(userId) !== null;
  }
}

export const pendingTransactionService = new PendingTransactionService();
