/**
 * ASI Alliance Agent for Giggle
 *
 * This agent provides:
 * 1. Recipient resolution (phone/alias -> address)
 * 2. Compliance guardrails (enforce limits and rules)
 * 3. Scheduled payment triggers
 * 4. Natural language intent parsing enhancements
 *
 * For the hackathon, this is a simplified implementation.
 * In production, this would use Fetch.ai's uAgents framework
 * and potentially MeTTa for knowledge representation.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Agent configuration
const AGENT_CONFIG = {
  name: 'Giggle Payment Agent',
  version: '1.0.0',
  capabilities: ['resolution', 'guardrails', 'scheduling', 'nlp'],
};

// Schemas
const ResolveRecipientSchema = z.object({
  recipient: z.string(),
  userId: z.string(),
  context: z.record(z.any()).optional(),
});

const EnforceLimitsSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  token: z.string(),
  dailySpent: z.number(),
  dailyLimit: z.number(),
});

const ScheduleTriggerSchema = z.object({
  intentId: z.string(),
  scheduledFor: z.string(), // ISO date
  currentTime: z.string(), // ISO date
});

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    agent: AGENT_CONFIG.name,
    version: AGENT_CONFIG.version,
    capabilities: AGENT_CONFIG.capabilities,
  });
});

/**
 * Resolve recipient to Ethereum address
 *
 * This agent can:
 * - Look up aliases in address book
 * - Resolve phone numbers to addresses
 * - Query ENS or other name services
 * - Use social graph data to find contacts
 */
app.post('/resolve', async (req: Request, res: Response) => {
  try {
    const { recipient, userId, context } = ResolveRecipientSchema.parse(req.body);

    // In production, this would:
    // 1. Query user's address book
    // 2. Query decentralized identity protocols
    // 3. Use social graph APIs
    // 4. Apply ML for fuzzy matching

    // For demo, return mock resolution
    const mockResolutions: Record<string, string> = {
      'alice': '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      'bob': '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      'maya': '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    };

    const normalized = recipient.toLowerCase().replace('@', '');
    const address = mockResolutions[normalized];

    if (address) {
      res.json({
        success: true,
        address,
        confidence: 1.0,
        source: 'address_book',
      });
    } else {
      res.json({
        success: false,
        error: 'Recipient not found',
        suggestions: Object.keys(mockResolutions),
      });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * Enforce compliance guardrails
 *
 * This agent checks:
 * - Daily spending limits
 * - Per-transaction limits
 * - Risk-based rules (e.g., new recipient, large amount)
 * - Regulatory requirements
 * - Fraud detection patterns
 */
app.post('/guardrails', async (req: Request, res: Response) => {
  try {
    const { userId, amount, token, dailySpent, dailyLimit } = EnforceLimitsSchema.parse(req.body);

    // Check daily limit
    if (dailySpent + amount > dailyLimit) {
      res.json({
        allowed: false,
        reason: 'daily_limit_exceeded',
        details: {
          dailySpent,
          dailyLimit,
          requested: amount,
          remaining: Math.max(0, dailyLimit - dailySpent),
        },
      });
      return;
    }

    // Check per-transaction limit (e.g., $500)
    const MAX_PER_TX = 500;
    if (amount > MAX_PER_TX) {
      res.json({
        allowed: false,
        reason: 'per_transaction_limit_exceeded',
        details: {
          maxPerTx: MAX_PER_TX,
          requested: amount,
        },
      });
      return;
    }

    // Risk-based checks
    const riskScore = calculateRiskScore(amount, dailySpent, dailyLimit);

    if (riskScore > 0.8) {
      res.json({
        allowed: false,
        reason: 'high_risk_transaction',
        details: {
          riskScore,
          recommendation: 'Please verify this transaction',
        },
      });
      return;
    }

    // All checks passed
    res.json({
      allowed: true,
      riskScore,
      checks: {
        dailyLimit: 'passed',
        perTxLimit: 'passed',
        riskAssessment: riskScore < 0.5 ? 'low' : 'medium',
      },
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * Calculate risk score for a transaction
 */
function calculateRiskScore(amount: number, dailySpent: number, dailyLimit: number): number {
  // Simple risk scoring model
  const limitUtilization = (dailySpent + amount) / dailyLimit;
  const amountRatio = amount / dailyLimit;

  // Weight factors
  const score = limitUtilization * 0.5 + amountRatio * 0.5;

  return Math.min(1, score);
}

/**
 * Check if scheduled payment should be triggered
 *
 * This agent implements scheduling logic with:
 * - Time-based triggers
 * - Conditional triggers (e.g., "if ETH price < $2000")
 * - Recurring payments
 * - Holiday/weekend handling
 */
app.post('/schedule', async (req: Request, res: Response) => {
  try {
    const { intentId, scheduledFor, currentTime } = ScheduleTriggerSchema.parse(req.body);

    const scheduled = new Date(scheduledFor);
    const now = new Date(currentTime);

    // Check if it's time to execute
    if (now >= scheduled) {
      // Check for holidays or weekends (skip in demo)
      const isWeekend = now.getDay() === 0 || now.getDay() === 6;

      if (isWeekend) {
        // Move to next business day
        const nextBusinessDay = new Date(now);
        nextBusinessDay.setDate(now.getDate() + (now.getDay() === 6 ? 2 : 1));

        res.json({
          shouldExecute: false,
          reason: 'weekend_skip',
          rescheduledFor: nextBusinessDay.toISOString(),
        });
        return;
      }

      res.json({
        shouldExecute: true,
        intentId,
        triggeredAt: now.toISOString(),
      });
    } else {
      res.json({
        shouldExecute: false,
        reason: 'not_yet_due',
        timeRemaining: scheduled.getTime() - now.getTime(),
      });
    }
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * Natural language processing endpoint
 * Enhances command parsing with ML-based intent recognition
 */
app.post('/nlp', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    // In production, this would use:
    // - SingularityNET's NLP services
    // - Custom ML models for intent classification
    // - Entity extraction for amounts, recipients, dates

    // For demo, simple pattern matching
    const intents = detectIntents(text);

    res.json({
      text,
      intents,
      confidence: intents.length > 0 ? 0.85 : 0.2,
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request' });
  }
});

/**
 * Simple intent detection
 */
function detectIntents(text: string): Array<{ type: string; entities: any }> {
  const lower = text.toLowerCase();
  const intents: Array<{ type: string; entities: any }> = [];

  // Send intent
  if (/send|pay|transfer/.test(lower)) {
    const amountMatch = lower.match(/(\d+(?:\.\d+)?)\s*(pyusd|usdc|dollars?)/);
    const recipientMatch = lower.match(/to\s+(@?\w+|\+[\d\s-]+)/);

    intents.push({
      type: 'send',
      entities: {
        amount: amountMatch?.[1],
        token: amountMatch?.[2],
        recipient: recipientMatch?.[1],
      },
    });
  }

  // Request intent
  if (/request|ask for/.test(lower)) {
    intents.push({ type: 'request', entities: {} });
  }

  // Balance intent
  if (/balance|how much/.test(lower)) {
    intents.push({ type: 'balance', entities: {} });
  }

  return intents;
}

/**
 * Agent information endpoint
 */
app.get('/info', (req: Request, res: Response) => {
  res.json({
    ...AGENT_CONFIG,
    description: 'AI agent for payment automation and compliance',
    endpoints: {
      resolve: 'POST /resolve - Resolve recipient identifiers',
      guardrails: 'POST /guardrails - Enforce compliance rules',
      schedule: 'POST /schedule - Check scheduled payment triggers',
      nlp: 'POST /nlp - Natural language processing',
    },
    technologies: [
      'Fetch.ai uAgents (conceptual)',
      'SingularityNET (conceptual)',
      'MeTTa knowledge graphs (planned)',
    ],
  });
});

// Start server
const PORT = process.env.AGENT_PORT || 3001;

app.listen(PORT, () => {
  console.log('');
  console.log('🤖 ASI Alliance Agent - Giggle');
  console.log('='.repeat(50));
  console.log(`Agent: ${AGENT_CONFIG.name}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Capabilities: ${AGENT_CONFIG.capabilities.join(', ')}`);
  console.log('='.repeat(50));
  console.log('');
});

export default app;
