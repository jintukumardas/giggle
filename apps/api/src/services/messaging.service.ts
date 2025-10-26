import twilio from 'twilio';
import { config } from '../config';

/**
 * Twilio WhatsApp Messaging Service
 *
 * Integration based on official docs:
 * https://www.twilio.com/docs/whatsapp/quickstart
 *
 * Features:
 * - Message templates for business-initiated messages
 * - 24-hour service window for freeform messages
 * - Media support for QR codes and receipts
 */

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

export class MessagingService {
  /**
   * Send a WhatsApp message (freeform text)
   * Note: Can only be used within 24-hour window after user message
   */
  async sendWhatsAppMessage(to: string, body: string): Promise<string> {
    try {
      const message = await twilioClient.messages.create({
        from: config.twilio.whatsappNumber,
        to: `whatsapp:${to}`,
        body,
      });
      return message.sid;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send a WhatsApp message using a pre-approved template
   * Templates can be used for business-initiated messages outside the 24-hour window
   */
  async sendWhatsAppTemplate(
    to: string,
    contentSid: string,
    contentVariables?: Record<string, string>
  ): Promise<string> {
    try {
      const message = await twilioClient.messages.create({
        from: config.twilio.whatsappNumber,
        to: `whatsapp:${to}`,
        contentSid,
        contentVariables: contentVariables ? JSON.stringify(contentVariables) : undefined,
      });
      return message.sid;
    } catch (error) {
      console.error('Failed to send WhatsApp template message:', error);
      throw error;
    }
  }

  /**
   * Send message with media (for QR codes)
   */
  async sendWhatsAppMessageWithMedia(
    to: string,
    body: string,
    mediaUrl: string
  ): Promise<string> {
    try {
      const message = await twilioClient.messages.create({
        from: config.twilio.whatsappNumber,
        to: `whatsapp:${to}`,
        body,
        mediaUrl: [mediaUrl],
      });
      return message.sid;
    } catch (error) {
      console.error('Failed to send WhatsApp message with media:', error);
      throw error;
    }
  }

  /**
   * Validate Twilio signature (for webhook security)
   */
  validateSignature(signature: string, url: string, params: any): boolean {
    if (!config.twilio.verifySignatures) {
      return true; // Skip validation in development
    }

    return twilio.validateRequest(
      config.twilio.authToken,
      signature,
      url,
      params
    );
  }

  /**
   * Format help message
   */
  getHelpMessage(): string {
    return `👋 *Welcome to Giggle Pay!*

Send and receive PYUSD using just phone numbers. No wallet addresses needed!

💬 *Just chat naturally:*

• "Send $10 to +1234567890"
• "What's my balance?"
• "Show my account"
• "Show my transaction history"
• "Request $20 from +1987654321"

🔐 *Security:*

• "Set PIN 1234" - Set up a 4-6 digit PIN
• Enter your PIN to confirm transactions

📱 *Your phone number is your account* - we automatically create and manage your Ethereum wallet for you!

⚠️ *Ethereum Sepolia testnet only. No real money.*`;
  }

  /**
   * Format onboarding welcome message
   */
  getOnboardingWelcomeMessage(): string {
    return `🎉 *Welcome to Giggle Pay!*

Your simple, secure way to send and receive digital payments via WhatsApp.

💡 *What is Giggle Pay?*
- Send money instantly using just phone numbers
- No complicated wallet addresses needed
- Secure payments with PIN protection
- Powered by blockchain technology

Let's get you set up in just a few quick steps!

📍 *Step 1 of 3: Security Setup*

Please reply with "Continue" to proceed.`;
  }

  /**
   * Format PIN setup message
   */
  getOnboardingPinMessage(): string {
    return `🔐 *Step 2 of 3: Set Your PIN*

For your security, you need to set up a 4-6 digit PIN.

Your PIN will be required to:
- Confirm all transactions
- Protect your account

💬 *How to set your PIN:*
Reply with: "Set PIN 1234"

(Replace 1234 with your own 4-6 digit PIN)

🔒 Keep your PIN safe and don't share it with anyone!`;
  }

  /**
   * Format network selection message
   */
  getOnboardingNetworkMessage(): string {
    return `🌐 *Step 3 of 3: Choose Your Network*

Select your preferred network for transactions:

*Sepolia Testnet* ⭐ (Recommended)
- Free testnet for learning and testing
- No real money involved
- Great for getting started

*Ethereum Mainnet*
- Real transactions with real money
- Requires ETH for gas fees
- For experienced users

💬 Reply with:
- "Sepolia" for testnet (recommended)
- "Mainnet" for real transactions
- "Skip" to use default (Sepolia)`;
  }

  /**
   * Format token selection message
   */
  getOnboardingTokenMessage(): string {
    return `💰 *Final Step: Default Token*

Choose your preferred stablecoin:

*PYUSD* ⭐ (Recommended)
- PayPal USD stablecoin
- 1 PYUSD = 1 USD
- Widely accepted

*USDC*
- Circle USD stablecoin
- 1 USDC = 1 USD
- Industry standard

💬 Reply with:
- "PYUSD" (recommended)
- "USDC"
- "Skip" to use default (PYUSD)

You can change this later!`;
  }

  /**
   * Format onboarding completion message
   */
  getOnboardingCompletionMessage(walletAddress: string, explorerUrl: string): string {
    return `✅ *Setup Complete!*

Welcome to Giggle Pay! Your account is ready to use.

🎊 *You're all set!*

💳 *Your Wallet:*
Address: ${walletAddress}

🔍 View on Explorer:
${explorerUrl}

💬 *Quick Start:*
- "Send $10 to +1234567890" - Send money
- "What's my balance?" - Check balance
- "Show my account" - View wallet details
- "Help" - See all commands

📱 *Your phone number is your account* - we manage your blockchain wallet securely for you!

Start sending and receiving payments now! 🚀`;
  }

  /**
   * Format PIN setup success during onboarding
   */
  getOnboardingPinSuccessMessage(): string {
    return `✅ *PIN Set Successfully!*

Your PIN has been securely saved.

🔐 You'll need to enter it to confirm all transactions.

Moving to next step...`;
  }

  /**
   * Format network selection success
   */
  getOnboardingNetworkSuccessMessage(network: string): string {
    return `✅ *Network Selected: ${network}*

Your default network has been set.

Moving to final step...`;
  }

  /**
   * Format token selection success
   */
  getOnboardingTokenSuccessMessage(token: string): string {
    return `✅ *Default Token: ${token}*

Your preferred stablecoin has been set.

Finalizing your account...`;
  }

  /**
   * Format balance message
   */
  formatBalanceMessage(balances: Array<{ token: string; amount: string; usdValue?: string }>): string {
    let message = '💰 *Your Balances:*\n\n';

    balances.forEach(({ token, amount, usdValue }) => {
      const value = parseFloat(amount).toFixed(2);
      message += `• ${value} ${token.toUpperCase()}`;
      if (usdValue) {
        message += ` (≈ $${usdValue})`;
      }
      message += '\n';
    });

    return message;
  }

  /**
   * Format transaction confirmation message
   */
  formatTransactionConfirmation(
    type: 'send' | 'receive',
    amount: string,
    token: string,
    peerAddress: string,
    txHash?: string,
    explorerUrl?: string
  ): string {
    const emoji = type === 'send' ? '✅📤' : '✅📥';
    const action = type === 'send' ? 'Sent' : 'Received';
    const direction = type === 'send' ? 'To' : 'From';

    let message = `${emoji} *${action}!*\n\n`;
    message += `Amount: ${amount} ${token.toUpperCase()}\n`;
    message += `${direction}: ${peerAddress}\n`;

    if (txHash) {
      message += `\nTransaction: ${txHash}`;
    }

    if (explorerUrl) {
      message += `\n\n🔍 View on Explorer:\n${explorerUrl}`;
    }

    return message;
  }

  /**
   * Format error message
   */
  formatErrorMessage(error: string): string {
    return `❌ *Error*\n\n${error}`;
  }

  /**
   * Format warning message
   */
  formatWarningMessage(warning: string): string {
    return `⚠️ *Warning*\n\n${warning}`;
  }

  /**
   * Format info message
   */
  formatInfoMessage(info: string): string {
    return `ℹ️ ${info}`;
  }

  /**
   * Format transaction confirmation request
   */
  formatTransactionConfirmationRequest(params: {
    type: 'send' | 'request';
    amount: string;
    recipientPhone: string;
    senderBalance?: string;
    requirePin: boolean;
  }): string {
    const { type, amount, recipientPhone, senderBalance, requirePin } = params;

    if (type === 'send') {
      let message = `💸 *Confirm Transaction*\n\n`;
      message += `Amount: *$${amount} PYUSD*\n`;
      message += `To: ${recipientPhone}\n`;

      if (senderBalance) {
        message += `Your balance: $${senderBalance} PYUSD\n`;
      }

      if (requirePin) {
        message += `\n🔐 *Reply with your 4-6 digit PIN to confirm*\n`;
        message += `❌ Reply "CANCEL" to cancel`;
      } else {
        message += `\n✅ Reply "YES" or "CONFIRM" to send\n`;
        message += `❌ Reply "NO" or "CANCEL" to cancel`;
      }

      message += `\n\n⏱️ This confirmation expires in 5 minutes`;

      return message;
    } else {
      let message = `💰 *Confirm Payment Request*\n\n`;
      message += `Amount: *$${amount} PYUSD*\n`;
      message += `From: ${recipientPhone}\n`;
      message += `\n✅ Reply "YES" to send request\n`;
      message += `❌ Reply "NO" to cancel`;

      return message;
    }
  }

  /**
   * Format transaction cancelled message
   */
  formatTransactionCancelled(): string {
    return `❌ *Transaction Cancelled*\n\nYour pending transaction has been cancelled.`;
  }

  /**
   * Format transaction expired message
   */
  formatTransactionExpired(): string {
    return `⏱️ *Transaction Expired*\n\nYour pending transaction has expired. Please try again.`;
  }

  /**
   * Format insufficient balance error
   */
  formatInsufficientBalance(balance: string, required: string): string {
    return `❌ *Insufficient Balance*\n\nYou need $${required} PYUSD but only have $${balance} PYUSD.\n\n💡 You can request funds from another user or get testnet tokens.`;
  }

  /**
   * Format wallet info message
   */
  formatWalletInfo(params: {
    address: string;
    formattedAddress: string;
    pyusdBalance: string;
    ethBalance: string;
    explorerUrl: string;
  }): string {
    const { address, pyusdBalance, ethBalance, explorerUrl } = params;

    let message = `💳 *Your Wallet*\n\n`;
    message += `🔑 Address: ${address}\n\n`;
    message += `💰 *Balances:*\n`;
    message += `• PYUSD: $${parseFloat(pyusdBalance).toFixed(2)}\n`;
    message += `• ETH: ${parseFloat(ethBalance).toFixed(4)} (gas)\n\n`;
    message += `🔍 View on Explorer:\n${explorerUrl}`;

    return message;
  }

  /**
   * Format transaction history
   */
  formatTransactionHistory(transactions: any[], getExplorerUrl?: (txHash: string) => string): string {
    if (!transactions || transactions.length === 0) {
      return `📝 *Transaction History*\n\nNo transactions yet. Send your first PYUSD!`;
    }

    let message = `📝 *Recent Transactions*\n\n`;

    transactions.slice(0, 5).forEach((tx, index) => {
      const emoji = tx.type === 'send' ? '📤' : '📥';
      const direction = tx.type === 'send' ? 'To' : 'From';
      const peerAddress = tx.type === 'send' ? tx.recipient : tx.sender;

      message += `${emoji} $${tx.amount} ${tx.token}\n`;
      if (peerAddress) {
        message += `   ${direction}: ${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}\n`;
      }
      message += `   ${new Date(tx.createdAt).toLocaleDateString()}\n`;

      if (tx.txHash && getExplorerUrl) {
        message += `   🔍 ${getExplorerUrl(tx.txHash)}\n`;
      }

      if (index < transactions.length - 1 && index < 4) {
        message += `\n`;
      }
    });

    if (transactions.length > 5) {
      message += `\n... and ${transactions.length - 5} more`;
    }

    return message;
  }
}

export const messagingService = new MessagingService();
