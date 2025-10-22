import { config as dotenvConfig } from 'dotenv';
import { AppConfig } from './types';

dotenvConfig();

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
    chainId: parseInt(getEnv('CHAIN_ID', '84532'), 10),
    rpcUrl: getEnv('RPC_URL', 'https://sepolia.base.org'),
    chainName: getEnv('CHAIN_NAME', 'Base Sepolia'),
    pyusdAddress: getEnv('PYUSD_ADDRESS', '0x0000000000000000000000000000000000000000'),
    usdcAddress: getEnv('USDC_ADDRESS', '0x036CbD53842c5426634e7929541eC2318f3dCF7e'),
  },
  blockscout: {
    apiUrl: getEnv('BLOCKSCOUT_API_URL', 'https://base-sepolia.blockscout.com/api'),
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
};
