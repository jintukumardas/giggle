import { config } from '../config';

interface BlockscoutTransaction {
  hash: string;
  block_number: number;
  from: string;
  to: string;
  value: string;
  gas_used: string;
  status: string;
  timestamp: string;
}

export class BlockscoutService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.blockscout.apiUrl;
  }

  /**
   * Get transaction details from Blockscout
   */
  async getTransaction(txHash: string): Promise<BlockscoutTransaction | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=transaction&action=gettxinfo&txhash=${txHash}`
      );

      const data = await response.json();

      if (data.status === '1' && data.result) {
        return data.result as BlockscoutTransaction;
      }

      return null;
    } catch (error) {
      console.error('Error fetching transaction from Blockscout:', error);
      return null;
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txHash: string): Promise<'pending' | 'confirmed' | 'failed'> {
    try {
      const response = await fetch(
        `${this.baseUrl}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}`
      );

      const data = await response.json();

      if (data.status === '1' && data.result) {
        return data.result.status === '1' ? 'confirmed' : 'failed';
      }

      return 'pending';
    } catch (error) {
      console.error('Error fetching transaction status from Blockscout:', error);
      return 'pending';
    }
  }

  /**
   * Get Blockscout URL for a transaction
   */
  getTransactionUrl(txHash: string): string {
    // Extract base domain from API URL
    const baseDomain = this.baseUrl.replace('/api', '');
    return `${baseDomain}/tx/${txHash}`;
  }

  /**
   * Get Blockscout URL for an address
   */
  getAddressUrl(address: string): string {
    const baseDomain = this.baseUrl.replace('/api', '');
    return `${baseDomain}/address/${address}`;
  }

  /**
   * Get token transfers for an address
   */
  async getTokenTransfers(
    address: string,
    tokenAddress?: string,
    limit: number = 10
  ): Promise<any[]> {
    try {
      let url = `${this.baseUrl}?module=account&action=tokentx&address=${address}&sort=desc`;

      if (tokenAddress) {
        url += `&contractaddress=${tokenAddress}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === '1' && data.result) {
        return data.result.slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error('Error fetching token transfers from Blockscout:', error);
      return [];
    }
  }

  /**
   * Format transaction confirmation message with Blockscout link
   */
  formatConfirmationWithLink(
    txHash: string,
    blockNumber?: number,
    gasUsed?: string
  ): string {
    let message = `Transaction confirmed!\n\n`;

    if (blockNumber) {
      message += `Block: ${blockNumber}\n`;
    }

    if (gasUsed) {
      message += `Gas used: ${gasUsed}\n`;
    }

    message += `\n🔍 View on Blockscout:\n${this.getTransactionUrl(txHash)}`;

    return message;
  }
}

export const blockscoutService = new BlockscoutService();
