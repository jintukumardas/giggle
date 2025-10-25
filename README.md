# Giggle

> Instant crypto payments through chat

Giggle enables Web3 payments through WhatsApp, allowing users to send and receive PYUSD (PayPal's USD-backed digital currency) using simple text commands.

**ETHOnline 2025 Submission**

## Overview

Giggle bridges the gap between traditional messaging and decentralized finance by providing:

- Text-based cryptocurrency transactions through WhatsApp
- AI-powered natural language command processing
- Secure delegated signing for scheduled payments
- Real-time transaction confirmations and price feeds

## Features

### Core Capabilities

**Chat-Native Interface**
- No app installation required
- Non-Custodial Wallet Setup
- Works on any device with WhatsApp
- Accessible to 2 billion potential users
- Familiar conversational experience

**Non-Custodial Security**
- No private keys stored on servers
- User maintains full custody

**Digital Currency Support**
- PYUSD (PayPal USD) - USD-backed digital currency
- Settlement on Ethereum Sepolia
- Testnet environment for safe testing
- Production-ready architecture

**AI-Powered Automation**
- Natural language command parsing via OpenAI
- Intent detection for conversational interface
- Flexible command understanding
- Enhanced user experience

**Security Controls**
- PIN-based transaction authentication
- Secure PIN hashing and storage
- Transaction confirmation workflow
- Balance verification before sending
- Complete audit trail

## Command Reference

### Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `help` | Display help information | `help` |
| `balance` | Check PYUSD and ETH balance | `balance` or `What's my balance?` |
| `account` | View account details and address | `Show my account` |
| `send` | Send PYUSD to phone number | `Send $10 to +1234567890` |
| `request` | Request PYUSD from someone | `Request $20 from +1234567890` |
| `history` | View transaction history | `Show transaction history` |
| `set pin` | Set up security PIN (required) | `Set PIN 1234` |
| `confirm` | Confirm pending transaction | `confirm` or enter your PIN |
| `cancel` | Cancel pending transaction | `cancel` |

### Supported Recipient Formats

| Format | Example | Description |
|--------|---------|-------------|
| Phone (US) | `+1234567890` | E.164 formatted phone number |
| Phone (Local) | `(123) 456-7890` | US local format (auto-converted) |

### Supported Digital Currency

| Symbol | Name | Description |
|--------|------|-------------|
| `pyusd` | PayPal USD | USD-backed digital currency by PayPal |

## Use Cases

### Personal Remittances

| Scenario | Implementation | Benefits |
|----------|---------------|----------|
| Cross-border payments | Send PYUSD to international contacts | Lower fees, faster settlement |
| Bill splitting | Request payments from group members | Instant settlement, clear audit trail |
| Allowance payments | Schedule recurring transfers | Automated, reliable delivery |

### Small Business

| Scenario | Implementation | Benefits |
|----------|---------------|----------|
| Customer payments | Receive payments via chat | No POS required, instant confirmation |
| Vendor payments | Send scheduled payments to suppliers | Automated cash flow management |
| Payroll | Schedule salary disbursements | Reduced administrative overhead |

## Architecture

```
┌─────────────────┐
│   WhatsApp      │
│   (User)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Webhook     │
│    Interface    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         Giggle API Server               │
│                                         │
│  ┌──────────┐  ┌──────────┐             │
│  │ OpenAI   │  │  User    │             │
│  │ Intent   │  │ Service  │             │
│  └──────────┘  └──────────┘             │
│                                         │
│  ┌──────────┐  ┌──────────┐             │
│  │ Wallet   │  │  PIN     │             │
│  │ Service  │  │ Service  │             │
│  └──────────┘  └──────────┘             │
└─────────┬───────────────────────────────┘
          │
          ├─────────► Ethereum RPC
          ├─────────► Blockscout API
          └─────────► OpenAI API
```

## Quick Start

### Prerequisites

- Node.js 18 or higher
- npm package manager
- Twilio account (free sandbox available)
- ngrok for local webhook testing

### Installation

```bash
cd giggle
cp .env.example .env
npm install
```

### Configuration

Edit `.env` with your credentials:

```bash
# Twilio Configuration (https://console.twilio.com)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# OpenAI Configuration (required for natural language processing)
OPENAI_API_KEY=your_openai_api_key

# Network Configuration (Ethereum Sepolia)
CHAIN_ID=11155111
RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CHAIN_NAME=Ethereum Sepolia
PYUSD_ADDRESS=0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9

# Optional Service Configuration
BLOCKSCOUT_API_URL=https://eth-sepolia.blockscout.com/api
```

### Database Setup

```bash
cd apps/api
npm run tsx scripts/migrate.ts
```

### Development

Start the required services:

```bash
# Terminal 1: API Server
npm run dev

# Terminal 2: ngrok
ngrok http 3000
```

### Twilio Webhook Configuration

1. Navigate to [Twilio Sandbox](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
2. Set "When a message comes in" to: `https://your-ngrok-url.ngrok.io/whatsapp`
3. Save configuration

### Testing

1. Send `join <your-sandbox-code>` to **+11111111111**
2. Send `/help` to verify bot functionality

## Usage Guide

### 1. Set Up Your PIN (Required)

Before sending any transactions, you must set up a security PIN:

```
Set PIN 1234
```

Use a 4-6 digit PIN that you'll remember. You'll need it to confirm all transactions.

### 2. Obtain Testnet Tokens

Your wallet is automatically created when you first interact with the bot. You'll need testnet tokens:

- Ethereum Sepolia ETH: [Sepolia Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- Test PYUSD: Deploy test tokens or use existing testnet PYUSD

### 3. Check Your Account

View your wallet address and balances:

```
Show my account
```

or simply:

```
balance
```

### 4. Send Payment

Send PYUSD to another phone number:

```
Send $10 to +1234567890
```

You'll be prompted to confirm by entering your PIN.

### 5. Confirm Transaction

After initiating a send, enter your PIN to confirm:

```
1234
```

or type:

```
confirm
```

### 6. View Transaction History

```
Show transaction history
```

## Security Features

### PIN Authentication

All transactions require PIN confirmation for security:

- **PIN Setup**: Required before first transaction
- **PIN Format**: 4-6 digits
- **Secure Storage**: PINs are hashed using bcrypt
- **Transaction Security**: Every send requires PIN entry

### Transaction Workflow

1. **Initiate**: Send command (e.g., "Send $10 to +1234567890")
2. **Verify**: System checks balance and creates pending transaction
3. **Confirm**: Enter your PIN to confirm
4. **Execute**: Transaction is broadcast to Ethereum Sepolia
5. **Notify**: Both sender and recipient receive confirmation

### Additional Security

- Balance verification before transactions
- Gas fee validation
- Automated wallet creation per phone number
- Complete audit logging of all activities

## Technology Stack

### Core Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Chat Interface | Twilio WhatsApp API | Message handling and delivery |
| Intent Recognition | OpenAI GPT | Natural language command parsing |
| Blockchain | Ethereum Sepolia | Transaction settlement |
| Smart Contract | ERC-20 (PYUSD) | Digital currency transfers |
| Security | bcrypt | PIN hashing and authentication |
| Database | SQLite | User and transaction data |
| Explorer | Blockscout | Transaction verification |

### Key Integrations

**PayPal USD (PYUSD)**
- Primary settlement token for all transactions
- Real-world P2P remittance implementation
- Consumer-scale payment UX demonstration
- Lower latency and cost vs. traditional payment rails

**OpenAI Integration**
- Natural language command interpretation
- Intent detection (send, request, balance, etc.)
- Flexible conversational interface
- Enhanced user experience

**Blockscout Integration**
- On-chain transaction confirmation delivered to chat
- Transaction explorer links
- Address verification and lookup

## Compliance

### WhatsApp Business Policy

Giggle complies with WhatsApp commerce policies:

- Non-custodial architecture (no funds held by service)
- Testnet-only demonstration (no real currency)
- External wallet links (no in-chat commerce)
- Clear testnet warnings and disclosures

### 24-Hour Customer Service Window

Business-initiated messages use approved templates. User-initiated flows maintain compliance by:

- Requiring user to initiate conversation
- Template approval for scheduled notifications
- `/start` command to reopen messaging window

### Data Privacy

- No private key storage
- Minimal PII collection (phone numbers only)
- Comprehensive audit logging
- GDPR-compatible architecture

## Production Deployment

### Pre-Production Requirements

- [ ] WhatsApp Business Account registration
- [ ] Message template approval
- [ ] Production Twilio phone number
- [ ] Mainnet RPC endpoint configuration
- [ ] Secure hosting deployment (AWS/GCP/Railway)
- [ ] SSL/TLS certificate installation
- [ ] Twilio signature verification
- [ ] Rate limiting configuration
- [ ] Monitoring setup (Sentry, DataDog)
- [ ] Legal compliance review

### Production Environment Variables

```bash
NODE_ENV=production
TWILIO_VERIFY_SIGNATURES=true
ENCRYPTION_KEY=<32-byte-key>
JWT_SECRET=<strong-secret>
RPC_URL=<mainnet-rpc>
```

### Deployment Options

**Railway**
```bash
railway init
railway up
```

**Docker**
```bash
docker build -t giggle .
docker run -p 3000:3000 giggle
```

**Serverless (Vercel/Netlify)**
- API routes compatible with serverless functions
- Requires persistent PostgreSQL database

## Contributing

This project was developed for ETHOnline 2025. Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

**TESTNET ONLY - NO REAL FUNDS**

This is a proof-of-concept demonstration for ETHOnline 2025. All transactions use testnet tokens with no monetary value. Do not send real funds to testnet addresses.

WhatsApp integration utilizes Twilio Sandbox for development purposes only. Production deployment requires:

- WhatsApp Business Account approval
- Compliance with WhatsApp Business Policy
- Approved message templates
- Appropriate regulatory licensing (jurisdiction-dependent)

This software is provided as-is without warranties. Not financial advice. Use at your own risk.

## Acknowledgments

Built with:

- [Twilio](https://www.twilio.com/docs/whatsapp) - WhatsApp API integration
- [OpenAI](https://openai.com/) - Natural language processing and intent detection
- [Blockscout](https://blockscout.com/) - Ethereum block explorer
- [Ethereum](https://ethereum.org/) - Blockchain infrastructure (Sepolia testnet)
- [PayPal USD](https://www.paypal.com/pyusd) - Digital currency infrastructure
- [ethers.js](https://docs.ethers.org/) - Ethereum wallet and contract interaction
- [Express.js](https://expressjs.com/) - API server framework
- [SQLite](https://www.sqlite.org/) - Database for user and transaction data

---

**ETHOnline 2025 Submission**

For questions or demo requests, please open an issue on GitHub.
