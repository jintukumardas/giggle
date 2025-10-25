import { randomBytes, pbkdf2Sync } from 'crypto';

/**
 * PIN Service - Handles secure PIN hashing and verification
 * Uses PBKDF2 for cryptographic security
 */
export class PinService {
  private readonly ITERATIONS = 100000;
  private readonly KEY_LENGTH = 64;
  private readonly DIGEST = 'sha512';

  /**
   * Hash a PIN securely using PBKDF2
   */
  hashPin(pin: string): string {
    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error('PIN must be 4-6 digits');
    }

    // Generate a random salt
    const salt = randomBytes(16).toString('hex');

    // Hash the PIN with the salt
    const hash = pbkdf2Sync(
      pin,
      salt,
      this.ITERATIONS,
      this.KEY_LENGTH,
      this.DIGEST
    ).toString('hex');

    // Return salt:hash format
    return `${salt}:${hash}`;
  }

  /**
   * Verify a PIN against a stored hash
   */
  verifyPin(pin: string, storedHash: string): boolean {
    try {
      // Validate PIN format
      if (!/^\d{4,6}$/.test(pin)) {
        return false;
      }

      // Split the stored hash into salt and hash
      const [salt, hash] = storedHash.split(':');
      if (!salt || !hash) {
        return false;
      }

      // Hash the provided PIN with the stored salt
      const verifyHash = pbkdf2Sync(
        pin,
        salt,
        this.ITERATIONS,
        this.KEY_LENGTH,
        this.DIGEST
      ).toString('hex');

      // Compare hashes in constant time to prevent timing attacks
      return this.constantTimeCompare(hash, verifyHash);
    } catch (error) {
      console.error('Error verifying PIN:', error);
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate PIN format without hashing
   */
  isValidPinFormat(pin: string): boolean {
    return /^\d{4,6}$/.test(pin);
  }

  /**
   * Generate a random 6-digit PIN (for testing/demo purposes)
   */
  generateRandomPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

export const pinService = new PinService();
