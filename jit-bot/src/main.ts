import { ethers } from 'ethers';
import { calculateLiquidity } from './modules/lp_calculation';
import { createBundle } from './modules/bundle_manager';
import { executeBundle, simulateBundle } from './modules/execution_sim';
import { createPoolManager } from './modules/pool_manager';
import { hedgePosition } from './modules/risk_hedging';
import { getLogger, logInfo, logError } from './modules/logger';
import { createMempoolListener } from './modules/mempool_listener';
import * as dotenv from 'dotenv';

/**
 * Main Entry Point - Integrates all modules
 * High-tier Ethereum JIT/MEV bot targeting three pools
 */

// Load environment variables
dotenv.config();

interface BotConfig {
  rpcUrl: string;
  privateKey?: string;
  simulationMode: boolean;
  loopDelay: number;
  maxExecutionsPerHour: number;
  minProfitThreshold: number;
}

class JITMEVBot {
  private provider: ethers.Provider;
  private signer?: ethers.Signer;
  private poolManager: any;
  private mempoolListener: any;
  private logger: any;
  private config: BotConfig;
  private isRunning: boolean = false;
  private executionCount: number = 0;
  private lastHourReset: number = Date.now();
  
  constructor(config: BotConfig) {
    this.config = config;
    this.logger = getLogger('./logs');
    
    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Initialize signer if private key provided
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }
    
    // Initialize pool manager
    this.poolManager = createPoolManager(this.provider);
    
    // Initialize mempool listener
    this.mempoolListener = createMempoolListener(this.provider, this.poolManager);
    
    logInfo('JIT MEV Bot initialized', {
      simulationMode: config.simulationMode,
      hasPrivateKey: !!config.privateKey
    });
  }
  
  /**
   * Main bot execution loop
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logInfo('Bot is already running');
      return;
    }
    
    this.isRunning = true;
    logInfo('🚀 Starting JIT MEV Bot...');
    
    try {
      // Start pool monitoring
      this.poolManager.startMonitoring();
      
      // Start mempool listener (simulation mode)
      await this.mempoolListener.startListening();
      
      // Main execution loop
      await this.mainLoop();
      
    } catch (error) {
      logError('Bot execution failed', error);
      this.isRunning = false;
    }
  }
  
  /**
   * Stop the bot
   */
  public async stop(): Promise<void> {
    logInfo('🛑 Stopping JIT MEV Bot...');
    
    this.isRunning = false;
    
    // Stop pool monitoring
    this.poolManager.stopMonitoring();
    
    // Stop mempool listener
    this.mempoolListener.stopListening();
    
    // Flush logs
    this.logger.flush();
    
    logInfo('Bot stopped successfully');
  }
  
  /**
   * Main execution loop
   */
  private async mainLoop(): Promise<void> {
    logInfo('Main execution loop started');
    
    while (this.isRunning) {
      try {
        // Reset execution count every hour
        this.resetHourlyCountIfNeeded();
        
        // Check if we've hit execution limit
        if (this.executionCount >= this.config.maxExecutionsPerHour) {
          logInfo('Hourly execution limit reached, waiting...');
          await this.sleep(60000); // Wait 1 minute
          continue;
        }
        
        // Select pool for next operation
        const selectedPool = this.poolManager.selectPoolForNextSwap();
        
        if (!selectedPool) {
          logInfo('No suitable pools found, waiting...');
          await this.sleep(this.config.loopDelay);
          continue;
        }
        
        // Simulate next swap (in real implementation, this would come from mempool)
        const swapData = this.simulateNextSwap(selectedPool);
        
        // Calculate optimal liquidity position
        const liquidityPosition = calculateLiquidity(selectedPool.pool, swapData);
        
        // Validate profitability
        if (liquidityPosition.netProfit < this.config.minProfitThreshold) {
          logInfo(`Opportunity below profit threshold: $${liquidityPosition.netProfit.toFixed(4)} < $${this.config.minProfitThreshold}`);
          await this.sleep(this.config.loopDelay);
          continue;
        }
        
        // Create bundle
        const recipientAddress = this.signer ? await this.signer.getAddress() : '0x0000000000000000000000000000000000000000';
        const bundle = createBundle(liquidityPosition, {
          tokenIn: selectedPool.pool.token0.address,
          tokenOut: selectedPool.pool.token1.address,
          amount: liquidityPosition.amount0,
          amountOutMinimum: liquidityPosition.amount1,
          recipient: recipientAddress,
          deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
          sqrtPriceLimitX96: selectedPool.pool.sqrtRatioX96
        }, this.signer || this.createMockSigner());
        
        // Execute or simulate bundle
        let result;
        if (this.config.simulationMode) {
          result = await simulateBundle(bundle, {
            provider: this.provider,
            signer: this.signer || this.createMockSigner(),
            maxGasPrice: BigInt('100000000000'), // 100 gwei
            slippageTolerance: 0.005,
            timeout: 30000
          });
        } else {
          if (!this.signer) {
            logError('No signer available for live execution');
            await this.sleep(this.config.loopDelay);
            continue;
          }
          
          result = await executeBundle(bundle, {
            provider: this.provider,
            signer: this.signer,
            maxGasPrice: BigInt('100000000000'),
            slippageTolerance: 0.005,
            timeout: 30000
          });
        }
        
        // Log execution result
        this.logger.logExecution(result);
        this.executionCount++;
        
        // Handle hedging if profitable
        if (result.success && result.actualProfit > 0) {
          const hedgeAction = hedgePosition(liquidityPosition);
          this.logger.logHedge(hedgeAction);
          
          if (hedgeAction.shouldHedge && hedgeAction.urgency === 'high') {
            logInfo('Executing hedge due to high urgency');
            // In real implementation, execute hedge here
          }
        }
        
        // Wait before next iteration
        await this.sleep(this.config.loopDelay);
        
      } catch (error) {
        logError('Error in main loop iteration', error);
        await this.sleep(this.config.loopDelay * 2); // Wait longer on error
      }
    }
  }
  
  /**
   * Simulate next swap for testing (in production, this comes from mempool)
   */
  private simulateNextSwap(selectedPool: any): any {
    // Generate random swap data for simulation
    const swapAmountETH = 5 + Math.random() * 45; // 5-50 ETH
    
    return {
      amount: swapAmountETH,
      tokenIn: selectedPool.pool.token0.address,
      tokenOut: selectedPool.pool.token1.address,
      expectedPriceImpact: 0.1 + Math.random() * 0.9 // 0.1-1% impact
    };
  }
  
  /**
   * Create mock signer for simulation
   */
  private createMockSigner(): ethers.Signer {
    const wallet = ethers.Wallet.createRandom();
    return wallet.connect(this.provider);
  }
  
  /**
   * Reset hourly execution count
   */
  private resetHourlyCountIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastHourReset >= 3600000) { // 1 hour
      this.executionCount = 0;
      this.lastHourReset = now;
      logInfo('Hourly execution count reset');
    }
  }
  
  /**
   * Sleep utility
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get bot status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      executionCount: this.executionCount,
      config: this.config,
      pools: this.poolManager.getAllPools().length,
      mempoolStatus: this.mempoolListener.getStatus(),
      metrics: this.logger.getMetrics()
    };
  }
  
  /**
   * Generate performance report
   */
  public generateReport(): string {
    return this.logger.generateReport();
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log('🤖 High-Tier Ethereum JIT/MEV Bot Starting...');
  console.log('📋 Targeting pools:');
  console.log('   1. WETH-USDC-0.05% (0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640)');
  console.log('   2. ETH-USDT-0.3% (0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36)');
  console.log('   3. WBTC-ETH-0.3% (0xCBCdF9626bC03E24f779434178A73a0B4bad62eD)');
  console.log('');
  
  // Configuration
  const config: BotConfig = {
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545', // Hardhat/Ganache fork
    privateKey: process.env.PRIVATE_KEY, // Optional for simulation
    simulationMode: process.env.SIMULATION_MODE !== 'false', // Default to simulation
    loopDelay: parseInt(process.env.LOOP_DELAY || '50'), // 50ms default
    maxExecutionsPerHour: parseInt(process.env.MAX_EXECUTIONS_PER_HOUR || '100'),
    minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.005') // $0.005
  };
  
  console.log(`⚙️  Configuration:`);
  console.log(`   Simulation Mode: ${config.simulationMode}`);
  console.log(`   Loop Delay: ${config.loopDelay}ms`);
  console.log(`   Max Executions/Hour: ${config.maxExecutionsPerHour}`);
  console.log(`   Min Profit Threshold: $${config.minProfitThreshold}`);
  console.log('');
  
  // Create and start bot
  const bot = new JITMEVBot(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received shutdown signal...');
    await bot.stop();
    console.log('👋 Bot shutdown complete');
    process.exit(0);
  });
  
  // Start bot
  try {
    await bot.start();
  } catch (error) {
    console.error('❌ Bot failed to start:', error);
    process.exit(1);
  }
  
  // Keep the process alive
  setInterval(() => {
    // Status check every 5 minutes
    const status = bot.getStatus();
    if (status.isRunning) {
      console.log(`💚 Bot running - Executions: ${status.executionCount}/${status.config.maxExecutionsPerHour}`);
    }
  }, 300000);
}

/**
 * Run the bot if this file is executed directly
 */
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { JITMEVBot, main };
export default JITMEVBot;