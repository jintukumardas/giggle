import { Command, CommandSchema } from '../types';
import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Parse a WhatsApp message into a structured command
 */
export function parseCommand(body: string): Command | null {
  const trimmed = body.trim().toLowerCase();

  // Link command
  if (trimmed === '/link' || trimmed === 'link') {
    return { type: 'link' };
  }

  // Help command
  if (trimmed === '/help' || trimmed === 'help') {
    return { type: 'help' };
  }

  // Balance command
  if (trimmed === '/balance' || trimmed === 'balance') {
    return { type: 'balance' };
  }

  // History command
  const historyMatch = trimmed.match(/^\/?(history|transactions?)(?:\s+(\d+))?$/);
  if (historyMatch) {
    return {
      type: 'history',
      limit: historyMatch[2] ? parseInt(historyMatch[2], 10) : 10,
    };
  }

  // Lock command
  if (trimmed === '/lock' || trimmed === 'lock') {
    return { type: 'lock' };
  }

  // Unlock command
  if (trimmed === '/unlock' || trimmed === 'unlock') {
    return { type: 'unlock' };
  }

  // Send command: "send 10 pyusd to +1234567890" or "send 10 pyusd to @alice"
  const sendMatch = trimmed.match(
    /^\/?\s*send\s+(\d+(?:\.\d+)?)\s+(pyusd|usdc)\s+to\s+(.+)$/
  );
  if (sendMatch) {
    return {
      type: 'send',
      amount: sendMatch[1],
      token: sendMatch[2] as 'pyusd' | 'usdc',
      recipient: sendMatch[3].trim(),
    };
  }

  // Request command: "request 5 usdc from @bob"
  const requestMatch = trimmed.match(
    /^\/?\s*request\s+(\d+(?:\.\d+)?)\s+(pyusd|usdc)\s+from\s+(.+)$/
  );
  if (requestMatch) {
    return {
      type: 'request',
      amount: requestMatch[1],
      token: requestMatch[2] as 'pyusd' | 'usdc',
      from: requestMatch[3].trim(),
    };
  }

  // Schedule command: "schedule 3 pyusd to @maya on friday 9am"
  const scheduleMatch = trimmed.match(
    /^\/?\s*schedule\s+(\d+(?:\.\d+)?)\s+(pyusd|usdc)\s+to\s+(.+?)\s+on\s+(.+)$/
  );
  if (scheduleMatch) {
    const scheduledFor = parseDateTime(scheduleMatch[4]);
    if (scheduledFor) {
      return {
        type: 'schedule',
        amount: scheduleMatch[1],
        token: scheduleMatch[2] as 'pyusd' | 'usdc',
        recipient: scheduleMatch[3].trim(),
        scheduledFor,
      };
    }
  }

  // Set limit command: "set limit 50/day" or "limit 50"
  const limitMatch = trimmed.match(/^\/?\s*(?:set\s+)?limit\s+(\d+(?:\.\d+)?)(?:\/(\w+))?$/);
  if (limitMatch) {
    return {
      type: 'setLimit',
      amount: parseFloat(limitMatch[1]),
      period: (limitMatch[2] as 'day' | 'week' | 'month') || 'day',
    };
  }

  return null;
}

/**
 * Parse natural language date/time expressions
 */
function parseDateTime(dateStr: string): Date | null {
  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  // Handle "friday 9am", "monday 3pm", etc.
  const dayTimeMatch = lower.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (dayTimeMatch) {
    const dayName = dayTimeMatch[1];
    const hour = parseInt(dayTimeMatch[2], 10);
    const minute = dayTimeMatch[3] ? parseInt(dayTimeMatch[3], 10) : 0;
    const ampm = dayTimeMatch[4];

    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = daysOfWeek.indexOf(dayName);
    const currentDay = now.getDay();

    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
      daysUntilTarget += 7; // Next occurrence
    }

    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntilTarget);

    let targetHour = hour;
    if (ampm === 'pm' && hour < 12) targetHour += 12;
    if (ampm === 'am' && hour === 12) targetHour = 0;

    targetDate.setHours(targetHour, minute, 0, 0);
    return targetDate;
  }

  // Handle "tomorrow 2pm"
  const tomorrowMatch = lower.match(/tomorrow\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (tomorrowMatch) {
    const hour = parseInt(tomorrowMatch[1], 10);
    const minute = tomorrowMatch[2] ? parseInt(tomorrowMatch[2], 10) : 0;
    const ampm = tomorrowMatch[3];

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    let targetHour = hour;
    if (ampm === 'pm' && hour < 12) targetHour += 12;
    if (ampm === 'am' && hour === 12) targetHour = 0;

    tomorrow.setHours(targetHour, minute, 0, 0);
    return tomorrow;
  }

  // Handle ISO format or other standard formats
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime()) && parsed > now) {
      return parsed;
    }
  } catch {
    // Ignore parsing errors
  }

  return null;
}

/**
 * Normalize recipient identifier (phone or alias)
 */
export function normalizeRecipient(recipient: string): { type: 'phone' | 'alias' | 'address'; value: string } {
  // Check if it's an Ethereum address
  if (/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    return { type: 'address', value: recipient.toLowerCase() };
  }

  // Check if it's an alias (@username)
  if (recipient.startsWith('@')) {
    return { type: 'alias', value: recipient.slice(1).toLowerCase() };
  }

  // Try to parse as phone number
  try {
    const parsed = parsePhoneNumber(recipient, 'US'); // Default to US, but it will detect other countries
    if (parsed && parsed.isValid()) {
      return { type: 'phone', value: parsed.format('E.164') };
    }
  } catch {
    // Not a valid phone number
  }

  // Assume it's an alias without @ prefix
  return { type: 'alias', value: recipient.toLowerCase() };
}

/**
 * Format a token amount for display
 */
export function formatTokenAmount(amount: string, token: string): string {
  const num = parseFloat(amount);
  return `${num.toFixed(2)} ${token.toUpperCase()}`;
}

/**
 * Validate command using Zod schema
 */
export function validateCommand(command: unknown): Command {
  return CommandSchema.parse(command);
}
