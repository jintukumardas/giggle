import { ethers } from 'ethers';
import { config } from '../config';
import { ipfsService, CouponMetadata } from './ipfs.service';
import { randomBytes } from 'crypto';

/**
 * Gift Coupon Service
 * Integrates with GiggleGiftCoupon smart contract and IPFS
 */

// ABI for GiggleGiftCoupon contract
const GIFT_COUPON_ABI = [
  "function createCoupon(string code, address token, uint256 amount, string metadataURI, uint256 expiresAt) returns (uint256)",
  "function redeemCoupon(string code)",
  "function checkCoupon(string code) view returns (bool exists, bool isValid, address token, uint256 amount, string metadataURI, uint256 expiresAt, address creator)",
  "function cancelCoupon(uint256 couponId)",
  "function supportedTokens(address) view returns (bool)",
  "event CouponCreated(uint256 indexed couponId, address indexed creator, address token, uint256 amount, string metadataURI, uint256 expiresAt)",
  "event CouponRedeemed(uint256 indexed couponId, address indexed redeemer, uint256 amount, uint256 redeemedAt)"
];

export interface CreateCouponParams {
  wallet: ethers.Wallet;
  amount: string;
  token: 'PYUSD';
  message?: string;
  creatorPhone?: string;
  expiryDays?: number; // 0 = no expiry
}

export interface CouponInfo {
  exists: boolean;
  isValid: boolean;
  amount: string;
  token: string;
  metadata: CouponMetadata | null;
  expiresAt: Date | null;
  creator: string;
}

export class GiftCouponService {
  private provider: ethers.JsonRpcProvider;
  private contractAddress: string;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.contractAddress = config.giftCoupon.contractAddress;
  }

  /**
   * Generate a unique coupon code
   */
  private generateCouponCode(): string {
    const bytes = randomBytes(4);
    const code = bytes.toString('hex').toUpperCase();
    return `GIFT${code}`;
  }

  /**
   * Get token address (PYUSD only)
   */
  private getTokenAddress(): string {
    return config.blockchain.pyusdAddress;
  }

  /**
   * Create a new gift coupon
   */
  async createCoupon(params: CreateCouponParams): Promise<{
    code: string;
    couponId: string;
    txHash: string;
    metadataURI: string;
  }> {
    const { wallet, amount, token, message, creatorPhone, expiryDays = 0 } = params;

    // Generate unique code
    const code = this.generateCouponCode();

    // Calculate expiration
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
      : null;

    // Create metadata
    const metadata: CouponMetadata = {
      title: 'Giggle Pay Gift Coupon',
      description: `$${amount} ${token} Gift`,
      amount,
      token,
      message,
      creatorPhone,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString(),
    };

    // Upload to IPFS
    const metadataURI = await ipfsService.uploadCouponMetadata(metadata);

    // Get contract
    const contract = new ethers.Contract(
      this.contractAddress,
      GIFT_COUPON_ABI,
      wallet
    );

    // Get token address (PYUSD only)
    const tokenAddress = this.getTokenAddress();

    // Convert amount to wei (assuming 6 decimals for PYUSD)
    const amountWei = ethers.parseUnits(amount, 6);

    // Calculate expiration timestamp
    const expirationTimestamp = expiresAt
      ? Math.floor(expiresAt.getTime() / 1000)
      : 0;

    // First, approve token transfer
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      wallet
    );

    console.log('Approving token transfer...');
    const approveTx = await tokenContract.approve(this.contractAddress, amountWei);
    await approveTx.wait();

    // Create coupon on-chain
    console.log('Creating coupon on-chain...');
    const tx = await contract.createCoupon(
      code,
      tokenAddress,
      amountWei,
      metadataURI,
      expirationTimestamp
    );

    const receipt = await tx.wait();

    // Extract coupon ID from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'CouponCreated';
      } catch {
        return false;
      }
    });

    const couponId = event
      ? contract.interface.parseLog(event)?.args[0].toString()
      : '0';

    return {
      code,
      couponId,
      txHash: receipt.hash,
      metadataURI,
    };
  }

  /**
   * Redeem a gift coupon
   */
  async redeemCoupon(code: string, wallet: ethers.Wallet): Promise<{
    amount: string;
    token: string;
    txHash: string;
    metadata: CouponMetadata;
  }> {
    // First, check if coupon is valid
    const info = await this.checkCoupon(code);

    if (!info.exists) {
      throw new Error('Coupon code not found');
    }

    if (!info.isValid) {
      throw new Error('Coupon is not valid (already redeemed or expired)');
    }

    // Get contract
    const contract = new ethers.Contract(
      this.contractAddress,
      GIFT_COUPON_ABI,
      wallet
    );

    // Redeem coupon
    console.log('Redeeming coupon...');
    const tx = await contract.redeemCoupon(code);
    const receipt = await tx.wait();

    return {
      amount: info.amount,
      token: info.token,
      txHash: receipt.hash,
      metadata: info.metadata!,
    };
  }

  /**
   * Check coupon status
   */
  async checkCoupon(code: string): Promise<CouponInfo> {
    const contract = new ethers.Contract(
      this.contractAddress,
      GIFT_COUPON_ABI,
      this.provider
    );

    const [exists, isValid, _tokenAddress, amountWei, metadataURI, expiresAtTimestamp, creator] =
      await contract.checkCoupon(code);

    if (!exists) {
      return {
        exists: false,
        isValid: false,
        amount: '0',
        token: '',
        metadata: null,
        expiresAt: null,
        creator: '',
      };
    }

    // Only PYUSD is supported
    const token = 'PYUSD';

    // Convert amount from wei
    const amount = ethers.formatUnits(amountWei, 6);

    // Get metadata from IPFS
    let metadata: CouponMetadata | null = null;
    try {
      metadata = await ipfsService.getCouponMetadata(metadataURI);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }

    // Convert expiration timestamp
    const expiresAt = expiresAtTimestamp > 0
      ? new Date(Number(expiresAtTimestamp) * 1000)
      : null;

    return {
      exists,
      isValid,
      amount,
      token,
      metadata,
      expiresAt,
      creator,
    };
  }

  /**
   * Check if contract is deployed and configured
   */
  async isConfigured(): Promise<boolean> {
    if (!this.contractAddress || this.contractAddress === '') {
      return false;
    }

    try {
      const contract = new ethers.Contract(
        this.contractAddress,
        GIFT_COUPON_ABI,
        this.provider
      );

      // Check if PYUSD is supported
      const pyusdSupported = await contract.supportedTokens(config.blockchain.pyusdAddress);
      return pyusdSupported;
    } catch (error) {
      console.error('Gift coupon contract not configured:', error);
      return false;
    }
  }
}

export const giftCouponService = new GiftCouponService();
