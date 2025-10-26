import axios from 'axios';
import { config } from '../config';

/**
 * Pinata IPFS Service
 * Handles uploading coupon metadata to IPFS via Pinata
 */

export interface CouponMetadata {
  title: string;
  description: string;
  amount: string;
  token: string;
  message?: string;
  creatorPhone?: string;
  image?: string; // Optional image URL
  createdAt: string;
  expiresAt?: string;
}

export class IPFSService {
  private readonly pinataApiKey: string;
  private readonly pinataSecretKey: string;
  private readonly pinataGateway: string;

  constructor() {
    this.pinataApiKey = config.pinata?.apiKey || '';
    this.pinataSecretKey = config.pinata?.secretKey || '';
    this.pinataGateway = config.pinata?.gateway || 'https://gateway.pinata.cloud';
  }

  /**
   * Upload coupon metadata to IPFS
   */
  async uploadCouponMetadata(metadata: CouponMetadata): Promise<string> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.warn('Pinata credentials not configured, using mock IPFS');
      // For development: return a mock CID
      return `mock://ipfs/${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
    }

    try {
      const data = JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `Giggle Gift Coupon - $${metadata.amount} ${metadata.token}`,
          keyvalues: {
            type: 'gift-coupon',
            token: metadata.token,
            amount: metadata.amount,
          },
        },
      });

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            pinata_api_key: this.pinataApiKey,
            pinata_secret_api_key: this.pinataSecretKey,
          },
        }
      );

      const ipfsHash = response.data.IpfsHash;
      return `ipfs://${ipfsHash}`;
    } catch (error) {
      console.error('Error uploading to Pinata:', error);
      throw new Error('Failed to upload metadata to IPFS');
    }
  }

  /**
   * Get metadata from IPFS
   */
  async getCouponMetadata(ipfsUri: string): Promise<CouponMetadata> {
    try {
      // Handle mock URIs for development
      if (ipfsUri.startsWith('mock://ipfs/')) {
        const base64Data = ipfsUri.replace('mock://ipfs/', '');
        const jsonStr = Buffer.from(base64Data, 'base64').toString('utf-8');
        return JSON.parse(jsonStr);
      }

      // Convert ipfs:// to HTTP gateway URL
      const ipfsHash = ipfsUri.replace('ipfs://', '');
      const url = `${this.pinataGateway}/ipfs/${ipfsHash}`;

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching from IPFS:', error);
      throw new Error('Failed to fetch metadata from IPFS');
    }
  }

  /**
   * Get HTTP URL for IPFS content
   */
  getHttpUrl(ipfsUri: string): string {
    if (ipfsUri.startsWith('mock://ipfs/')) {
      return ipfsUri;
    }

    const ipfsHash = ipfsUri.replace('ipfs://', '');
    return `${this.pinataGateway}/ipfs/${ipfsHash}`;
  }

  /**
   * Test Pinata connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.pinataApiKey || !this.pinataSecretKey) {
      console.log('Pinata not configured, using mock mode');
      return true;
    }

    try {
      await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: {
          pinata_api_key: this.pinataApiKey,
          pinata_secret_api_key: this.pinataSecretKey,
        },
      });
      console.log('✓ Pinata connection successful');
      return true;
    } catch (error) {
      console.error('✗ Pinata connection failed:', error);
      return false;
    }
  }
}

export const ipfsService = new IPFSService();
