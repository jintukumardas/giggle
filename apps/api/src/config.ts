import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { AppConfig } from './types';

// Load .env from the project root (two levels up from src/)
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: AppConfig = {
  port: parseInt(getEnv('PORT', '3000'), 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),
  baseUrl: getEnv('BASE_URL', 'http://localhost:3000'),
  twilio: {
    accountSid: getEnv('TWILIO_ACCOUNT_SID'),
    authToken: getEnv('TWILIO_AUTH_TOKEN'),
    whatsappNumber: getEnv('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886'),
    verifySignatures: getEnv('TWILIO_VERIFY_SIGNATURES', 'false') === 'true',
  },
  blockchain: {
    chainId: parseInt(getEnv('CHAIN_ID', '11155111'), 10),
    rpcUrl: getEnv('RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
    chainName: getEnv('CHAIN_NAME', 'Ethereum Sepolia'),
    pyusdAddress: getEnv('PYUSD_ADDRESS', '0x0000000000000000000000000000000000000000'),
    usdcAddress: getEnv('USDC_ADDRESS', '0x0000000000000000000000000000000000000000'),
  },
  blockscout: {
    apiUrl: getEnv('BLOCKSCOUT_API_URL', 'https://eth-sepolia.blockscout.com/api'),
  },
  pyth: {
    endpoint: getEnv('PYTH_ENDPOINT', 'https://hermes.pyth.network'),
  },
  walletConnect: {
    projectId: getEnv('WALLETCONNECT_PROJECT_ID', ''),
  },
  lit: {
    network: getEnv('LIT_NETWORK', 'datil-test'),
  },
  security: {
    encryptionKey: getEnv('ENCRYPTION_KEY', 'dev_key_32_bytes_long_minimum!'),
    jwtSecret: getEnv('JWT_SECRET', 'dev_jwt_secret_change_in_prod'),
  },
  limits: {
    defaultDailyLimit: parseFloat(getEnv('DEFAULT_DAILY_LIMIT', '100')),
    maxDailyLimit: parseFloat(getEnv('MAX_DAILY_LIMIT', '1000')),
  },
  openai: {
    apiKey: getEnv('OPENAI_API_KEY', ''),
  },
  pinata: {
    jwt: getEnv('PINATA_JWT', ''),
    gateway: getEnv('PINATA_GATEWAY', ''), // Use custom gateway from env, no fallback
  },
  giftCoupon: {
    contractAddress: getEnv('GIFT_COUPON_CONTRACT_ADDRESS', ''),
  },
};
