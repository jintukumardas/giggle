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
  private readonly pinataJwt: string;
  private readonly pinataGateway: string;

  constructor() {
    this.pinataJwt = config.pinata?.jwt || '';
    this.pinataGateway = config.pinata?.gateway || '';

    if (this.pinataJwt && !this.pinataGateway) {
      console.warn('⚠️  PINATA_GATEWAY not configured. IPFS content retrieval will fail.');
    }
  }

  /**
   * Upload coupon metadata to IPFS
   */
  async uploadCouponMetadata(metadata: CouponMetadata): Promise<string> {
    if (!this.pinataJwt) {
      console.warn('Pinata JWT not configured, using mock IPFS');
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
            'Authorization': `Bearer ${this.pinataJwt}`,
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

      if (!this.pinataGateway) {
        throw new Error('PINATA_GATEWAY not configured. Cannot retrieve IPFS content.');
      }

      // Convert ipfs:// to HTTP gateway URL using ONLY the configured gateway
      const ipfsHash = ipfsUri.replace('ipfs://', '');
      const url = `https://${this.pinataGateway}/ipfs/${ipfsHash}`;

      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching from IPFS:', error);
      throw new Error('Failed to fetch metadata from IPFS');
    }
  }

  /**
   * Get HTTP URL for IPFS content using ONLY the configured Pinata gateway
   */
  getHttpUrl(ipfsUri: string): string {
    if (ipfsUri.startsWith('mock://ipfs/')) {
      return ipfsUri;
    }

    if (!this.pinataGateway) {
      throw new Error('PINATA_GATEWAY not configured. Cannot generate IPFS URL.');
    }

    const ipfsHash = ipfsUri.replace('ipfs://', '');
    return `https://${this.pinataGateway}/ipfs/${ipfsHash}`;
  }

  /**
   * Test Pinata connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.pinataJwt) {
      console.log('Pinata JWT not configured, using mock mode');
      return true;
    }

    try {
      await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: {
          'Authorization': `Bearer ${this.pinataJwt}`,
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
