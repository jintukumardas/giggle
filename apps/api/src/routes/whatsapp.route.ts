import { Router, Request, Response } from 'express';
import MessagingResponse = require('twilio/lib/twiml/MessagingResponse');
import { userService } from '../services/user.service';
import { messagingService } from '../services/messaging.service';
import { openaiService, SendIntent, RequestIntent, SetPinIntent } from '../services/openai.service';
import { walletService } from '../services/wallet.service';
import { pendingTransactionService } from '../services/pending-transaction.service';
import { transactionService } from '../services/transaction.service';
import { pinService } from '../services/pin.service';
import { onboardingService } from '../services/onboarding.service';
import { giftCouponService } from '../services/gift-coupon.service';
import { giftCouponDbService } from '../services/gift-coupon-db.service';
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

    // Check if user needs onboarding
    if (onboardingService.needsOnboarding(user)) {
      await handleOnboarding(user.id, phoneNumber, Body, twiml);
      const twimLString = twiml.toString();
      console.log('Onboarding TwiML response:', twimLString);
      console.log('Sending onboarding response with', twiml.toString().match(/<Message>/g)?.length || 0, 'messages');
      res.type('text/xml').send(twimLString);
      return;
    }

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

      case 'createCoupon':
        await handleCreateCoupon(user.id, phoneNumber, intent, twiml);
        break;

      case 'redeemCoupon':
        await handleRedeemCoupon(user.id, phoneNumber, intent, twiml);
        break;

      case 'checkCoupon':
        await handleCheckCoupon(intent, twiml);
        break;

      case 'listCoupons':
        console.log('[webhook] Handling listCoupons intent for user:', user.id);
        await handleListCoupons(user.id, phoneNumber, twiml);
        console.log('[webhook] Finished handling listCoupons');
        console.log('[webhook] TwiML content:', twiml.toString());
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

    const twimLString = twiml.toString();
    console.log('[webhook] Final TwiML response length:', twimLString.length);
    console.log('[webhook] Final TwiML response:', twimLString);
    res.type('text/xml').send(twimLString);
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
 * Handle onboarding flow
 */
async function handleOnboarding(
  userId: string,
  phoneNumber: string,
  message: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    const user = await userService.getUserById(userId);
    if (!user) return;

    const currentStep = onboardingService.getCurrentStep(user);
    const messageLower = message.toLowerCase().trim();

    console.log('Onboarding:', { userId, currentStep, message: messageLower });

    switch (currentStep) {
      case 'welcome':
        // Show welcome message and advance to PIN setup
        const welcomeMsg = messagingService.getOnboardingWelcomeMessage();
        console.log('Adding welcome message, length:', welcomeMsg.length);
        twiml.message(welcomeMsg);
        await onboardingService.advanceToNextStep(userId, 'welcome');
        break;

      case 'pin':
        // Handle PIN setup
        if (messageLower.includes('continue')) {
          // User clicked continue from welcome, show PIN instructions
          twiml.message(messagingService.getOnboardingPinMessage());
        } else if (messageLower.startsWith('set pin')) {
          // Extract PIN from message
          const pinMatch = message.match(/set\s+pin\s+(\d{4,6})/i);
          if (!pinMatch) {
            twiml.message(
              messagingService.formatErrorMessage(
                'Invalid PIN format. PIN must be 4-6 digits.\n\n' +
                'Example: "Set PIN 1234"'
              )
            );
            return;
          }

          const pin = pinMatch[1];
          if (!pinService.isValidPinFormat(pin)) {
            twiml.message(
              messagingService.formatErrorMessage(
                'Invalid PIN format. PIN must be 4-6 digits.\n\n' +
                'Example: "Set PIN 1234"'
              )
            );
            return;
          }

          // Hash and save PIN
          const pinHash = pinService.hashPin(pin);
          await userService.updateUser(userId, { pinHash });

          // Set default network to Sepolia and default token to PYUSD
          await userService.updateUser(userId, {
            defaultNetwork: 'sepolia',
            defaultToken: 'PYUSD',
          });

          // Complete onboarding
          await onboardingService.completeOnboarding(userId);

          twiml.message(messagingService.getOnboardingPinSuccessMessage());

          // Create wallet and show completion message
          const { address } = await walletService.getOrCreateWallet(userId, phoneNumber);
          const explorerUrl = walletService.getAddressExplorerUrl(address);
          twiml.message(messagingService.getOnboardingCompletionMessage(address, explorerUrl));
        } else {
          // User sent something else, re-show PIN instructions
          const pinMsg = messagingService.getOnboardingPinMessage();
          console.log('Adding PIN message (else), length:', pinMsg.length);
          twiml.message(pinMsg);
        }
        break;

      case 'network':
      case 'token':
        // These steps are now skipped - redirect to completed
        await onboardingService.completeOnboarding(userId);
        const { address: walletAddr } = await walletService.getOrCreateWallet(userId, phoneNumber);
        const explorerUrl = walletService.getAddressExplorerUrl(walletAddr);
        twiml.message(messagingService.getOnboardingCompletionMessage(walletAddr, explorerUrl));
        break;

      default:
        // Should not reach here, but just in case, show welcome
        twiml.message(messagingService.getOnboardingWelcomeMessage());
        await onboardingService.updateStep(userId, 'welcome');
    }
  } catch (error) {
    console.error('Error handling onboarding:', error);
    twiml.message(messagingService.formatErrorMessage('An error occurred during setup. Please try again.'));
  }
}

/**
 * Handle create gift coupon
 */
async function handleCreateCoupon(
  userId: string,
  phoneNumber: string,
  intent: any,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Check if gift coupon service is configured
    const isConfigured = await giftCouponService.isConfigured();
    if (!isConfigured) {
      twiml.message(
        messagingService.formatErrorMessage(
          'Gift coupons are not available yet. Please check back later!'
        )
      );
      return;
    }

    // Send immediate response
    twiml.message('🎁 Creating your gift coupon...\n\nThis may take a few minutes. Please check back using "show my coupons" or "available coupons".');

    // Process the coupon creation in the background (don't await)
    createCouponInBackground(userId, phoneNumber, intent).catch(error => {
      console.error('Background coupon creation failed:', error);
    });
  } catch (error) {
    console.error('Error initiating gift coupon creation:', error);
    twiml.message(
      messagingService.formatErrorMessage(
        'Could not create gift coupon. ' +
        (error instanceof Error ? error.message : 'Please try again.')
      )
    );
  }
}

/**
 * Background function to create coupon and notify user
 */
async function createCouponInBackground(
  userId: string,
  phoneNumber: string,
  intent: any
): Promise<void> {
  try {
    // Get user's wallet
    const { wallet } = await walletService.getOrCreateWallet(userId, phoneNumber);

    console.log('Creating gift coupon in background...');

    const result = await giftCouponService.createCoupon({
      wallet,
      amount: intent.amount,
      token: intent.token || 'PYUSD',
      message: intent.message,
      creatorPhone: phoneNumber,
      expiryDays: intent.expiryDays || 0,
    });

    console.log('Gift coupon created successfully:', result.code);

    // Save coupon to database
    const expiresAt = intent.expiryDays > 0
      ? new Date(Date.now() + intent.expiryDays * 24 * 60 * 60 * 1000)
      : undefined;

    await giftCouponDbService.saveCoupon({
      code: result.code,
      creatorId: userId,
      amount: intent.amount,
      token: intent.token || 'PYUSD',
      message: intent.message,
      expiresAt,
      txHash: result.txHash,
    });

    // Get explorer URL
    const explorerUrl = walletService.getTransactionExplorerUrl(result.txHash);

    // Format response message
    const message =
      `✅ *Gift Coupon Created!*\n\n` +
      `💳 Code: \`${result.code}\`\n` +
      `💰 Amount: $${intent.amount} ${intent.token || 'PYUSD'}\n` +
      `${intent.expiryDays ? `⏰ Expires: ${intent.expiryDays} days\n` : ''}\n` +
      `Share this code with the recipient to redeem!\n\n` +
      `🔗 View Transaction:\n${explorerUrl}\n\n` +
      `💡 Your balance has been updated. Check with "What's my balance?"`;

    // Send the success message to the user
    await messagingService.sendWhatsAppMessage(phoneNumber, message);

    // Log the coupon creation
    await userService.logAudit(userId, 'coupon_created', {
      code: result.code,
      amount: intent.amount,
      token: intent.token,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error('Error creating gift coupon in background:', error);

    // Notify user of failure
    try {
      await messagingService.sendWhatsAppMessage(
        phoneNumber,
        messagingService.formatErrorMessage(
          'Could not create gift coupon. ' +
          (error instanceof Error ? error.message : 'Please try again.')
        )
      );
    } catch (notifyError) {
      console.error('Failed to notify user of coupon creation failure:', notifyError);
    }
  }
}

/**
 * Handle redeem gift coupon
 */
async function handleRedeemCoupon(
  userId: string,
  phoneNumber: string,
  intent: any,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Check if gift coupon service is configured
    const isConfigured = await giftCouponService.isConfigured();
    if (!isConfigured) {
      twiml.message(
        messagingService.formatErrorMessage(
          'Gift coupons are not available yet. Please check back later!'
        )
      );
      return;
    }

    // Send immediate response
    twiml.message('🎁 Redeeming your gift coupon...\n\nThis may take a few moments. You\'ll receive confirmation shortly.');

    // Process the redemption in the background (don't await)
    redeemCouponInBackground(userId, phoneNumber, intent).catch(error => {
      console.error('Background coupon redemption failed:', error);
    });
  } catch (error) {
    console.error('Error initiating gift coupon redemption:', error);
    twiml.message(
      messagingService.formatErrorMessage(
        'Could not redeem gift coupon. ' +
        (error instanceof Error ? error.message : 'Please try again.')
      )
    );
  }
}

/**
 * Background function to redeem coupon and notify user
 */
async function redeemCouponInBackground(
  userId: string,
  phoneNumber: string,
  intent: any
): Promise<void> {
  try {
    // Get user's wallet
    const { wallet } = await walletService.getOrCreateWallet(userId, phoneNumber);

    console.log('Redeeming gift coupon in background...');

    const result = await giftCouponService.redeemCoupon(intent.code, wallet);

    console.log('Gift coupon redeemed successfully:', intent.code);

    // Mark coupon as redeemed in database
    await giftCouponDbService.markAsRedeemed(intent.code, userId, result.txHash);

    // Get explorer URL
    const explorerUrl = walletService.getTransactionExplorerUrl(result.txHash);

    // Format response message
    const message =
      `✅ *Gift Coupon Redeemed!*\n\n` +
      `💰 You received: $${result.amount} ${result.token}\n` +
      `${result.metadata.message ? `💌 Message: "${result.metadata.message}"\n` : ''}\n` +
      `🔗 View Transaction:\n${explorerUrl}\n\n` +
      `💡 Your balance has been updated. Check with "What's my balance?"`;

    // Send the success message to the user
    await messagingService.sendWhatsAppMessage(phoneNumber, message);

    // Log the redemption
    await userService.logAudit(userId, 'coupon_redeemed', {
      code: intent.code,
      amount: result.amount,
      token: result.token,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error('Error redeeming gift coupon in background:', error);

    // Notify user of failure
    try {
      await messagingService.sendWhatsAppMessage(
        phoneNumber,
        messagingService.formatErrorMessage(
          'Could not redeem gift coupon. ' +
          (error instanceof Error ? error.message : 'Please try again.')
        )
      );
    } catch (notifyError) {
      console.error('Failed to notify user of coupon redemption failure:', notifyError);
    }
  }
}

/**
 * Handle check gift coupon
 */
async function handleCheckCoupon(
  intent: any,
  twiml: MessagingResponse
): Promise<void> {
  try {
    // Check if gift coupon service is configured
    const isConfigured = await giftCouponService.isConfigured();
    if (!isConfigured) {
      twiml.message(
        messagingService.formatErrorMessage(
          'Gift coupons are not available yet. Please check back later!'
        )
      );
      return;
    }

    if (!intent.code) {
      twiml.message(
        messagingService.formatInfoMessage(
          'Please provide a coupon code to check.\n\n' +
          'Example: "Check coupon GIFT1234"'
        )
      );
      return;
    }

    // Check the coupon
    const couponInfo = await giftCouponService.checkCoupon(intent.code);

    if (!couponInfo.exists) {
      twiml.message(
        messagingService.formatErrorMessage(
          `Coupon code "${intent.code}" not found.`
        )
      );
      return;
    }

    // Format response message
    let message = `🎁 *Gift Coupon Status*\n\n`;
    message += `💳 Code: \`${intent.code}\`\n`;
    message += `💰 Amount: $${couponInfo.amount} ${couponInfo.token}\n`;
    message += `✅ Valid: ${couponInfo.isValid ? 'Yes' : 'No'}\n`;

    if (couponInfo.expiresAt) {
      const expiryDate = new Date(couponInfo.expiresAt);
      message += `⏰ Expires: ${expiryDate.toLocaleDateString()}\n`;
    }

    if (couponInfo.metadata?.message) {
      message += `💌 Message: "${couponInfo.metadata.message}"\n`;
    }

    if (!couponInfo.isValid) {
      message += `\n⚠️ This coupon has already been redeemed or has expired.`;
    } else {
      message += `\n💡 To redeem, reply: "Redeem coupon ${intent.code}"`;
    }

    twiml.message(message);
  } catch (error) {
    console.error('Error checking gift coupon:', error);
    twiml.message(
      messagingService.formatErrorMessage(
        'Could not check gift coupon. Please try again.'
      )
    );
  }
}

/**
 * Handle list user's gift coupons
 */
async function handleListCoupons(
  userId: string,
  phoneNumber: string,
  twiml: MessagingResponse
): Promise<void> {
  try {
    console.log('[handleListCoupons] Starting for userId:', userId);

    // Get all coupons for this user (created and redeemed)
    console.log('[handleListCoupons] Fetching active coupons...');
    const activeCoupons = await giftCouponDbService.getUserActiveCoupons(userId);
    console.log('[handleListCoupons] Active coupons count:', activeCoupons.length);

    console.log('[handleListCoupons] Fetching redeemed coupons...');
    const redeemedCoupons = await giftCouponDbService.getUserRedeemedCoupons(userId);
    console.log('[handleListCoupons] Redeemed coupons count:', redeemedCoupons.length);

    let message = `🎁 *Your Gift Coupons*\n\n`;

    // Show active coupons created by user
    if (activeCoupons.length > 0) {
      message += `📤 *Coupons You Created (${activeCoupons.length})*\n\n`;
      activeCoupons.forEach((coupon, index) => {
        message += `${index + 1}. Code: \`${coupon.code}\`\n`;
        message += `   💰 $${coupon.amount} ${coupon.token}\n`;
        if (coupon.message) {
          message += `   💌 "${coupon.message}"\n`;
        }
        message += `   📅 Created: ${new Date(coupon.createdAt).toLocaleDateString()}\n`;
        if (coupon.expiresAt) {
          message += `   ⏰ Expires: ${new Date(coupon.expiresAt).toLocaleDateString()}\n`;
        }
        message += `\n`;
      });
    }

    // Show redeemed coupons
    if (redeemedCoupons.length > 0) {
      message += `📥 *Coupons You Redeemed (${redeemedCoupons.length})*\n\n`;
      redeemedCoupons.slice(0, 5).forEach((coupon, index) => {
        message += `${index + 1}. $${coupon.amount} ${coupon.token}\n`;
        if (coupon.message) {
          message += `   💌 "${coupon.message}"\n`;
        }
        message += `   📅 ${new Date(coupon.redeemedAt!).toLocaleDateString()}\n\n`;
      });
      if (redeemedCoupons.length > 5) {
        message += `   ... and ${redeemedCoupons.length - 5} more\n\n`;
      }
    }

    if (activeCoupons.length === 0 && redeemedCoupons.length === 0) {
      message += `You don't have any gift coupons yet.\n\n`;
      message += `💡 Create one with: "Create gift coupon $5"\n`;
      message += `Or ask someone to send you a coupon code!`;
    } else {
      message += `💡 *Tip:* Share your coupon codes with friends to gift them PYUSD!`;
    }

    console.log('[handleListCoupons] Sending message, length:', message.length);

    // Send via direct messaging service as a workaround for TwiML delivery issues
    // This ensures reliable delivery, similar to how balance notifications work
    try {
      await messagingService.sendWhatsAppMessage(phoneNumber, message);
      console.log('[handleListCoupons] Message sent via direct messaging service');
      // Also add to twiml as fallback
      twiml.message('✅ Coupon list sent!');
    } catch (sendError) {
      console.error('[handleListCoupons] Failed to send via messaging service, using twiml:', sendError);
      // Fallback to twiml
      twiml.message(message);
    }
  } catch (error) {
    console.error('[handleListCoupons] Error listing gift coupons:', error);
    twiml.message(
      messagingService.formatErrorMessage(
        'Could not retrieve your coupons. Please try again.'
      )
    );
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
