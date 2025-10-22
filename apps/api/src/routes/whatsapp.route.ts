import { Router, Request, Response } from 'express';
import { MessagingResponse } from 'twilio/lib/twiml/MessagingResponse';
import { parseCommand, normalizeRecipient } from '../utils/parser';
import { userService } from '../services/user.service';
import { transactionService } from '../services/transaction.service';
import { messagingService } from '../services/messaging.service';
import { getTokenBalance, getTokenAddress, formatAddress } from '../utils/crypto';
import { config } from '../config';
import { TwilioWebhookPayload } from '../types';

const router = Router();

/**
 * Main WhatsApp webhook - handles incoming messages
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const payload: TwilioWebhookPayload = req.body;
    const { From, Body, MessageSid } = payload;

    // Extract phone number (remove 'whatsapp:' prefix)
    const phoneNumber = From.replace('whatsapp:', '');

    // Get or create user
    const user = await userService.getOrCreateUser(phoneNumber);

    // Log the interaction
    await userService.logAudit(user.id, 'message_received', { body: Body }, MessageSid);

    // Parse the command
    const command = parseCommand(Body);

    const twiml = new MessagingResponse();

    if (!command) {
      twiml.message(
        "I didn't understand that command. Send `/help` to see available commands."
      );
      res.type('text/xml').send(twiml.toString());
      return;
    }

    // Handle different command types
    switch (command.type) {
      case 'help':
        twiml.message(messagingService.getHelpMessage());
        break;

      case 'link':
        await handleLinkCommand(user.id, phoneNumber, twiml);
        break;

      case 'balance':
        await handleBalanceCommand(user, twiml);
        break;

      case 'history':
        await handleHistoryCommand(user.id, command.limit, twiml);
        break;

      case 'send':
        await handleSendCommand(user, command, twiml);
        break;

      case 'request':
        await handleRequestCommand(user, command, twiml);
        break;

      case 'schedule':
        await handleScheduleCommand(user, command, twiml);
        break;

      case 'setLimit':
        await handleSetLimitCommand(user.id, command, twiml);
        break;

      case 'lock':
        await userService.setLockStatus(user.id, true);
        twiml.message('🔒 Account locked. No outgoing transfers allowed until you unlock.');
        break;

      case 'unlock':
        await userService.setLockStatus(user.id, false);
        twiml.message('🔓 Account unlocked. You can now send transfers.');
        break;

      default:
        twiml.message('Command not implemented yet. Send `/help` for available commands.');
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error);
    const twiml = new MessagingResponse();
    twiml.message(messagingService.formatErrorMessage('An error occurred. Please try again later.'));
    res.type('text/xml').send(twiml.toString());
  }
});

/**
 * Handle /link command
 */
async function handleLinkCommand(
  userId: string,
  phoneNumber: string,
  twiml: MessagingResponse
): Promise<void> {
  const qrUrl = `${config.baseUrl}/deeplink/${userId}`;

  twiml.message(
    `🔗 *Link Your Wallet*\n\n` +
    `Scan the QR code to connect your wallet:\n${qrUrl}\n\n` +
    `Or open this link on your phone:\n` +
    `(WalletConnect link will be generated when you visit the page)`
  );
}

/**
 * Handle balance command
 */
async function handleBalanceCommand(user: any, twiml: MessagingResponse): Promise<void> {
  if (!user.walletAddress) {
    twiml.message(
      '⚠️ No wallet linked. Send `/link` to connect your wallet first.'
    );
    return;
  }

  try {
    const [pyusdBalance, usdcBalance] = await Promise.all([
      getTokenBalance(getTokenAddress('pyusd'), user.walletAddress),
      getTokenBalance(getTokenAddress('usdc'), user.walletAddress),
    ]);

    const balances = [
      { token: 'PYUSD', amount: pyusdBalance.formatted },
      { token: 'USDC', amount: usdcBalance.formatted },
    ];

    twiml.message(messagingService.formatBalanceMessage(balances));
  } catch (error) {
    console.error('Error fetching balance:', error);
    twiml.message(messagingService.formatErrorMessage('Failed to fetch balance. Please try again.'));
  }
}

/**
 * Handle history command
 */
async function handleHistoryCommand(
  userId: string,
  limit: number,
  twiml: MessagingResponse
): Promise<void> {
  try {
    const txs = await transactionService.getUserTransactions(userId, limit);

    if (txs.length === 0) {
      twiml.message('📊 No transactions yet.');
      return;
    }

    let message = `📊 *Recent Transactions (${txs.length}):*\n\n`;
    txs.forEach((tx, index) => {
      message += `${index + 1}. ${transactionService.formatTransaction(tx)}\n`;
    });

    twiml.message(message);
  } catch (error) {
    console.error('Error fetching history:', error);
    twiml.message(messagingService.formatErrorMessage('Failed to fetch history. Please try again.'));
  }
}

/**
 * Handle send command
 */
async function handleSendCommand(user: any, command: any, twiml: MessagingResponse): Promise<void> {
  // Check if wallet is linked
  if (!user.walletAddress) {
    twiml.message('⚠️ No wallet linked. Send `/link` to connect your wallet first.');
    return;
  }

  // Check if account is locked
  if (user.isLocked) {
    twiml.message('🔒 Account is locked. Send `/unlock` to enable transfers.');
    return;
  }

  try {
    // Normalize recipient
    const normalized = normalizeRecipient(command.recipient);
    let recipientAddress: string | null = null;

    if (normalized.type === 'address') {
      recipientAddress = normalized.value;
    } else if (normalized.type === 'alias' || normalized.type === 'phone') {
      recipientAddress = await userService.resolveRecipient(user.id, normalized.value);
    }

    if (!recipientAddress) {
      twiml.message(
        `❌ Could not resolve recipient "${command.recipient}". ` +
        `Make sure they're in your address book or use their Ethereum address.`
      );
      return;
    }

    // Check daily limit (assuming 1:1 USD for stablecoins)
    const amountUsd = parseFloat(command.amount);
    const withinLimit = await userService.checkDailyLimit(user.id, amountUsd);

    if (!withinLimit) {
      twiml.message(
        `❌ Daily limit exceeded. Your current limit is $${user.dailyLimit}/day. ` +
        `Send \`set limit <amount>/day\` to increase it.`
      );
      return;
    }

    // Create transaction record
    const tx = await transactionService.createTransaction(
      user.id,
      'send',
      command.token.toUpperCase(),
      command.amount,
      recipientAddress
    );

    // Record spending
    await userService.recordSpending(user.id, command.token.toUpperCase(), amountUsd);

    // Send approval request
    twiml.message(
      `📤 *Send ${command.amount} ${command.token.toUpperCase()}*\n\n` +
      `To: ${formatAddress(recipientAddress)}\n\n` +
      `⚠️ Please approve this transaction in your wallet.\n\n` +
      `Transaction ID: ${tx.id.slice(0, 8)}`
    );

    // Note: In a real implementation, this would trigger a WalletConnect request
    // or use Lit Protocol for delegated signing
  } catch (error) {
    console.error('Error handling send command:', error);
    twiml.message(messagingService.formatErrorMessage('Failed to process send. Please try again.'));
  }
}

/**
 * Handle request command
 */
async function handleRequestCommand(user: any, command: any, twiml: MessagingResponse): Promise<void> {
  if (!user.walletAddress) {
    twiml.message('⚠️ No wallet linked. Send `/link` to connect your wallet first.');
    return;
  }

  // Create a payment request
  const tx = await transactionService.createTransaction(
    user.id,
    'request',
    command.token.toUpperCase(),
    command.amount,
    undefined,
    command.from
  );

  twiml.message(
    `💳 *Payment Request Created*\n\n` +
    `Amount: ${command.amount} ${command.token.toUpperCase()}\n` +
    `From: ${command.from}\n\n` +
    `Request ID: ${tx.id.slice(0, 8)}\n\n` +
    `(Payment request feature coming soon)`
  );
}

/**
 * Handle schedule command
 */
async function handleScheduleCommand(user: any, command: any, twiml: MessagingResponse): Promise<void> {
  if (!user.walletAddress) {
    twiml.message('⚠️ No wallet linked. Send `/link` to connect your wallet first.');
    return;
  }

  // Normalize recipient
  const normalized = normalizeRecipient(command.recipient);
  let recipientAddress: string | null = null;

  if (normalized.type === 'address') {
    recipientAddress = normalized.value;
  } else {
    recipientAddress = await userService.resolveRecipient(user.id, normalized.value);
  }

  if (!recipientAddress) {
    twiml.message(`❌ Could not resolve recipient "${command.recipient}".`);
    return;
  }

  twiml.message(
    `📅 *Payment Scheduled*\n\n` +
    `Amount: ${command.amount} ${command.token.toUpperCase()}\n` +
    `To: ${formatAddress(recipientAddress)}\n` +
    `When: ${command.scheduledFor.toLocaleString()}\n\n` +
    `You'll receive a reminder when it's time to approve the payment.\n\n` +
    `(Scheduling with Lit Protocol coming soon)`
  );
}

/**
 * Handle set limit command
 */
async function handleSetLimitCommand(userId: string, command: any, twiml: MessagingResponse): Promise<void> {
  if (command.period !== 'day') {
    twiml.message('⚠️ Only daily limits are supported at this time. Use `set limit <amount>/day`');
    return;
  }

  if (command.amount > config.limits.maxDailyLimit) {
    twiml.message(
      `❌ Maximum daily limit is $${config.limits.maxDailyLimit}. ` +
      `Contact support for higher limits.`
    );
    return;
  }

  await userService.setDailyLimit(userId, command.amount);

  twiml.message(
    `✅ *Daily limit updated*\n\nNew limit: $${command.amount}/day`
  );
}

export default router;
