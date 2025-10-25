import { Router, Request, Response } from 'express';
import MessagingResponse = require('twilio/lib/twiml/MessagingResponse');
import { userService } from '../services/user.service';
import { messagingService } from '../services/messaging.service';
import { openaiService, SendIntent, RequestIntent, SetPinIntent } from '../services/openai.service';
import { walletService } from '../services/wallet.service';
import { pendingTransactionService } from '../services/pending-transaction.service';
import { transactionService } from '../services/transaction.service';
import { pinService } from '../services/pin.service';
import { TwilioWebhookPayload } from '../types';
import { parsePhoneNumber } from 'libphonenumber-js';

const router = Router();

/**
 * Main WhatsApp webhook - handles incoming messages with OpenAI intent detection
 */
router.post('/', async (req: Request, res: Response) => {
  const twiml = new MessagingResponse();

  try {
    const payload: TwilioWebhookPayload = req.body;
    const { From, Body, MessageSid } = payload;

    // Extract phone number (remove 'whatsapp:' prefix)
    const phoneNumber = From.replace('whatsapp:', '');

    // Get or create user
    const user = await userService.getOrCreateUser(phoneNumber);

    // Log the interaction
    await userService.logAudit(user.id, 'message_received', { body: Body }, MessageSid);

    // Parse user intent with OpenAI
    const intent = await openaiService.parseIntent(Body);

    console.log('Parsed intent:', intent);

    // Handle different intents
    switch (intent.type) {
      case 'help':
        await handleHelp(twiml, user.id);
        break;

      case 'balance':
        await handleBalance(user.id, phoneNumber, twiml);
        break;

      case 'account':
        await handleAccount(user.id, phoneNumber, twiml);
        break;

      case 'history':
        await handleHistory(user.id, twiml);
        break;

      case 'send':
        await handleSend(user.id, phoneNumber, intent, twiml);
        break;

      case 'request':
        await handleRequest(user.id, phoneNumber, intent, twiml);
        break;

      case 'confirm':
        await handleConfirm(user.id, phoneNumber, twiml);
        break;

      case 'cancel':
        await handleCancel(user.id, twiml);
        break;

      case 'setPin':
        await handleSetPin(user.id, intent, twiml);
        break;

      case 'unknown':
      default:
        // Check if user has pending transaction and message looks like a PIN
        const hasPending = pendingTransactionService.hasPendingTransaction(user.id);
        const looksLikePin = /^\d{4,6}$/.test(Body.trim());

        console.log('Unknown intent - checking for PIN entry:', {
          hasPending,
          looksLikePin,
          body: Body.trim(),
        });

        if (hasPending && looksLikePin) {
          console.log('Treating as PIN entry, calling handleConfirmWithPin');
          await handleConfirmWithPin(user.id, phoneNumber, Body.trim(), twiml);
        } else {
          twiml.message(
            `I didn't quite understand that. Try:\n` +
            `• "Send $10 to +1234567890"\n` +
            `• "What's my balance?"\n` +
            `• "Show my account"\n` +
            `• "Show transaction history"\n\n` +
            `Or say "help" for more info.`
          );
        }
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error);
    twiml.message(messagingService.formatErrorMessage('An error occurred. Please try again later.'));
    res.type('text/xml').send(twiml.toString());
  }
});

/**
 * Handle help request
 */
async function handleHelp(twiml: MessagingResponse, userId?: string): Promise<void> {
  let message = messagingService.getHelpMessage();

  // If user ID provided, check if they need to set up PIN
  if (userId) {
    const user = await userService.getUserById(userId);
    if (user && !user.pinHash) {
      message += `\n\n⚠️ *Important:* Set up your PIN to send transactions:\n"Set PIN 1234"`;
    }
  }

  twiml.message(message);
}

/**
 * Handle balance request
 */
async function handleBalance(
  userId: string,
  phoneNumber: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    const walletInfo = await walletService.getWalletInfo(userId, phoneNumber);

    let message = `💰 *Your Balances:*\n\n`;
    message += `• PYUSD: $${parseFloat(walletInfo.pyusdBalance).toFixed(2)}\n`;
    message += `• ETH: ${parseFloat(walletInfo.ethBalance).toFixed(4)} (gas)\n`;

    twiml.message(message);
  } catch (error) {
    console.error('Error getting balance:', error);
    twiml.message(messagingService.formatErrorMessage('Could not retrieve balance. Please try again.'));
  }
}

/**
 * Handle account info request
 */
async function handleAccount(
  userId: string,
  phoneNumber: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    const walletInfo = await walletService.getWalletInfo(userId, phoneNumber);
    const explorerUrl = walletService.getAddressExplorerUrl(walletInfo.address);

    twiml.message(
      messagingService.formatWalletInfo({
        address: walletInfo.address,
        formattedAddress: walletInfo.formattedAddress,
        pyusdBalance: walletInfo.pyusdBalance,
        ethBalance: walletInfo.ethBalance,
        explorerUrl,
      })
    );
  } catch (error) {
    console.error('Error getting account info:', error);
    twiml.message(messagingService.formatErrorMessage('Could not retrieve account info. Please try again.'));
  }
}

/**
 * Handle transaction history request
 */
async function handleHistory(
  userId: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    const transactions = await transactionService.getUserTransactions(userId, 10);

    twiml.message(
      messagingService.formatTransactionHistory(
        transactions,
        (txHash) => walletService.getTransactionExplorerUrl(txHash)
      )
    );
  } catch (error) {
    console.error('Error getting history:', error);
    twiml.message(messagingService.formatErrorMessage('Could not retrieve history. Please try again.'));
  }
}

/**
 * Handle send transaction request - creates pending transaction awaiting confirmation
 */
async function handleSend(
  userId: string,
  phoneNumber: string,
  intent: SendIntent,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Normalize recipient phone number
    const recipientPhone = normalizePhoneNumber(intent.recipient);
    if (!recipientPhone) {
      twiml.message(
        messagingService.formatErrorMessage(
          `Invalid phone number: ${intent.recipient}\n\n` +
          `Please use format: +1234567890 or (123) 456-7890`
        )
      );
      return;
    }

    // Check if user has PIN set up first
    const userDetails = await userService.getUserById(userId);
    const hasPinSetup = !!userDetails?.pinHash;

    if (!hasPinSetup) {
      // Prompt user to set up PIN first
      twiml.message(
        `🔐 *Security Setup Required*\n\n` +
        `For your security, please set up a PIN before sending transactions.\n\n` +
        `💡 *How to set up your PIN:*\n` +
        `Reply with: "Set PIN 1234"\n\n` +
        `Use a 4-6 digit PIN that you'll remember. You'll need it to confirm all transactions.\n\n` +
        `After setting your PIN, you can retry your transaction.`
      );
      return;
    }

    // Get recipient user (or create if doesn't exist)
    const recipientUser = await userService.getOrCreateUser(recipientPhone);

    // Get sender's wallet to check balance
    const { address } = await walletService.getOrCreateWallet(userId, phoneNumber);
    const balance = await walletService.getPYUSDBalance(address);

    // Check if sender has enough balance
    if (parseFloat(balance) < parseFloat(intent.amount)) {
      twiml.message(
        messagingService.formatInsufficientBalance(balance, intent.amount)
      );
      return;
    }

    // Create pending transaction
    pendingTransactionService.createPendingTransaction({
      userId,
      phoneNumber,
      type: 'send',
      amount: intent.amount,
      recipient: recipientUser.id,
      recipientPhone,
    });

    // Send confirmation request
    twiml.message(
      messagingService.formatTransactionConfirmationRequest({
        type: 'send',
        amount: intent.amount,
        recipientPhone,
        senderBalance: balance,
        requirePin: hasPinSetup,
      })
    );
  } catch (error) {
    console.error('Error handling send:', error);
    twiml.message(messagingService.formatErrorMessage('Could not process send request. Please try again.'));
  }
}

/**
 * Handle payment request
 */
async function handleRequest(
  userId: string,
  phoneNumber: string,
  intent: RequestIntent,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Normalize sender phone number
    const fromPhone = normalizePhoneNumber(intent.from);
    if (!fromPhone) {
      twiml.message(
        messagingService.formatErrorMessage(
          `Invalid phone number: ${intent.from}\n\n` +
          `Please use format: +1234567890 or (123) 456-7890`
        )
      );
      return;
    }

    // Get sender user
    const fromUser = await userService.getOrCreateUser(fromPhone);

    // Create pending transaction
    pendingTransactionService.createPendingTransaction({
      userId,
      phoneNumber,
      type: 'request',
      amount: intent.amount,
      recipient: fromUser.id,
      recipientPhone: fromPhone,
    });

    // Send confirmation request
    twiml.message(
      messagingService.formatTransactionConfirmationRequest({
        type: 'request',
        amount: intent.amount,
        recipientPhone: fromPhone,
        requirePin: false, // Requests don't need PIN
      })
    );
  } catch (error) {
    console.error('Error handling request:', error);
    twiml.message(messagingService.formatErrorMessage('Could not process request. Please try again.'));
  }
}

/**
 * Handle transaction confirmation
 */
async function handleConfirm(
  userId: string,
  phoneNumber: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Get pending transaction
    const pendingTx = pendingTransactionService.confirmPendingTransaction(userId);

    if (!pendingTx) {
      twiml.message(
        messagingService.formatInfoMessage(
          'No pending transaction to confirm.\n\n' +
          'Try sending a transaction first, like:\n' +
          '"Send $10 to +1234567890"'
        )
      );
      return;
    }

    if (pendingTx.type === 'send') {
      // Execute the send transaction
      await executeSendTransaction(userId, phoneNumber, pendingTx, twiml);
    } else if (pendingTx.type === 'request') {
      // Send payment request to the other user
      await executePaymentRequest(userId, phoneNumber, pendingTx, twiml);
    }
  } catch (error) {
    console.error('Error handling confirm:', error);
    twiml.message(messagingService.formatErrorMessage('Could not confirm transaction. Please try again.'));
  }
}

/**
 * Handle transaction cancellation
 */
async function handleCancel(
  userId: string,
  twiml: MessagingResponse
): Promise<void> {
  const cancelled = pendingTransactionService.cancelPendingTransaction(userId);

  if (cancelled) {
    twiml.message(messagingService.formatTransactionCancelled());
  } else {
    twiml.message(
      messagingService.formatInfoMessage('No pending transaction to cancel.')
    );
  }
}

/**
 * Execute a send transaction
 */
async function executeSendTransaction(
  userId: string,
  phoneNumber: string,
  pendingTx: any,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Get sender's wallet
    const { wallet } = await walletService.getOrCreateWallet(userId, phoneNumber);

    // Get recipient's wallet
    const recipientUser = await userService.getUserById(pendingTx.recipient);
    if (!recipientUser) {
      twiml.message(messagingService.formatErrorMessage('Recipient not found.'));
      return;
    }

    const { address: recipientAddress } = await walletService.getOrCreateWallet(
      recipientUser.id,
      recipientUser.phoneNumber
    );

    // Check gas
    const hasGas = await walletService.hasEnoughGas(wallet.address);
    if (!hasGas) {
      twiml.message(
        messagingService.formatErrorMessage(
          'Insufficient ETH for gas fees.\n\n' +
          '💡 You need a small amount of ETH on Ethereum Sepolia for transaction fees.'
        )
      );
      return;
    }

    // Send PYUSD
    console.log('Sending PYUSD transaction:', {
      from: wallet.address,
      to: recipientAddress,
      amount: pendingTx.amount,
    });

    twiml.message('⏳ Sending transaction...');

    const { txHash } = await walletService.sendPYUSD({
      fromWallet: wallet,
      toAddress: recipientAddress,
      amount: pendingTx.amount,
    });

    console.log('✓ Transaction sent! Hash:', txHash);

    // Save sender transaction to database
    const senderTx = await transactionService.createTransaction(
      userId,
      'send',
      'PYUSD',
      pendingTx.amount,
      recipientAddress,
      wallet.address
    );

    // Update transaction with hash
    await transactionService.updateTransactionHash(senderTx.id, txHash);
    await transactionService.updateTransactionStatus(senderTx.id, 'confirmed');

    // Save recipient transaction
    const recipientTx = await transactionService.createTransaction(
      recipientUser.id,
      'receive',
      'PYUSD',
      pendingTx.amount,
      recipientAddress,
      wallet.address
    );

    // Update recipient transaction with hash
    await transactionService.updateTransactionHash(recipientTx.id, txHash);
    await transactionService.updateTransactionStatus(recipientTx.id, 'confirmed');

    const explorerUrl = walletService.getTransactionExplorerUrl(txHash);

    // Send confirmation to sender
    const confirmationMsg = messagingService.formatTransactionConfirmation(
      'send',
      pendingTx.amount,
      'PYUSD',
      recipientAddress,
      txHash,
      explorerUrl
    );

    twiml.message(confirmationMsg);

    // Notify recipient (non-blocking - don't fail transaction if this fails)
    try {
      await messagingService.sendWhatsAppMessage(
        pendingTx.recipientPhone,
        messagingService.formatTransactionConfirmation(
          'receive',
          pendingTx.amount,
          'PYUSD',
          wallet.address,
          txHash,
          explorerUrl
        )
      );
      console.log('✓ Recipient notified successfully');
    } catch (notifyError) {
      // Log the error but don't fail the transaction
      console.warn('Failed to notify recipient (transaction still succeeded):', notifyError instanceof Error ? notifyError.message : notifyError);
    }

    // Log transaction
    await userService.logAudit(userId, 'transaction_sent', {
      amount: pendingTx.amount,
      recipient: recipientAddress,
      txHash,
    });
  } catch (error) {
    console.error('Error executing send transaction:', error);
    twiml.message(
      messagingService.formatErrorMessage(
        'Transaction failed. Please try again.\n\n' +
        (error instanceof Error ? error.message : 'Unknown error')
      )
    );
  }
}

/**
 * Execute a payment request (notify the other user)
 */
async function executePaymentRequest(
  _userId: string,
  phoneNumber: string,
  pendingTx: any,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Try to send request to the other user (non-blocking)
    try {
      await messagingService.sendWhatsAppMessage(
        pendingTx.recipientPhone,
        `💰 *Payment Request*\n\n` +
        `${phoneNumber} is requesting $${pendingTx.amount} PYUSD from you.\n\n` +
        `To send, reply:\n` +
        `"Send $${pendingTx.amount} to ${phoneNumber}"`
      );
      console.log('✓ Payment request sent to recipient');
    } catch (notifyError) {
      console.warn('Failed to notify recipient of payment request:', notifyError instanceof Error ? notifyError.message : notifyError);
      console.log('Payment request recorded but recipient not notified (may need WhatsApp opt-in)');
    }

    twiml.message(
      `✅ *Request Recorded!*\n\n` +
      `Your payment request for $${pendingTx.amount} PYUSD has been recorded.\n\n` +
      `💡 Note: Recipient needs to opt-in to WhatsApp notifications to receive requests.`
    );
  } catch (error) {
    console.error('Error executing payment request:', error);
    twiml.message(messagingService.formatErrorMessage('Could not process payment request.'));
  }
}

/**
 * Handle PIN setup
 */
async function handleSetPin(
  userId: string,
  intent: SetPinIntent,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Validate PIN format
    if (!pinService.isValidPinFormat(intent.pin)) {
      twiml.message(
        messagingService.formatErrorMessage(
          'Invalid PIN format. PIN must be 4-6 digits.\n\n' +
          'Example: "Set PIN 1234"'
        )
      );
      return;
    }

    // Hash the PIN
    const pinHash = pinService.hashPin(intent.pin);

    // Update user with PIN hash
    await userService.updateUser(userId, { pinHash });

    twiml.message(
      `✅ *PIN Set Successfully!*\n\n` +
      `Your PIN has been securely saved. You'll need to enter it to confirm transactions.\n\n` +
      `🔐 Keep your PIN safe and don't share it with anyone!`
    );
  } catch (error) {
    console.error('Error setting PIN:', error);
    twiml.message(messagingService.formatErrorMessage('Could not set PIN. Please try again.'));
  }
}

/**
 * Handle confirmation with PIN
 */
async function handleConfirmWithPin(
  userId: string,
  phoneNumber: string,
  pin: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    console.log('handleConfirmWithPin called with:', { userId, pin: pin.length + ' digits' });

    // Get user to check PIN
    const user = await userService.getUserById(userId);
    console.log('User found:', { hasUser: !!user, hasPinHash: !!user?.pinHash });

    if (!user || !user.pinHash) {
      console.log('No PIN hash found for user');
      twiml.message(
        messagingService.formatErrorMessage(
          'No PIN set up. Please set up a PIN first:\n\n' +
          'Example: "Set PIN 1234"'
        )
      );
      return;
    }

    // Verify PIN
    console.log('Verifying PIN...');
    const pinValid = pinService.verifyPin(pin, user.pinHash);
    console.log('PIN verification result:', pinValid);

    if (!pinValid) {
      console.log('PIN verification failed');
      twiml.message(
        messagingService.formatErrorMessage(
          '❌ Incorrect PIN. Transaction cancelled.\n\n' +
          'Please try again.'
        )
      );
      // Cancel the pending transaction
      pendingTransactionService.cancelPendingTransaction(userId);
      return;
    }

    console.log('PIN verified, getting pending transaction...');
    // PIN is correct, confirm the transaction
    const pendingTx = pendingTransactionService.confirmPendingTransaction(userId, pin);
    console.log('Pending transaction:', { found: !!pendingTx, type: pendingTx?.type });

    if (!pendingTx) {
      console.log('No pending transaction found');
      twiml.message(
        messagingService.formatInfoMessage(
          'No pending transaction to confirm.\n\n' +
          'Try sending a transaction first, like:\n' +
          '"Send $10 to +1234567890"'
        )
      );
      return;
    }

    console.log('Executing transaction type:', pendingTx.type);
    if (pendingTx.type === 'send') {
      // Execute the send transaction
      await executeSendTransaction(userId, phoneNumber, pendingTx, twiml);
    } else if (pendingTx.type === 'request') {
      // Send payment request to the other user
      await executePaymentRequest(userId, phoneNumber, pendingTx, twiml);
    }
  } catch (error) {
    console.error('Error handling PIN confirmation:', error);
    twiml.message(messagingService.formatErrorMessage('Could not confirm transaction. Please try again.'));
  }
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string | null {
  try {
    // Try to parse with libphonenumber
    const parsed = parsePhoneNumber(phone, 'US'); // Default to US
    if (parsed && parsed.isValid()) {
      return parsed.number;
    }

    // Fallback: just clean and add +
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
    }

    return null;
  } catch (error) {
    console.error('Error normalizing phone number:', error);
    return null;
  }
}

export default router;
