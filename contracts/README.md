# Giggle Gift Coupon Smart Contracts

A decentralized gift coupon system built on Ethereum, allowing users to create and redeem gift coupons using PYUSD or other ERC20 tokens.

## Features

- **Create Gift Coupons**: Lock tokens in a smart contract with a unique code
- **IPFS Metadata**: Store gift messages, images, and metadata on IPFS via Pinata
- **Secure Redemption**: Redeem coupons using unique codes (hashed on-chain for privacy)
- **Expiration Dates**: Set optional expiration dates for coupons
- **Cancellation**: Creators can cancel and get refunded for unredeemed coupons
- **Multi-Token Support**: Support for PYUSD and other ERC20 tokens

## Technology Stack

### Dependencies & Versions

| Package | Version | Description |
|---------|---------|-------------|
| **Hardhat** | `3.0.9` | Ethereum development environment (latest v3) |
| **Solidity** | `0.8.20` | Smart contract language |
| **OpenZeppelin Contracts** | `5.4.0` | Security-audited contract libraries |
| **Ethers.js** | `6.13.4` | Ethereum library for interaction |
| **Chai** | `5.1.2` | Testing assertion library |
| **TypeScript** | `5.6.3` | Type-safe development |

### Hardhat 3 Plugins

| Plugin | Version | Purpose |
|--------|---------|---------|
| `@nomicfoundation/hardhat-ethers` | `4.0.2` | Ethers.js integration for Hardhat 3 |
| `@nomicfoundation/hardhat-ethers-chai-matchers` | `3.0.0` | Ethereum-specific Chai matchers (Hardhat 3 compatible) |
| `@nomicfoundation/hardhat-ignition` | `3.0.3` | Declarative deployment system |
| `@nomicfoundation/hardhat-ignition-ethers` | `3.0.3` | Ethers integration for Ignition |
| `@nomicfoundation/hardhat-network-helpers` | `3.0.1` | Test utilities for time manipulation, etc. |
| `@nomicfoundation/hardhat-verify` | `3.0.4` | Contract verification on Etherscan |


## Smart Contracts

### GiggleGiftCoupon

Main contract for creating and redeeming gift coupons.

**Key Functions:**
- `createCoupon(code, token, amount, metadataURI, expiresAt)` - Create a new gift coupon
- `redeemCoupon(code)` - Redeem a coupon using its unique code
- `cancelCoupon(couponId)` - Cancel an unredeemed coupon and get refund
- `checkCoupon(code)` - Verify if a code is valid and get coupon details
- `addSupportedToken(token)` - Add a supported ERC20 token (owner only)

## Deployment Information

### Networks

| Network | Chain ID | RPC URL | Status |
|---------|----------|---------|--------|
| **Sepolia Testnet** | 11155111 | https://ethereum-sepolia-rpc.publicnode.com | Configured |
| **Localhost** | 31337 | http://127.0.0.1:8545 | Development |

### Deployed Contracts

> **Note**: Update this table after deployment

| Contract | Network | Address 
|----------|---------|---------
| GiggleGiftCoupon | Sepolia | `TBD` 
| GiggleGiftCoupon | Mainnet | `TBD`

### Supported Tokens

| Token | Symbol | Network | Address | Decimals |
|-------|--------|---------|---------|----------|
| PYUSD | PYUSD | Sepolia | `0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9` | 6 |
| PYUSD | PYUSD | Mainnet | `0x6c3ea9036406852006290770bedfcaba0e23a0e8` | 6 |

## Setup & Installation

### Prerequisites

- **Node.js**: Version 22.10.0 or higher (required for Hardhat 3)
- **npm**: Version 9.0 or higher
- **Git**: For version control

### Install Node.js 22 with nvm

```bash
# Install nvm (if not already installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js 22
nvm install 22
nvm use 22

# Verify version
node --version  # Should show v22.x.x
```

### Installation

```bash
# Clone the repository
git clone https://github.com/jintukumardas/giggle.git
cd giggle/contracts

# Install dependencies
npm install

# Copy environment variables
cp ../.env.example ../.env
# Edit ../.env with your configuration
```

### Environment Variables

Create a `../.env` file in the parent directory with:

```bash
# Network Configuration
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=your_private_key_here

# Contract Verification
ETHERSCAN_API_KEY=your_etherscan_api_key

# PYUSD Token Address (Sepolia)
PYUSD_ADDRESS=0x... # Update with Sepolia PYUSD address
```

## Development

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests with gas reporting (when plugin is available)
npm run test:gas

# Run coverage (when plugin is available)
npm run coverage
```

### Run Local Network

```bash
# Start local Hardhat node
npm run node
```

## Deployment

### Deploy to Local Network

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### Deploy to Sepolia Testnet

```bash
# Deploy only GiggleGiftCoupon
npm run deploy:sepolia

# Deploy with MockERC20 for testing
npx hardhat ignition deploy ignition/modules/DeployAll.ts --network sepolia --parameters '{"deployMockToken": true}'
```

### Deploy to Mainnet

```bash
# ⚠️ CAUTION: Mainnet deployment costs real ETH
npx hardhat ignition deploy ignition/modules/GiggleGiftCoupon.ts --network mainnet
```

### Verify Contracts on Etherscan

```bash
# Hardhat 3 uses built-in verification
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

## Deployment Modules

### 1. GiggleGiftCoupon (Basic)

Deploys only the GiggleGiftCoupon contract.

```bash
npx hardhat ignition deploy ignition/modules/GiggleGiftCoupon.ts --network <network>
```

### 2. MockERC20 (Testing)

Deploys a mock ERC20 token for testing.

```bash
npx hardhat ignition deploy ignition/modules/MockERC20.ts --network <network>
```

### 3. DeployAll (Complete)

Deploys GiggleGiftCoupon and optionally MockERC20 with automatic token registration.

```bash
# With mock token for testing
npx hardhat ignition deploy ignition/modules/DeployAll.ts \
  --network sepolia \
  --parameters '{"deployMockToken": true}'

# With real PYUSD
npx hardhat ignition deploy ignition/modules/DeployAll.ts \
  --network sepolia \
  --parameters '{"pyusdAddress": "0x..."}'
```

## Testing

The test suite covers:

- ✅ Contract deployment and initialization
- ✅ Token management (add/remove supported tokens)
- ✅ Coupon creation with various parameters
- ✅ Coupon redemption flow
- ✅ Expiration date handling
- ✅ Cancellation and refunds
- ✅ Access control and permissions
- ✅ Edge cases and error conditions

### Test Coverage

| Contract | Statements | Branches | Functions | Lines |
|----------|------------|----------|-----------|-------|
| GiggleGiftCoupon | TBD | TBD | TBD | TBD |
| MockERC20 | TBD | TBD | TBD | TBD |

> Run tests and update coverage when solidity-coverage becomes Hardhat 3 compatible

## Hardhat Configuration

The project uses Hardhat 3's new configuration format:

```javascript
const config = {
  plugins: [
    hardhatEthersPlugin,
    hardhatEthersChaiMatchersPlugin,
    hardhatIgnitionEthersPlugin,
    hardhatNetworkHelpersPlugin,
    hardhatVerifyPlugin,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

## Security Considerations

- ✅ Uses OpenZeppelin's audited contracts (Ownable, ReentrancyGuard)
- ✅ Reentrancy protection on critical functions
- ✅ Code hashing for privacy (codes never stored on-chain)
- ✅ Access control for token management
- ✅ Expiration validation
- ⚠️ Contract not yet audited - use at your own risk

## Troubleshooting

### Node.js Version Error

```
WARNING: You are using Node.js 20.x.x which is not supported by Hardhat 3.
```

**Solution**: Upgrade to Node.js 22+

```bash
nvm install 22
nvm use 22
```

### Plugin Compatibility Issues

If you encounter peer dependency warnings, ensure you're using Hardhat 3 compatible versions:

- Use `hardhat-ethers-chai-matchers` (not `hardhat-chai-matchers`)
- Use Chai 5.x (not 4.x)
- All `@nomicfoundation` plugins should be v3.x or v4.x

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact & Support

- **Project**: Giggle Pay
- **Repository**: https://github.com/jintukumardas/giggle.git
- **Issues**: https://github.com/jintukumardas/giggle/issues

## Acknowledgments

- [Hardhat](https://hardhat.org/) - Ethereum development environment
- [OpenZeppelin](https://openzeppelin.com/) - Secure smart contract library
- [PYUSD](https://paxos.com/pyusd/) - PayPal USD stablecoin
- [Pinata](https://pinata.cloud/) - IPFS pinning service

---

**Built with ❤️ using Hardhat 3**
