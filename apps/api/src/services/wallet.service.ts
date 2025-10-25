import { ethers } from 'ethers';
import { config } from '../config';
import { db, users } from '../db';
import { eq } from 'drizzle-orm';

/**
 * Wallet service - manages Ethereum wallets for phone numbers
 * Each phone number gets a deterministic wallet derived from a master seed
 */
export class WalletService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
  }

  /**
   * Get or create wallet for a phone number
   * Uses deterministic wallet generation based on phone number
   */
  async getOrCreateWallet(userId: string, phoneNumber: string): Promise<{
    address: string;
    wallet: ethers.Wallet;
  }> {
    // Check if user already has a wallet
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser?.walletAddress) {
      // Load existing wallet
      const privateKey = await this.getPrivateKeyForUser(userId, phoneNumber);
      const wallet = new ethers.Wallet(privateKey, this.provider);
      return {
        address: existingUser.walletAddress,
        wallet,
      };
    }

    // Create new wallet deterministically from phone number
    const privateKey = await this.generatePrivateKeyForPhone(phoneNumber);
    const wallet = new ethers.Wallet(privateKey, this.provider);

    // Store wallet address in database
    await db
      .update(users)
      .set({
        walletAddress: wallet.address,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      address: wallet.address,
      wallet,
    };
  }

  /**
   * Normalize phone number to E.164 format (international standard)
   * This ensures consistent wallet generation regardless of input format
   *
   * Examples:
   * - +1 (234) 567-8900 -> +12345678900
   * - 234-567-8900 -> +12345678900 (assumes US if no country code)
   * - +44 20 1234 5678 -> +442012345678
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Remove any + that's not at the start
    cleaned = cleaned.replace(/(?!^)\+/g, '');

    // If it starts with +, keep it as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // If it starts with 00 (international prefix), replace with +
    if (cleaned.startsWith('00')) {
      return '+' + cleaned.substring(2);
    }

    // If no country code and length is 10, assume US (+1)
    if (cleaned.length === 10) {
      return '+1' + cleaned;
    }

    // If no country code and length is 11 starting with 1, it's US
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return '+' + cleaned;
    }

    // Otherwise add + if not present
    return '+' + cleaned;
  }

  /**
   * Generate a deterministic private key for a phone number
   * WARNING: In production, use a more secure key derivation with proper encryption
   */
  private async generatePrivateKeyForPhone(phoneNumber: string): Promise<string> {
    // Normalize phone number to ensure consistency
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Create a deterministic seed from phone number + encryption key
    const seed = ethers.id(`${config.security.encryptionKey}:${normalizedPhone}`);

    // Use the hash as a private key
    return seed;
  }

  /**
   * Get private key for existing user
   */
  private async getPrivateKeyForUser(_userId: string, phoneNumber: string): Promise<string> {
    // For now, regenerate from phone number (same as generation)
    // In production, you'd want to encrypt and store this securely
    return this.generatePrivateKeyForPhone(phoneNumber);
  }

  /**
   * Get PYUSD balance for an address
   */
  async getPYUSDBalance(address: string): Promise<string> {
    try {
      // Check if PYUSD address is configured (not zero address)
      if (!config.blockchain.pyusdAddress ||
          config.blockchain.pyusdAddress === '0x0000000000000000000000000000000000000000') {
        console.warn('PYUSD address not configured, returning 0 balance');
        return '0.00';
      }

      const tokenContract = new ethers.Contract(
        config.blockchain.pyusdAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)',
        ],
        this.provider
      );

      const balance = await tokenContract.balanceOf(address);
      const decimals = await tokenContract.decimals();

      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.warn('Error getting PYUSD balance (this is normal for testnet):', error instanceof Error ? error.message : error);
      return '0.00';
    }
  }

  /**
   * Get native ETH balance (for gas)
   */
  async getETHBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting ETH balance:', error);
      return '0.00';
    }
  }

  /**
   * Send PYUSD from one wallet to another
   */
  async sendPYUSD(params: {
    fromWallet: ethers.Wallet;
    toAddress: string;
    amount: string;
  }): Promise<{
    txHash: string;
    receipt: ethers.TransactionReceipt;
  }> {
    const { fromWallet, toAddress, amount } = params;

    // Get PYUSD token contract
    const tokenContract = new ethers.Contract(
      config.blockchain.pyusdAddress,
      [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ],
      fromWallet
    );

    const decimals = await tokenContract.decimals();
    const amountInWei = ethers.parseUnits(amount, decimals);

    // Send transaction
    const tx = await tokenContract.transfer(toAddress, amountInWei);

    // Wait for confirmation
    const receipt = await tx.wait();

    return {
      txHash: tx.hash,
      receipt,
    };
  }

  /**
   * Check if address has enough balance
   */
  async hasEnoughBalance(address: string, amount: string): Promise<boolean> {
    const balance = await this.getPYUSDBalance(address);
    return parseFloat(balance) >= parseFloat(amount);
  }

  /**
   * Check if address has enough ETH for gas
   */
  async hasEnoughGas(address: string): Promise<boolean> {
    const ethBalance = await this.getETHBalance(address);
    // Require at least 0.001 ETH for gas
    return parseFloat(ethBalance) >= 0.001;
  }

  /**
   * Format address for display (shorten middle)
   */
  formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Get wallet info for a user
   */
  async getWalletInfo(userId: string, phoneNumber: string): Promise<{
    address: string;
    pyusdBalance: string;
    ethBalance: string;
    formattedAddress: string;
  }> {
    const { address } = await this.getOrCreateWallet(userId, phoneNumber);

    const [pyusdBalance, ethBalance] = await Promise.all([
      this.getPYUSDBalance(address),
      this.getETHBalance(address),
    ]);

    return {
      address,
      pyusdBalance,
      ethBalance,
      formattedAddress: this.formatAddress(address),
    };
  }

  /**
   * Get explorer URL for an address on Ethereum Sepolia
   */
  getAddressExplorerUrl(address: string): string {
    return `https://eth-sepolia.blockscout.com/address/${address}`;
  }

  /**
   * Get explorer URL for a transaction on Ethereum Sepolia
   */
  getTransactionExplorerUrl(txHash: string): string {
    return `https://eth-sepolia.blockscout.com/tx/${txHash}`;
  }
}

export const walletService = new WalletService();
