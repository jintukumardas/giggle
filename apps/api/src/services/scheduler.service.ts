import cron from 'node-cron';
import { eq, and, lte } from 'drizzle-orm';
import { db, pendingIntents } from '../db';
import { messagingService } from './messaging.service';
import { litService } from './lit.service';

/**
 * Scheduler service for handling scheduled payments
 */
export class SchedulerService {
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    console.log('📅 Starting scheduler service...');

    // Check for pending scheduled transactions every minute
    cron.schedule('* * * * *', async () => {
      await this.processScheduledIntents();
    });

    console.log('✅ Scheduler service started');
  }

  /**
   * Process scheduled intents that are due
   */
  private async processScheduledIntents(): Promise<void> {
    try {
      const now = new Date();

      // Find all pending scheduled intents that are due
      const dueIntents = await db.query.pendingIntents.findMany({
        where: (pendingIntents, { and, eq, lte }) =>
          and(
            eq(pendingIntents.status, 'pending'),
            eq(pendingIntents.intentType, 'schedule'),
            lte(pendingIntents.scheduledFor, now)
          ),
      });

      for (const intent of dueIntents) {
        await this.processIntent(intent);
      }
    } catch (error) {
      console.error('Error processing scheduled intents:', error);
    }
  }

  /**
   * Process a single scheduled intent
   */
  private async processIntent(intent: any): Promise<void> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, intent.userId),
      });

      if (!user) {
        console.error(`User not found for intent ${intent.id}`);
        return;
      }

      // If user has Lit delegation set up, execute automatically
      if (intent.litActionIpfsCid && user.litPkpPublicKey) {
        await this.executeWithLit(intent, user);
      } else {
        // Otherwise, send a reminder to approve manually
        await this.sendReminder(intent, user);
      }
    } catch (error) {
      console.error(`Error processing intent ${intent.id}:`, error);
    }
  }

  /**
   * Execute payment using Lit Protocol delegation
   */
  private async executeWithLit(intent: any, user: any): Promise<void> {
    try {
      // Execute the delegated transaction
      const result = await litService.executeDelegatedTransaction({
        delegationId: intent.id,
        ipfsCid: intent.litActionIpfsCid,
        txParams: {
          to: intent.recipient,
          amount: intent.amount,
          recipient: intent.recipient,
        },
      });

      if (result.approved) {
        // Update intent status
        await db
          .update(pendingIntents)
          .set({
            status: 'executed',
            updatedAt: new Date(),
          })
          .where(eq(pendingIntents.id, intent.id));

        // Send confirmation
        await messagingService.sendWhatsAppMessage(
          user.phoneNumber.replace('whatsapp:', ''),
          `✅ Scheduled payment executed!\n\n` +
          `Amount: ${intent.amount} ${intent.token}\n` +
          `To: ${intent.recipient}\n\n` +
          `Transaction will be confirmed on-chain shortly.`
        );
      } else {
        // Delegation rejected the transaction
        await db
          .update(pendingIntents)
          .set({
            status: 'cancelled',
            metadata: JSON.stringify({ reason: result.reason }),
            updatedAt: new Date(),
          })
          .where(eq(pendingIntents.id, intent.id));

        await messagingService.sendWhatsAppMessage(
          user.phoneNumber.replace('whatsapp:', ''),
          `❌ Scheduled payment cancelled\n\n` +
          `Reason: ${result.reason}`
        );
      }
    } catch (error) {
      console.error('Error executing with Lit:', error);
      await this.sendReminder(intent, user);
    }
  }

  /**
   * Send reminder to user to approve manually
   */
  private async sendReminder(intent: any, user: any): Promise<void> {
    try {
      await messagingService.sendWhatsAppMessage(
        user.phoneNumber.replace('whatsapp:', ''),
        `⏰ Scheduled payment reminder!\n\n` +
        `Amount: ${intent.amount} ${intent.token}\n` +
        `To: ${intent.recipient}\n\n` +
        `Please approve this payment in your wallet to complete the transaction.`
      );

      // Update intent status to approved (waiting for user action)
      await db
        .update(pendingIntents)
        .set({
          status: 'approved',
          updatedAt: new Date(),
        })
        .where(eq(pendingIntents.id, intent.id));
    } catch (error) {
      console.error('Error sending reminder:', error);
    }
  }

  /**
   * Schedule a new intent
   */
  async scheduleIntent(
    userId: string,
    token: string,
    amount: string,
    recipient: string,
    scheduledFor: Date,
    litActionIpfsCid?: string
  ): Promise<string> {
    const intent = {
      id: `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId,
      intentType: 'schedule' as const,
      token,
      amount,
      recipient,
      scheduledFor,
      status: 'pending' as const,
      litActionIpfsCid,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(pendingIntents).values(intent);

    return intent.id;
  }

  /**
   * Cancel a scheduled intent
   */
  async cancelIntent(intentId: string): Promise<void> {
    await db
      .update(pendingIntents)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(pendingIntents.id, intentId));
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.tasks.forEach((task) => task.stop());
    this.tasks.clear();
    console.log('🛑 Scheduler service stopped');
  }
}

export const schedulerService = new SchedulerService();
