import { Pool, FeeAmount } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import pools from '../config/pools.json';

/**
 * Pool Management & Dynamic Thresholds Module
 * Tracks three target pools, swaps detected locally or simulated
 * Prioritizes pool execution based on potential fees vs gas cost
 */

export interface PoolConfig {
  name: string;
  address: string;
  feeTier: number;
}

export interface PoolState {
  pool: Pool;
  config: PoolConfig;
  liquidity: bigint;
  price: number;
  volume24h: number;
  fees24h: number;
  volatility: number;
  lastUpdate: number;
  isActive: boolean;
  priority: number;
}

export interface SwapOpportunity {
  poolAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  expectedAmountOut: bigint;
  priceImpact: number;
  estimatedFees: number;
  gasCost: number;
  netProfit: number;
  urgency: 'low' | 'medium' | 'high';
}

/**
 * Pool Manager Class
 */
export class PoolManager {
  private pools: Map<string, PoolState> = new Map();
  private provider: ethers.Provider;
  private opportunities: SwapOpportunity[] = [];
  private monitoringActive: boolean = false;
  
  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.initializePools();
  }
  
  /**
   * Initialize all configured pools
   */
  private async initializePools(): Promise<void> {
    console.log('Initializing pools...');
    
    for (const poolConfig of pools) {
      try {
        const poolState = await this.createPoolState(poolConfig);
        this.pools.set(poolConfig.address, poolState);
        console.log(`Initialized pool: ${poolConfig.name}`);
      } catch (error) {
        console.error(`Failed to initialize pool ${poolConfig.name}:`, error);
      }
    }
  }
  
  /**
   * Create pool state from configuration
   */
  private async createPoolState(config: PoolConfig): Promise<PoolState> {
    // Use real mainnet token addresses
    let token0: Token, token1: Token;
    
    // Determine tokens based on pool name
    if (config.name.includes('WETH-USDC')) {
      token0 = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
      token1 = new Token(1, '0xA0b86a33E6441c476DECC4E6Af09e9C4F8eB0fC8', 6, 'USDC', 'USD Coin');
    } else if (config.name.includes('ETH-USDT')) {
      token0 = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
      token1 = new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD');
    } else if (config.name.includes('WBTC-ETH')) {
      token0 = new Token(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped BTC');
      token1 = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
    } else {
      // Default tokens
      token0 = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
      token1 = new Token(1, '0xA0b86a33E6441c476DECC4E6Af09e9C4F8eB0fC8', 6, 'USDC', 'USD Coin');
    }
    
    // Convert fee tier to FeeAmount enum
    let feeAmount: FeeAmount;
    if (config.feeTier === 0.0005) {
      feeAmount = FeeAmount.LOWEST;
    } else if (config.feeTier === 0.003) {
      feeAmount = FeeAmount.MEDIUM;
    } else {
      feeAmount = FeeAmount.HIGH;
    }
    
    // Create mock pool (in reality, this would be fetched from chain)
    const pool = new Pool(
      token0,
      token1,
      feeAmount,
      '1771595571142957166768892000000000000000000000000000000', // sqrtPriceX96
      '10272714827896220757', // liquidity
      -74959 // tickCurrent
    );
    
    return {
      pool,
      config,
      liquidity: BigInt('10272714827896220757'),
      price: 1800, // ETH/USD price
      volume24h: 50000000, // $50M daily volume
      fees24h: 150000, // $150k daily fees
      volatility: 0.15, // 15% volatility
      lastUpdate: Date.now(),
      isActive: true,
      priority: this.calculatePoolPriority(config)
    };
  }
  
  /**
   * Calculate pool priority based on various factors
   */
  private calculatePoolPriority(config: PoolConfig): number {
    // Priority factors: fee tier, historical volume, pool name recognition
    let priority = 50; // Base priority
    
    // Higher fee tiers get higher priority (more fees)
    if (config.feeTier === 0.003) priority += 20;
    if (config.feeTier === 0.01) priority += 30;
    
    // Well-known pairs get priority boost
    if (config.name.includes('WETH-USDC')) priority += 25;
    if (config.name.includes('WBTC-ETH')) priority += 15;
    
    return Math.min(100, priority);
  }
  
  /**
   * Select pool for next swap operation
   */
  public selectPoolForNextSwap(): PoolState | null {
    if (this.pools.size === 0) {
      console.log('No pools available');
      return null;
    }
    
    // Filter active pools
    const activePools = Array.from(this.pools.values()).filter(pool => pool.isActive);
    
    if (activePools.length === 0) {
      console.log('No active pools');
      return null;
    }
    
    // Sort by priority and recent activity
    activePools.sort((a, b) => {
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;
      
      // If priorities are equal, prefer pools with higher volume
      return b.volume24h - a.volume24h;
    });
    
    const selectedPool = activePools[0];
    console.log(`Selected pool: ${selectedPool.config.name} (Priority: ${selectedPool.priority})`);
    
    return selectedPool;
  }
  
  /**
   * Update pool state with latest data
   */
  public async updatePoolState(poolAddress: string): Promise<void> {
    const poolState = this.pools.get(poolAddress);
    if (!poolState) {
      console.error(`Pool not found: ${poolAddress}`);
      return;
    }
    
    try {
      // In a real implementation, fetch current data from blockchain
      const now = Date.now();
      const timeDiff = now - poolState.lastUpdate;
      
      // Simulate price movement
      const priceChange = (Math.random() - 0.5) * 0.02; // ±1% change
      poolState.price *= (1 + priceChange);
      
      // Update volume (simplified)
      poolState.volume24h += Math.random() * 1000000; // Add up to $1M volume
      
      // Update fees
      poolState.fees24h = poolState.volume24h * poolState.config.feeTier;
      
      // Update volatility based on price changes
      poolState.volatility = Math.abs(priceChange) * 10;
      
      poolState.lastUpdate = now;
      
      // Recalculate priority
      poolState.priority = this.calculateDynamicPriority(poolState);
      
      console.log(`Updated pool ${poolState.config.name}: Price: $${poolState.price.toFixed(2)}, Volume: $${poolState.volume24h.toFixed(0)}`);
      
    } catch (error) {
      console.error(`Failed to update pool ${poolAddress}:`, error);
    }
  }
  
  /**
   * Calculate dynamic priority based on current conditions
   */
  private calculateDynamicPriority(poolState: PoolState): number {
    let priority = this.calculatePoolPriority(poolState.config);
    
    // Boost priority for high volume pools
    if (poolState.volume24h > 100000000) priority += 15; // $100M+
    if (poolState.volume24h > 50000000) priority += 10;  // $50M+
    
    // Boost priority for high volatility (more MEV opportunities)
    if (poolState.volatility > 0.2) priority += 10; // 20%+ volatility
    if (poolState.volatility > 0.1) priority += 5;  // 10%+ volatility
    
    // Reduce priority if pool is stale
    const staleness = Date.now() - poolState.lastUpdate;
    if (staleness > 60000) priority -= 20; // 1 minute stale
    if (staleness > 300000) priority -= 50; // 5 minutes stale
    
    return Math.max(0, Math.min(100, priority));
  }
  
  /**
   * Detect swap opportunities in pools
   */
  public async detectSwapOpportunities(): Promise<SwapOpportunity[]> {
    const opportunities: SwapOpportunity[] = [];
    
    for (const poolState of this.pools.values()) {
      if (!poolState.isActive) continue;
      
      // Simulate detecting a large pending swap
      const hasOpportunity = Math.random() > 0.7; // 30% chance of opportunity
      
      if (hasOpportunity) {
        const opportunity = await this.createSwapOpportunity(poolState);
        if (opportunity) {
          opportunities.push(opportunity);
        }
      }
    }
    
    // Sort by net profit descending
    opportunities.sort((a, b) => b.netProfit - a.netProfit);
    
    this.opportunities = opportunities;
    return opportunities;
  }
  
  /**
   * Create swap opportunity from pool state
   */
  private async createSwapOpportunity(poolState: PoolState): Promise<SwapOpportunity | null> {
    try {
      // Simulate a large swap that creates MEV opportunity
      const swapAmountETH = 10 + Math.random() * 90; // 10-100 ETH
      const amountIn = BigInt(Math.floor(swapAmountETH * 1e18));
      
      // Calculate expected output and price impact
      const priceImpact = this.calculatePriceImpact(poolState, amountIn);
      const expectedAmountOut = BigInt(Math.floor(swapAmountETH * poolState.price * 0.99)); // 1% slippage
      
      // Estimate fees we can capture
      const estimatedFees = swapAmountETH * poolState.config.feeTier * 0.8; // 80% capture rate
      
      // Estimate gas cost
      const gasCost = 0.02; // $0.02 USD
      
      const netProfit = estimatedFees - gasCost;
      
      // Only consider profitable opportunities
      if (netProfit <= 0.005) return null; // Minimum $0.005 profit
      
      return {
        poolAddress: poolState.config.address,
        tokenIn: poolState.pool.token0.address,
        tokenOut: poolState.pool.token1.address,
        amountIn,
        expectedAmountOut,
        priceImpact,
        estimatedFees,
        gasCost,
        netProfit,
        urgency: this.calculateUrgency(netProfit, priceImpact)
      };
    } catch (error) {
      console.error('Error creating swap opportunity:', error);
      return null;
    }
  }
  
  /**
   * Calculate price impact for swap
   */
  private calculatePriceImpact(poolState: PoolState, amountIn: bigint): number {
    const liquidityUSD = Number(poolState.liquidity) * poolState.price / 1e18;
    const swapUSD = Number(amountIn) * poolState.price / 1e18;
    
    return (swapUSD / liquidityUSD) * 100; // Simplified calculation
  }
  
  /**
   * Calculate urgency based on profit and impact
   */
  private calculateUrgency(netProfit: number, priceImpact: number): 'low' | 'medium' | 'high' {
    if (netProfit > 1.0 || priceImpact > 2.0) return 'high';
    if (netProfit > 0.1 || priceImpact > 0.5) return 'medium';
    return 'low';
  }
  
  /**
   * Get all pools
   */
  public getAllPools(): PoolState[] {
    return Array.from(this.pools.values());
  }
  
  /**
   * Get pool by address
   */
  public getPool(address: string): PoolState | null {
    return this.pools.get(address) || null;
  }
  
  /**
   * Start monitoring pools
   */
  public startMonitoring(): void {
    if (this.monitoringActive) return;
    
    this.monitoringActive = true;
    console.log('Starting pool monitoring...');
    
    // Update pools every 10 seconds
    const updateInterval = setInterval(async () => {
      if (!this.monitoringActive) {
        clearInterval(updateInterval);
        return;
      }
      
      for (const [address] of this.pools) {
        await this.updatePoolState(address);
      }
    }, 10000);
    
    // Detect opportunities every 5 seconds
    const opportunityInterval = setInterval(async () => {
      if (!this.monitoringActive) {
        clearInterval(opportunityInterval);
        return;
      }
      
      await this.detectSwapOpportunities();
    }, 5000);
  }
  
  /**
   * Stop monitoring pools
   */
  public stopMonitoring(): void {
    this.monitoringActive = false;
    console.log('Stopped pool monitoring');
  }
  
  /**
   * Get current opportunities
   */
  public getCurrentOpportunities(): SwapOpportunity[] {
    return this.opportunities;
  }
}

/**
 * Create pool manager instance
 */
export function createPoolManager(provider: ethers.Provider): PoolManager {
  return new PoolManager(provider);
}

/**
 * Standalone function to select pool for next swap (for backward compatibility)
 */
export function selectPoolForNextSwap(poolManager?: PoolManager): PoolState | null {
  if (!poolManager) {
    console.error('Pool manager not provided');
    return null;
  }
  
  return poolManager.selectPoolForNextSwap();
}