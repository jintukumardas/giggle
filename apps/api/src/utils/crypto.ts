import { ethers } from 'ethers';
import { config } from '../config';

// ERC-20 ABI (minimal interface for transfers and balance)
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

let provider: ethers.JsonRpcProvider;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl);
  }
  return provider;
}

export function getTokenContract(tokenAddress: string, signerOrProvider?: ethers.Signer | ethers.Provider) {
  return new ethers.Contract(
    tokenAddress,
    ERC20_ABI,
    signerOrProvider || getProvider()
  );
}

export function getTokenAddress(token: string): string {
  const tokenUpper = token.toUpperCase();
  if (tokenUpper === 'PYUSD') {
    return config.blockchain.pyusdAddress;
  }
  throw new Error(`Unknown token: ${token}`);
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<{ balance: string; formatted: string }> {
  const contract = getTokenContract(tokenAddress);
  const [balance, decimals] = await Promise.all([
    contract.balanceOf(walletAddress),
    contract.decimals(),
  ]);

  const formatted = ethers.formatUnits(balance, decimals);
  return {
    balance: balance.toString(),
    formatted,
  };
}

/**
 * Prepare a transfer transaction
 */
export async function prepareTransfer(
  tokenAddress: string,
  to: string,
  amount: string
): Promise<ethers.TransactionRequest> {
  const contract = getTokenContract(tokenAddress);
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);

  const data = contract.interface.encodeFunctionData('transfer', [to, amountWei]);

  return {
    to: tokenAddress,
    data,
    value: 0n,
  };
}

/**
 * Wait for a transaction receipt
 */
export async function waitForReceipt(
  txHash: string,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt | null> {
  const provider = getProvider();
  return provider.waitForTransaction(txHash, confirmations);
}

/**
 * Get transaction details
 */
export async function getTransaction(txHash: string): Promise<ethers.TransactionResponse | null> {
  const provider = getProvider();
  return provider.getTransaction(txHash);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Format address for display (shortened)
 */
export function formatAddress(address: string): string {
  if (!isValidAddress(address)) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Parse units (convert human-readable amount to wei)
 */
export function parseTokenUnits(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals);
}

/**
 * Format units (convert wei to human-readable amount)
 */
export function formatTokenUnits(amount: bigint, decimals: number): string {
  return ethers.formatUnits(amount, decimals);
}
