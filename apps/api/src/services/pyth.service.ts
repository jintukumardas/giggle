import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { config } from '../config';

/**
 * Pyth Network Price Feed Service
 *
 * Integration based on official docs:
 * https://docs.pyth.network/price-feeds/create-your-first-pyth-app/evm/part-1
 */

// Pyth price feed IDs for common pairs
// Official price feed IDs from https://pyth.network/developers/price-feed-ids
const PRICE_FEED_IDS = {
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'PYUSD/USD': '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder - update with actual feed ID
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
};

export class PythService {
  private readonly endpoint: string;
  private readonly connection: EvmPriceServiceConnection;

  constructor() {
    this.endpoint = config.pyth.endpoint;
    // Initialize Pyth EVM price service connection
    this.connection = new EvmPriceServiceConnection(this.endpoint);
    console.log('✅ Pyth Network price service initialized');
    console.log(`   Endpoint: ${this.endpoint}`);
  }

  /**
   * Get latest price for a trading pair using official Pyth SDK
   */
  async getPrice(pair: string): Promise<number | null> {
    try {
      const feedId = PRICE_FEED_IDS[pair as keyof typeof PRICE_FEED_IDS];

      if (!feedId || feedId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        // Return mock price for unavailable feeds
        return this.getMockPrice(pair);
      }

      // Use Pyth EVM SDK to fetch latest price feeds
      const priceFeeds = await this.connection.getLatestPriceFeeds([feedId]);

      if (priceFeeds && priceFeeds.length > 0) {
        const priceFeed = priceFeeds[0];
        const price = priceFeed.getPriceNoOlderThan(60); // 60 seconds max age

        if (price) {
          // Convert price to decimal format
          const normalizedPrice = Number(price.price) * Math.pow(10, price.expo);
          return normalizedPrice;
        }
      }

      return this.getMockPrice(pair);
    } catch (error) {
      console.error('Error fetching price from Pyth:', error);
      return this.getMockPrice(pair);
    }
  }

  /**
   * Get price update data for on-chain updates
   * This can be used when submitting transactions that need price data
   */
  async getPriceUpdateData(pairs: string[]): Promise<string[]> {
    try {
      const feedIds = pairs
        .map(pair => PRICE_FEED_IDS[pair as keyof typeof PRICE_FEED_IDS])
        .filter(id => id && id !== '0x0000000000000000000000000000000000000000000000000000000000000000');

      if (feedIds.length === 0) {
        return [];
      }

      // Get price update data that can be submitted to Pyth contract
      const priceUpdateData = await this.connection.getPriceFeedsUpdateData(feedIds);
      return priceUpdateData;
    } catch (error) {
      console.error('Error fetching price update data from Pyth:', error);
      return [];
    }
  }

  /**
   * Get mock prices for demo/testing
   */
  private getMockPrice(pair: string): number {
    const mockPrices: Record<string, number> = {
      'USDC/USD': 1.0,
      'PYUSD/USD': 1.0,
      'ETH/USD': 2500.0,
      'BTC/USD': 45000.0,
    };

    return mockPrices[pair] || 1.0;
  }

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // For stablecoin pairs, assume 1:1
    const stablecoins = ['USDC', 'PYUSD', 'USDT', 'DAI'];
    if (stablecoins.includes(fromCurrency) && stablecoins.includes(toCurrency)) {
      return amount;
    }

    // Otherwise, get prices and convert
    const fromPrice = await this.getPrice(`${fromCurrency}/USD`);
    const toPrice = await this.getPrice(`${toCurrency}/USD`);

    if (!fromPrice || !toPrice) {
      return amount; // Return original if prices unavailable
    }

    return (amount * fromPrice) / toPrice;
  }

  /**
   * Get USD value for a token amount
   */
  async getUsdValue(amount: number, token: string): Promise<number> {
    const price = await this.getPrice(`${token}/USD`);
    return price ? amount * price : amount;
  }

  /**
   * Format price with currency symbol
   */
  formatPrice(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      INR: '₹',
      JPY: '¥',
    };

    const symbol = symbols[currency] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  }

  /**
   * Get FX quote for display (e.g., "≈ ₹830")
   */
  async getFxQuote(amountUsd: number, targetCurrency: string): Promise<string> {
    if (targetCurrency === 'USD') {
      return this.formatPrice(amountUsd, 'USD');
    }

    // Mock FX rates for demo
    const fxRates: Record<string, number> = {
      INR: 83.0,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 149.0,
    };

    const rate = fxRates[targetCurrency] || 1.0;
    const converted = amountUsd * rate;

    return `≈ ${this.formatPrice(converted, targetCurrency)}`;
  }
}

export const pythService = new PythService();
