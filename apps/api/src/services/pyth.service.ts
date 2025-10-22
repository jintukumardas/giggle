import { config } from '../config';

interface PythPrice {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

// Pyth price feed IDs for common pairs
// These are testnet/mainnet price feed IDs - update as needed
const PRICE_FEED_IDS = {
  'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'PYUSD/USD': '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
  'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
};

export class PythService {
  private readonly endpoint: string;

  constructor() {
    this.endpoint = config.pyth.endpoint;
  }

  /**
   * Get latest price for a trading pair
   */
  async getPrice(pair: string): Promise<number | null> {
    try {
      const feedId = PRICE_FEED_IDS[pair as keyof typeof PRICE_FEED_IDS];

      if (!feedId || feedId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
        // Return mock price for unavailable feeds
        return this.getMockPrice(pair);
      }

      const response = await fetch(
        `${this.endpoint}/api/latest_price_feeds?ids[]=${feedId}`
      );

      const data = await response.json();

      if (data && data.length > 0) {
        const priceData: PythPrice = data[0];
        const price = parseInt(priceData.price.price) * Math.pow(10, priceData.price.expo);
        return price;
      }

      return this.getMockPrice(pair);
    } catch (error) {
      console.error('Error fetching price from Pyth:', error);
      return this.getMockPrice(pair);
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
