# High-Tier Ethereum JIT/MEV Bot

A sophisticated Just-In-Time (JIT) and Maximum Extractable Value (MEV) bot targeting three high-volume Uniswap V3 pools on Ethereum mainnet.

## 🎯 Target Pools

1. **WETH-USDC-0.05%** (0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640)
2. **ETH-USDT-0.3%** (0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36)  
3. **WBTC-ETH-0.3%** (0xCBCdF9626bC03E24f779434178A73a0B4bad62eD)

## 🏗️ Architecture

The bot is structured in modular form with the following components:

### Core Modules

- **`lp_calculation.ts`** - LP tick range & amount calculation
- **`bundle_manager.ts`** - Mint-swap-burn simulation and management
- **`execution_sim.ts`** - Bundle execution on local fork
- **`pool_manager.ts`** - Pool tracking & prioritization 
- **`risk_hedging.ts`** - Token exposure & hedging strategies
- **`logger.ts`** - Comprehensive logging & analytics
- **`mempool_listener.ts`** - Placeholder for future VPS deployment

### Utility Modules

- **`uniswap_sdk_helpers.ts`** - Uniswap V3 SDK operations
- **`gas_utils.ts`** - Gas calculation & optimization
- **`math.ts`** - Precision math for liquidity calculations

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- TypeScript
- Hardhat or Ganache for local forked testing

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jit-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables:
```env
# RPC endpoint (use Hardhat/Ganache fork for testing)
RPC_URL=http://localhost:8545

# Private key (optional for simulation mode)
PRIVATE_KEY=your_private_key_here

# Bot configuration
SIMULATION_MODE=true
LOOP_DELAY=50
MAX_EXECUTIONS_PER_HOUR=100
MIN_PROFIT_THRESHOLD=0.005
```

### Running in Simulation Mode (Recommended for Testing)

```bash
# Build the project
npm run build

# Start in simulation mode (no real transactions)
npm run dev
```

### Running with Real Execution

**⚠️ WARNING: Only use with testnet or small amounts on mainnet**

```bash
# Set simulation mode to false
export SIMULATION_MODE=false

# Run with real execution
npm run start
```

## 📊 Features

### JIT Liquidity Strategy

- **Optimal Tick Range Calculation** - Dynamically calculates best tick ranges for LP positions
- **Fee Capture Optimization** - Maximizes fee capture from large swaps
- **Gas Cost Analysis** - Ensures profitability after gas costs

### Risk Management

- **Token Exposure Monitoring** - Tracks volatile asset exposure
- **Automated Hedging** - Optional hedging to stablecoins
- **Position Validation** - Pre-execution profitability checks

### Analytics & Monitoring

- **Real-time Metrics** - Success rate, profitability, execution times
- **Daily Performance Reports** - Comprehensive performance analysis
- **Detailed Logging** - All operations logged with context

### Bundle Management

- **Mint-Swap-Burn Bundles** - Atomic transaction sequences
- **Gas Optimization** - Dynamic gas pricing and limits
- **Slippage Protection** - Configurable slippage tolerances

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

### Run with Local Fork

1. Start Hardhat fork:
```bash
npx hardhat node --fork https://mainnet.infura.io/v3/YOUR_INFURA_KEY
```

2. Run bot against fork:
```bash
RPC_URL=http://localhost:8545 npm run dev
```

## 📈 Performance Metrics

The bot tracks comprehensive metrics including:

- **Execution Success Rate** - Percentage of successful bundles
- **Profitability Ratio** - Profit vs gas cost ratio
- **Average Execution Time** - Time from detection to execution
- **Fee Capture Rate** - Percentage of available fees captured
- **Risk-Adjusted Returns** - Returns accounting for exposure

### Sample Performance Report

```
=== JIT BOT PERFORMANCE REPORT ===

📊 Overall Metrics:
   Total Executions: 45
   Success Rate: 87.8%
   Total Profit: $234.56
   Total Gas Cost: $89.23
   Total Fees: $321.45
   Profitability: 262.9%
   Avg Execution Time: 2847ms

📈 Recent Daily Performance:
   2024-01-15: 12 exec, $67.89 profit, $23.45 gas
   2024-01-14: 18 exec, $89.12 profit, $31.67 gas
   2024-01-13: 15 exec, $77.55 profit, $34.11 gas

🎯 Performance Indicators:
   ✅ High success rate
   ✅ Highly profitable
```

## 🔧 Configuration

### Bot Configuration

```typescript
interface BotConfig {
  rpcUrl: string;                // Ethereum RPC endpoint
  privateKey?: string;           // Wallet private key (optional)
  simulationMode: boolean;       // Run in simulation mode
  loopDelay: number;            // Delay between iterations (ms)
  maxExecutionsPerHour: number; // Rate limiting
  minProfitThreshold: number;   // Minimum profit in USD
}
```

### Risk Parameters

```typescript
interface RiskParameters {
  maxExposure: number;          // Max volatile asset exposure (0-1)
  hedgeThreshold: number;       // Threshold to trigger hedging
  stablecoinTargets: string[];  // Preferred stablecoins
  maxSlippage: number;          // Max slippage for hedges
  riskTolerance: 'low' | 'medium' | 'high';
}
```

## 🚨 Important Notes

### Current Implementation Status

- ✅ **Fully Implemented**: All core modules with simulation capabilities
- ✅ **Local Testing**: Complete testing framework with forked mainnet
- ⚠️ **Mempool Monitoring**: Placeholder implementation (simulation only)
- 🔄 **VPS Deployment**: Ready for mempool integration

### For Production VPS Deployment

The `mempool_listener.ts` module currently contains placeholder code. For production deployment, implement:

1. **Real-time Mempool Monitoring** - WebSocket connection to Ethereum node
2. **Transaction Filtering** - Identify Uniswap V3 swaps in target pools
3. **MEV Opportunity Detection** - Real-time profitability analysis
4. **Bundle Execution** - Atomic transaction submission

### Security Considerations

- **Private Key Management** - Use secure key storage (AWS KMS, etc.)
- **Gas Price Limits** - Prevent excessive gas costs
- **Profit Thresholds** - Ensure minimum profitability
- **Rate Limiting** - Prevent excessive execution frequency
- **Slippage Protection** - Guard against MEV sandwich attacks

## 📁 Project Structure

```
jit-bot/
├── src/
│   ├── config/
│   │   └── pools.json           # Pool configurations
│   ├── modules/
│   │   ├── lp_calculation.ts    # LP position calculations
│   │   ├── bundle_manager.ts    # Bundle creation & management
│   │   ├── execution_sim.ts     # Execution simulation
│   │   ├── pool_manager.ts      # Pool monitoring & selection
│   │   ├── risk_hedging.ts      # Risk management & hedging
│   │   ├── logger.ts            # Logging & analytics
│   │   └── mempool_listener.ts  # Mempool monitoring (placeholder)
│   ├── utils/
│   │   ├── uniswap_sdk_helpers.ts  # Uniswap utilities
│   │   ├── gas_utils.ts            # Gas calculations
│   │   └── math.ts                 # Math utilities
│   └── main.ts                  # Entry point
├── logs/                        # Log files (auto-created)
├── package.json
├── tsconfig.json
└── README.md
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Ensure all tests pass
5. Submit a pull request

## ⚠️ Disclaimer

This software is for educational and research purposes. MEV extraction carries significant risks including:

- **Financial Loss** - Impermanent loss, gas costs, failed transactions
- **Technical Risk** - Smart contract bugs, network issues
- **Regulatory Risk** - Compliance with local regulations

**Use at your own risk. Never invest more than you can afford to lose.**

## 📞 Support

For questions or issues:

1. Check the [GitHub Issues](https://github.com/your-repo/issues)
2. Review the documentation
3. Join our [Discord](https://discord.gg/your-channel)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for the future of DeFi** 🚀