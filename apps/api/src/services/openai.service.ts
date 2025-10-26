import OpenAI from 'openai';
import { config } from '../config';
import { z } from 'zod';

// Intent schemas
const SendIntentSchema = z.object({
  type: z.literal('send'),
  amount: z.string(),
  recipient: z.string(), // Phone number
  currency: z.enum(['PYUSD', 'USD']).default('PYUSD'),
});

const RequestIntentSchema = z.object({
  type: z.literal('request'),
  amount: z.string(),
  from: z.string(), // Phone number
  currency: z.enum(['PYUSD', 'USD']).default('PYUSD'),
});

const BalanceIntentSchema = z.object({
  type: z.literal('balance'),
});

const AccountIntentSchema = z.object({
  type: z.literal('account'),
});

const HistoryIntentSchema = z.object({
  type: z.literal('history'),
  limit: z.number().optional().default(5),
});

const HelpIntentSchema = z.object({
  type: z.literal('help'),
});

const ConfirmIntentSchema = z.object({
  type: z.literal('confirm'),
});

const CancelIntentSchema = z.object({
  type: z.literal('cancel'),
});

const SetPinIntentSchema = z.object({
  type: z.literal('setPin'),
  pin: z.string(),
});

const CreateCouponIntentSchema = z.object({
  type: z.literal('createCoupon'),
  amount: z.string(),
  token: z.enum(['PYUSD']).default('PYUSD'),
  message: z.string().optional(),
  expiryDays: z.number().optional().default(0), // 0 = no expiry
});

const RedeemCouponIntentSchema = z.object({
  type: z.literal('redeemCoupon'),
  code: z.string(),
});

const CheckCouponIntentSchema = z.object({
  type: z.literal('checkCoupon'),
  code: z.string().optional(), // If empty, list all user's coupons
});

const ListCouponsIntentSchema = z.object({
  type: z.literal('listCoupons'),
});

const UnknownIntentSchema = z.object({
  type: z.literal('unknown'),
  originalMessage: z.string(),
});

const IntentSchema = z.discriminatedUnion('type', [
  SendIntentSchema,
  RequestIntentSchema,
  BalanceIntentSchema,
  AccountIntentSchema,
  HistoryIntentSchema,
  HelpIntentSchema,
  ConfirmIntentSchema,
  CancelIntentSchema,
  SetPinIntentSchema,
  CreateCouponIntentSchema,
  RedeemCouponIntentSchema,
  CheckCouponIntentSchema,
  ListCouponsIntentSchema,
  UnknownIntentSchema,
]);

export type UserIntent = z.infer<typeof IntentSchema>;
export type SendIntent = z.infer<typeof SendIntentSchema>;
export type RequestIntent = z.infer<typeof RequestIntentSchema>;
export type BalanceIntent = z.infer<typeof BalanceIntentSchema>;
export type AccountIntent = z.infer<typeof AccountIntentSchema>;
export type HistoryIntent = z.infer<typeof HistoryIntentSchema>;
export type HelpIntent = z.infer<typeof HelpIntentSchema>;
export type ConfirmIntent = z.infer<typeof ConfirmIntentSchema>;
export type CancelIntent = z.infer<typeof CancelIntentSchema>;
export type SetPinIntent = z.infer<typeof SetPinIntentSchema>;
export type CreateCouponIntent = z.infer<typeof CreateCouponIntentSchema>;
export type RedeemCouponIntent = z.infer<typeof RedeemCouponIntentSchema>;
export type CheckCouponIntent = z.infer<typeof CheckCouponIntentSchema>;
export type ListCouponsIntent = z.infer<typeof ListCouponsIntentSchema>;
export type UnknownIntent = z.infer<typeof UnknownIntentSchema>;

export class OpenAIService {
  private client: OpenAI | null = null;

  constructor() {
    // Only initialize OpenAI if API key is valid (not empty or placeholder)
    if (config.openai.apiKey &&
        config.openai.apiKey.length > 20 &&
        !config.openai.apiKey.includes('your_')) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    } else {
      console.log('OpenAI API key not configured, using fallback parser');
    }
  }

  /**
   * Understand user intent from natural language message
   */
  async parseIntent(message: string): Promise<UserIntent> {
    // Quick check for simple confirmation/cancellation words (bypass OpenAI for speed)
    const lowerMessage = message.toLowerCase().trim();
    if (/^(yes|confirm|proceed|ok|yeah|yep|sure|accept)$/i.test(lowerMessage)) {
      console.log('Quick match: confirm intent');
      return { type: 'confirm' };
    }
    if (/^(no|cancel|stop|abort|decline|reject)$/i.test(lowerMessage)) {
      console.log('Quick match: cancel intent');
      return { type: 'cancel' };
    }

    if (!this.client) {
      console.warn('OpenAI API key not configured, falling back to basic parsing');
      return this.fallbackParse(message);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant for a WhatsApp-based PYUSD payment system.
Your job is to understand user intent and extract relevant information.

Available intents and their required JSON format:

1. send - User wants to send PYUSD to someone
   Format: {"type": "send", "amount": "10.00", "recipient": "+1234567890", "currency": "PYUSD"}

2. request - User wants to request PYUSD from someone
   Format: {"type": "request", "amount": "10.00", "from": "+1234567890", "currency": "PYUSD"}

3. balance - User wants to check their PYUSD balance
   Format: {"type": "balance"}

4. account - User wants to see their account address or wallet info
   Format: {"type": "account"}

5. history - User wants to see transaction history
   Format: {"type": "history", "limit": 5}

6. help - User needs help, wants to know what the system can do, or asks general questions without specific action (examples: "help", "what can you do?", "what else can you do?", "what features do you have?")
   Format: {"type": "help"}

7. confirm - User is confirming a pending transaction (IMPORTANT: words like "yes", "confirm", "proceed", "ok", "yeah", "yep", "sure", "accept" should ALL be recognized as confirm)
   Format: {"type": "confirm"}

8. cancel - User wants to cancel a pending transaction (words like "no", "cancel", "stop", "abort", "decline", "reject" should be recognized as cancel)
   Format: {"type": "cancel"}

9. setPin - User is setting up their PIN (4-6 digit number, user says something like "set pin 1234" or "my pin is 1234")
   Format: {"type": "setPin", "pin": "1234"}

10. createCoupon - User wants to create a gift coupon (phrases like "I would like to gift a coupon", "create gift", "send a gift coupon", "make a coupon". Amount is OPTIONAL - if not specified, use "5.00" as default)
   Format: {"type": "createCoupon", "amount": "50.00", "token": "PYUSD", "message": "Optional message", "expiryDays": 30}
   - amount defaults to "5.00" if not specified by user
   - message is optional gift message
   - expiryDays defaults to 0 (no expiry), can be 7, 30, etc if user mentions "expires in 30 days"

11. redeemCoupon - User wants to redeem a gift coupon (says "redeem coupon ABC12345", "use gift code XYZ", "claim coupon")
   Format: {"type": "redeemCoupon", "code": "ABC12345"}

12. checkCoupon - User wants to check a specific coupon's validity (says "check coupon ABC", "is coupon ABC valid")
   Format: {"type": "checkCoupon", "code": "ABC12345"}

13. listCoupons - User wants to see all their gift coupons (says "show my coupons", "list my gift coupons", "my coupons", "what coupons do I have?")
   Format: {"type": "listCoupons"}

14. unknown - Cannot determine intent
   Format: {"type": "unknown", "originalMessage": "user's message"}

IMPORTANT: Always return valid JSON matching exactly one of these formats.
Phone numbers can be in various formats: +1234567890, (123) 456-7890, 123-456-7890, etc.
Amounts can be written as: $10, 10 dollars, 10 USD, 10 PYUSD, etc.`,
          },
          {
            role: 'user',
            content: message,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(response);
      console.log('OpenAI parsed response:', JSON.stringify(parsed, null, 2));

      // Validate against our schema
      try {
        const intent = IntentSchema.parse(parsed);
        console.log('Successfully validated intent:', intent);
        return intent;
      } catch (zodError) {
        // OpenAI returned invalid format, use fallback
        console.warn('OpenAI returned invalid intent format:', zodError);
        console.warn('Parsed data:', JSON.stringify(parsed, null, 2));
        return this.fallbackParse(message);
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error instanceof Error ? error.message : error);
      return this.fallbackParse(message);
    }
  }

  /**
   * Fallback parser for when OpenAI is unavailable
   */
  private fallbackParse(message: string): UserIntent {
    const lowerMessage = message.toLowerCase().trim();

    // Confirm/Cancel patterns
    if (/^(yes|confirm|proceed|ok|yeah|yep|sure|accept)$/i.test(lowerMessage)) {
      return { type: 'confirm' };
    }

    if (/^(no|cancel|stop|abort|decline|reject)$/i.test(lowerMessage)) {
      return { type: 'cancel' };
    }

    // Balance
    if (/balance|how much/i.test(lowerMessage)) {
      return { type: 'balance' };
    }

    // Account/Address
    if (/account|address|wallet|my address/i.test(lowerMessage)) {
      return { type: 'account' };
    }

    // History
    if (/history|transactions|past|previous/i.test(lowerMessage)) {
      return { type: 'history', limit: 5 };
    }

    // Help
    if (/help|what can|how do|commands/i.test(lowerMessage)) {
      return { type: 'help' };
    }

    // Send (look for amount and phone number)
    const sendMatch = message.match(/send|pay|transfer/i);
    if (sendMatch) {
      const amountMatch = message.match(/\$?(\d+(?:\.\d{1,2})?)/);
      const phoneMatch = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

      if (amountMatch && phoneMatch) {
        return {
          type: 'send',
          amount: amountMatch[1],
          recipient: phoneMatch[0],
          currency: 'PYUSD',
        };
      }
    }

    // Request
    const requestMatch = message.match(/request|ask|get/i);
    if (requestMatch) {
      const amountMatch = message.match(/\$?(\d+(?:\.\d{1,2})?)/);
      const phoneMatch = message.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

      if (amountMatch && phoneMatch) {
        return {
          type: 'request',
          amount: amountMatch[1],
          from: phoneMatch[0],
          currency: 'PYUSD',
        };
      }
    }

    return {
      type: 'unknown',
      originalMessage: message,
    };
  }

  /**
   * Generate a friendly response message
   */
  async generateResponse(context: {
    intent: UserIntent;
    userBalance?: string;
    transactionHistory?: any[];
    error?: string;
  }): Promise<string> {
    if (!this.client) {
      return this.fallbackResponse(context);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a friendly WhatsApp assistant for a PYUSD payment system.
Generate concise, helpful responses using WhatsApp-friendly formatting with emojis.
Keep messages short and clear. Use bullet points and emojis appropriately.`,
          },
          {
            role: 'user',
            content: JSON.stringify(context),
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      return completion.choices[0]?.message?.content || this.fallbackResponse(context);
    } catch (error) {
      console.error('Error generating response with OpenAI:', error);
      return this.fallbackResponse(context);
    }
  }

  /**
   * Fallback response generator
   */
  private fallbackResponse(context: {
    intent: UserIntent;
    userBalance?: string;
    transactionHistory?: any[];
    error?: string;
  }): string {
    if (context.error) {
      return `❌ ${context.error}`;
    }

    const { intent } = context;

    switch (intent.type) {
      case 'balance':
        return `💰 *Your Balance*\n\nPYUSD: ${context.userBalance || '0.00'}`;

      case 'history':
        return `📝 *Transaction History*\n\n${context.transactionHistory?.length || 0} recent transactions`;

      case 'help':
        return `👋 *Welcome to PYUSD Wallet!*\n\nYou can:\n• Send PYUSD to any phone number\n• Check your balance\n• View transaction history\n\nJust chat naturally and I'll help you!`;

      case 'unknown':
        return `I didn't understand that. Try:\n• "Send $10 to +1234567890"\n• "What's my balance?"\n• "Show transaction history"`;

      default:
        return 'Processing your request...';
    }
  }
}

export const openaiService = new OpenAIService();
