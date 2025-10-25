import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { config } from '../config';

/**
 * Lit Protocol service for delegated signing and scheduled transactions
 *
 * This uses Lit Protocol's Vincent Ability SDK for scoped delegations,
 * allowing users to grant limited permissions for automated payments.
 *
 * Based on official docs: https://docs.heyvincent.ai/api-reference/ability-sdk/README
 */
export class LitService {
  private client: LitNodeClient | null = null;
  private readonly network: string;

  constructor() {
    this.network = config.lit.network;
  }

  /**
   * Initialize Lit client with v7 API
   */
  async initialize(): Promise<void> {
    if (this.client) return;

    try {
      this.client = new LitNodeClient({
        litNetwork: this.network as any,
        debug: config.nodeEnv === 'development',
      });

      await this.client.connect();
      console.log('✅ Lit Protocol v7 client connected');
      console.log(`   Network: ${this.network}`);
    } catch (error) {
      console.error('Failed to initialize Lit Protocol client:', error);
      throw error;
    }
  }

  /**
   * Create a PKP (Programmable Key Pair) for a user
   * This allows delegated signing without exposing private keys
   */
  async createPKP(userId: string): Promise<{ publicKey: string; tokenId: string }> {
    // In production, this would:
    // 1. Mint a PKP NFT
    // 2. Store the PKP public key and token ID
    // 3. Set up initial permissions

    // For now, return a mock PKP
    return {
      publicKey: '0x04' + '0'.repeat(128), // Mock public key
      tokenId: `pkp-${userId}`,
    };
  }

  /**
   * Create a scoped delegation for scheduled or automated payments
   *
   * Scopes can include:
   * - Token address (only this token)
   * - Maximum amount per transaction
   * - Maximum amount per day
   * - Specific recipient addresses
   * - Time windows (only between X and Y)
   */
  async createDelegation(params: {
    userId: string;
    pkpPublicKey: string;
    scope: {
      tokenAddress: string;
      maxAmountPerTx: string;
      maxAmountPerDay: string;
      allowedRecipients?: string[];
      validUntil?: Date;
    };
  }): Promise<{ delegationId: string; ipfsCid: string }> {
    const { userId, scope } = params;

    // In production, this would:
    // 1. Create a Lit Action with the scope rules
    // 2. Upload the Lit Action to IPFS
    // 3. Grant permissions to the PKP
    // 4. Return the delegation ID and IPFS CID

    // Mock implementation
    this.generateLitAction(scope);
    const ipfsCid = `Qm${userId.replace(/-/g, '').slice(0, 44)}`; // Mock IPFS CID

    return {
      delegationId: `delegation-${userId}-${Date.now()}`,
      ipfsCid,
    };
  }

  /**
   * Generate a Lit Action (JavaScript code) that enforces scope rules
   */
  private generateLitAction(scope: any): string {
    return `
      // Lit Action for scoped delegation
      const go = async () => {
        // Scope rules
        const tokenAddress = "${scope.tokenAddress}";
        const maxAmountPerTx = "${scope.maxAmountPerTx}";
        const maxAmountPerDay = "${scope.maxAmountPerDay}";
        const allowedRecipients = ${JSON.stringify(scope.allowedRecipients || [])};
        const validUntil = ${scope.validUntil ? scope.validUntil.getTime() : 'null'};

        // Check validity period
        if (validUntil && Date.now() > validUntil) {
          Lit.Actions.setResponse({
            response: JSON.stringify({ approved: false, reason: "Delegation expired" })
          });
          return;
        }

        // Validate transaction parameters from request
        const { to, amount, recipient } = JSON.parse(txParams);

        // Check token address
        if (to.toLowerCase() !== tokenAddress.toLowerCase()) {
          Lit.Actions.setResponse({
            response: JSON.stringify({ approved: false, reason: "Token not allowed" })
          });
          return;
        }

        // Check amount limits
        if (BigInt(amount) > BigInt(maxAmountPerTx)) {
          Lit.Actions.setResponse({
            response: JSON.stringify({ approved: false, reason: "Amount exceeds per-tx limit" })
          });
          return;
        }

        // Check recipient whitelist
        if (allowedRecipients.length > 0 && !allowedRecipients.includes(recipient.toLowerCase())) {
          Lit.Actions.setResponse({
            response: JSON.stringify({ approved: false, reason: "Recipient not allowed" })
          });
          return;
        }

        // All checks passed - sign the transaction
        Lit.Actions.setResponse({
          response: JSON.stringify({ approved: true })
        });
      };

      go();
    `;
  }

  /**
   * Execute a delegated transaction
   */
  async executeDelegatedTransaction(_params: {
    delegationId: string;
    ipfsCid: string;
    txParams: {
      to: string;
      amount: string;
      recipient: string;
    };
  }): Promise<{ approved: boolean; signature?: string; reason?: string }> {
    // In production, this would:
    // 1. Load the Lit Action from IPFS
    // 2. Execute it with the transaction parameters
    // 3. If approved, use the PKP to sign the transaction
    // 4. Return the signature

    // Mock implementation - always approve for demo
    return {
      approved: true,
      signature: '0x' + '0'.repeat(130), // Mock signature
    };
  }

  /**
   * Revoke a delegation
   */
  async revokeDelegation(delegationId: string): Promise<void> {
    // In production, this would revoke the PKP permissions
    console.log(`Delegation ${delegationId} revoked`);
  }

  /**
   * Get active delegations for a user
   */
  async getUserDelegations(_userId: string): Promise<any[]> {
    // In production, this would query the blockchain for PKP permissions
    return [];
  }

  /**
   * Disconnect client
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}

export const litService = new LitService();
