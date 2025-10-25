import { eq } from 'drizzle-orm';
import { db, users, addressBook, dailySpending, auditLogs } from '../db';
import { randomUUID } from 'crypto';
import { User } from '../types';

export class UserService {
  /**
   * Get or create user by phone number
   */
  async getOrCreateUser(phoneNumber: string): Promise<User> {
    const existing = await db.query.users.findFirst({
      where: eq(users.phoneNumber, phoneNumber),
    });

    if (existing) {
      return existing as User;
    }

    const now = new Date();
    const newUser: User = {
      id: randomUUID(),
      phoneNumber,
      walletAddress: undefined,
      wcSessionTopic: undefined,
      litPkpPublicKey: undefined,
      dailyLimit: 100,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);

    return newUser;
  }

  /**
   * Link wallet to user
   */
  async linkWallet(
    userId: string,
    walletAddress: string,
    wcSessionTopic?: string,
    litPkpPublicKey?: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        walletAddress,
        wcSessionTopic,
        litPkpPublicKey,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Update user's daily limit
   */
  async setDailyLimit(userId: string, limit: number): Promise<void> {
    await db
      .update(users)
      .set({
        dailyLimit: limit,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Lock or unlock user account
   */
  async setLockStatus(userId: string, isLocked: boolean): Promise<void> {
    await db
      .update(users)
      .set({
        isLocked,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Update user fields
   */
  async updateUser(userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> {
    await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user ? (user as User) : null;
  }

  /**
   * Get user by phone number
   */
  async getUserByPhone(phoneNumber: string): Promise<User | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.phoneNumber, phoneNumber),
    });
    return user ? (user as User) : null;
  }

  /**
   * Add address to user's address book
   */
  async addToAddressBook(
    userId: string,
    alias: string,
    address: string,
    phoneNumber?: string
  ): Promise<void> {
    await db.insert(addressBook).values({
      id: randomUUID(),
      userId,
      alias: alias.toLowerCase(),
      address,
      phoneNumber,
      createdAt: new Date(),
    });
  }

  /**
   * Resolve recipient (alias, phone, or address) to Ethereum address
   */
  async resolveRecipient(userId: string, recipient: string): Promise<string | null> {
    // If it's already an address, return it
    if (recipient.startsWith('0x') && recipient.length === 42) {
      return recipient;
    }

    // Remove @ prefix if present
    const cleanRecipient = recipient.startsWith('@') ? recipient.slice(1) : recipient;

    // Try to find in address book
    const entry = await db.query.addressBook.findFirst({
      where: (addressBook, { and, eq, or }) =>
        and(
          eq(addressBook.userId, userId),
          or(
            eq(addressBook.alias, cleanRecipient.toLowerCase()),
            eq(addressBook.phoneNumber, cleanRecipient)
          )
        ),
    });

    return entry?.address || null;
  }

  /**
   * Get user's address book
   */
  async getAddressBook(userId: string) {
    return db.query.addressBook.findMany({
      where: eq(addressBook.userId, userId),
    });
  }

  /**
   * Check if user has exceeded daily limit
   */
  async checkDailyLimit(userId: string, amountUsd: number): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const today = new Date().toISOString().split('T')[0];

    const spending = await db.query.dailySpending.findMany({
      where: (dailySpending, { and, eq }) =>
        and(eq(dailySpending.userId, userId), eq(dailySpending.date, today)),
    });

    const totalSpent = spending.reduce((sum, s) => sum + s.amountUsd, 0);
    return totalSpent + amountUsd <= user.dailyLimit;
  }

  /**
   * Record spending for daily limit tracking
   */
  async recordSpending(userId: string, token: string, amountUsd: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    await db.insert(dailySpending).values({
      id: randomUUID(),
      userId,
      date: today,
      token,
      amountUsd,
      createdAt: new Date(),
    });
  }

  /**
   * Log audit event
   */
  async logAudit(
    userId: string | null,
    action: string,
    details?: any,
    twilioMessageSid?: string,
    ipAddress?: string
  ): Promise<void> {
    await db.insert(auditLogs).values({
      id: randomUUID(),
      userId,
      action,
      details: details ? JSON.stringify(details) : null,
      twilioMessageSid,
      ipAddress,
      createdAt: new Date(),
    });
  }
}

export const userService = new UserService();
