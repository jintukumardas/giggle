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
    return `🤖 *Giggle - WhatsApp Stablecoin Payments*

📱 *Commands:*

• \`/link\` - Link your wallet
• \`send 10 pyusd to @alice\` - Send tokens
• \`send 5 usdc to +1234567890\` - Send to phone
• \`request 5 usdc from @bob\` - Request payment
• \`balance\` - Check your balance
• \`history\` - View transactions
• \`schedule 3 pyusd to @maya on Friday 9am\` - Schedule payment
• \`set limit 50/day\` - Set daily limit
• \`lock\` - Lock outgoing transfers
• \`unlock\` - Unlock transfers
• \`/help\` - Show this message

⚠️ *Testnet only. No real money.*`;
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
    peer: string,
    txHash?: string,
    blockscoutUrl?: string
  ): string {
    const emoji = type === 'send' ? '✅📤' : '✅📥';
    const action = type === 'send' ? 'Sent' : 'Received';
    const direction = type === 'send' ? 'to' : 'from';

    let message = `${emoji} *${action}!*\n\n`;
    message += `Amount: ${amount} ${token.toUpperCase()}\n`;
    message += `${direction.charAt(0).toUpperCase() + direction.slice(1)}: ${peer}\n`;

    if (txHash) {
      message += `\nTx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
    }

    if (blockscoutUrl) {
      message += `\n\n🔍 View on Blockscout:\n${blockscoutUrl}`;
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
}

export const messagingService = new MessagingService();
