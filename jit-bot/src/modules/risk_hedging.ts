import { LiquidityPosition } from './lp_calculation';
import { ethers } from 'ethers';
import JSBI from 'jsbi';

/**
 * Hedging & Risk Management Module
 * Calculates token exposure after LP insertion
 * Simulates hedging via swaps to stablecoins
 */

export interface TokenExposure {
  token0Amount: number;
  token1Amount: number;
  token0ValueUSD: number;
  token1ValueUSD: number;
  totalValueUSD: number;
  exposureRatio: number; // 0-1, how much of total value is in volatile assets
}

export interface HedgeAction {
  shouldHedge: boolean;
  hedgeType: 'none' | 'partial' | 'full';
  token0Hedge: number; // Amount to hedge
  token1Hedge: number;
  estimatedCost: number;
  targetExposure: number;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
}

export interface RiskParameters {
  maxExposure: number; // Maximum exposure to volatile assets (0.0 - 1.0)
  hedgeThreshold: number; // Threshold to trigger hedging
  stablecoinTargets: string[]; // Preferred stablecoins for hedging
  maxSlippage: number; // Maximum slippage for hedge swaps
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface MarketData {
  ethPrice: number;
  btcPrice: number;
  volatilityETH: number;
  volatilityBTC: number;
  correlations: Map<string, number>;
}

/**
 * Default risk parameters
 */
export const DEFAULT_RISK_PARAMS: RiskParameters = {
  maxExposure: 0.7, // 70% max exposure to volatile assets
  hedgeThreshold: 0.8, // Hedge when exposure > 80%
  stablecoinTargets: ['USDC', 'USDT', 'DAI'],
  maxSlippage: 0.005, // 0.5% max slippage
  riskTolerance: 'medium'
};

/**
 * Calculate token exposure after LP insertion
 */
export function calculateTokenExposure(
  position: LiquidityPosition,
  marketData: MarketData
): TokenExposure {
  try {
    // Convert JSBI to numbers for calculation
    const token0Amount = Number(position.amount0) / 1e18; // Assume 18 decimals
    const token1Amount = Number(position.amount1) / 1e6;  // Assume 6 decimals for stablecoin
    
    // Calculate USD values
    const token0ValueUSD = token0Amount * marketData.ethPrice;
    const token1ValueUSD = token1Amount; // Assume token1 is stablecoin
    const totalValueUSD = token0ValueUSD + token1ValueUSD;
    
    // Calculate exposure ratio (how much is in volatile assets)
    const exposureRatio = totalValueUSD > 0 ? token0ValueUSD / totalValueUSD : 0;
    
    return {
      token0Amount,
      token1Amount,
      token0ValueUSD,
      token1ValueUSD,
      totalValueUSD,
      exposureRatio
    };
  } catch (error) {
    console.error('Error calculating token exposure:', error);
    throw new Error(`Failed to calculate exposure: ${error}`);
  }
}

/**
 * Determine if hedging is needed and what type
 */
export function hedgePosition(
  position: LiquidityPosition,
  marketData?: MarketData,
  riskParams: RiskParameters = DEFAULT_RISK_PARAMS
): HedgeAction {
  try {
    // Use default market data if not provided
    const market = marketData || getDefaultMarketData();
    
    // Calculate current exposure
    const exposure = calculateTokenExposure(position, market);
    
    console.log(`Current exposure: ${(exposure.exposureRatio * 100).toFixed(1)}% volatile assets`);
    
    // Determine if hedging is needed
    const shouldHedge = exposure.exposureRatio > riskParams.hedgeThreshold;
    
    if (!shouldHedge) {
      return {
        shouldHedge: false,
        hedgeType: 'none',
        token0Hedge: 0,
        token1Hedge: 0,
        estimatedCost: 0,
        targetExposure: exposure.exposureRatio,
        urgency: 'low',
        reason: 'Exposure within acceptable limits'
      };
    }
    
    // Calculate hedge amounts
    const targetExposure = riskParams.maxExposure;
    const excessExposure = exposure.exposureRatio - targetExposure;
    
    // Amount to hedge (reduce volatile token exposure)
    const hedgeValueUSD = exposure.totalValueUSD * excessExposure;
    const token0Hedge = hedgeValueUSD / market.ethPrice;
    
    // Determine hedge type and urgency
    const hedgeType = getHedgeType(exposure.exposureRatio, riskParams);
    const urgency = getHedgeUrgency(exposure.exposureRatio, market.volatilityETH, riskParams);
    
    // Estimate hedge cost (slippage + fees)
    const estimatedCost = calculateHedgeCost(token0Hedge, market, riskParams);
    
    return {
      shouldHedge: true,
      hedgeType,
      token0Hedge,
      token1Hedge: 0, // Usually don't hedge stablecoins
      estimatedCost,
      targetExposure,
      urgency,
      reason: `Exposure ${(exposure.exposureRatio * 100).toFixed(1)}% exceeds threshold ${(riskParams.hedgeThreshold * 100).toFixed(1)}%`
    };
    
  } catch (error) {
    console.error('Error in hedge calculation:', error);
    return {
      shouldHedge: false,
      hedgeType: 'none',
      token0Hedge: 0,
      token1Hedge: 0,
      estimatedCost: 0,
      targetExposure: 0,
      urgency: 'low',
      reason: `Error: ${error}`
    };
  }
}

/**
 * Execute hedge strategy
 */
export async function executeHedge(
  hedgeAction: HedgeAction,
  signer: ethers.Signer,
  riskParams: RiskParameters = DEFAULT_RISK_PARAMS
): Promise<{
  success: boolean;
  txHash?: string;
  actualCost: number;
  newExposure: number;
  error?: string;
}> {
  if (!hedgeAction.shouldHedge) {
    return {
      success: true,
      actualCost: 0,
      newExposure: hedgeAction.targetExposure
    };
  }
  
  try {
    console.log(`Executing ${hedgeAction.hedgeType} hedge for ${hedgeAction.token0Hedge.toFixed(4)} ETH`);
    
    // In a real implementation, this would execute actual swaps
    // For simulation, we'll calculate expected results
    
    const swapAmount = ethers.parseEther(hedgeAction.token0Hedge.toString());
    const minAmountOut = ethers.parseUnits(
      (hedgeAction.token0Hedge * 1800 * (1 - riskParams.maxSlippage)).toFixed(6),
      6
    ); // Convert to USDC
    
    // Simulate swap transaction
    const simulatedTx = await simulateHedgeSwap(swapAmount, minAmountOut, signer);
    
    if (simulatedTx.success) {
      console.log(`Hedge executed successfully. Cost: $${simulatedTx.cost.toFixed(4)}`);
      
      return {
        success: true,
        txHash: simulatedTx.txHash,
        actualCost: simulatedTx.cost,
        newExposure: hedgeAction.targetExposure
      };
    } else {
      throw new Error(simulatedTx.error);
    }
    
  } catch (error) {
    console.error('Hedge execution failed:', error);
    return {
      success: false,
      actualCost: 0,
      newExposure: hedgeAction.targetExposure,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Simulate hedge swap (for testing without actual execution)
 */
async function simulateHedgeSwap(
  amountIn: bigint,
  amountOutMin: bigint,
  signer: ethers.Signer
): Promise<{
  success: boolean;
  txHash?: string;
  cost: number;
  error?: string;
}> {
  try {
    // Simulate successful swap
    const slippage = Math.random() * 0.003; // 0-0.3% slippage
    const gasCost = 0.005; // $5 gas cost
    const actualCost = Number(amountIn) / 1e18 * slippage + gasCost;
    
    return {
      success: true,
      txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      cost: actualCost
    };
  } catch (error) {
    return {
      success: false,
      cost: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Get hedge type based on exposure level
 */
function getHedgeType(exposureRatio: number, riskParams: RiskParameters): 'none' | 'partial' | 'full' {
  if (exposureRatio < riskParams.hedgeThreshold) return 'none';
  if (exposureRatio > 0.9) return 'full'; // 90%+ exposure requires full hedge
  return 'partial';
}

/**
 * Get hedge urgency based on exposure and volatility
 */
function getHedgeUrgency(
  exposureRatio: number,
  volatility: number,
  riskParams: RiskParameters
): 'low' | 'medium' | 'high' {
  const riskScore = exposureRatio * volatility;
  
  if (riskScore > 0.15) return 'high';   // High exposure + high volatility
  if (riskScore > 0.08) return 'medium'; // Medium risk
  return 'low';
}

/**
 * Calculate estimated cost of hedging
 */
function calculateHedgeCost(
  hedgeAmount: number,
  marketData: MarketData,
  riskParams: RiskParameters
): number {
  // Slippage cost
  const slippageCost = hedgeAmount * marketData.ethPrice * riskParams.maxSlippage;
  
  // Gas cost (estimated)
  const gasCost = 0.01; // $0.01 USD
  
  // Protocol fees (0.3% for most pairs)
  const protocolFees = hedgeAmount * marketData.ethPrice * 0.003;
  
  return slippageCost + gasCost + protocolFees;
}

/**
 * Get default market data for simulation
 */
function getDefaultMarketData(): MarketData {
  return {
    ethPrice: 1800,
    btcPrice: 35000,
    volatilityETH: 0.15, // 15% daily volatility
    volatilityBTC: 0.12, // 12% daily volatility
    correlations: new Map([
      ['ETH-BTC', 0.8],
      ['ETH-USD', -0.1],
      ['BTC-USD', -0.1]
    ])
  };
}

/**
 * Monitor position and adjust hedges
 */
export async function monitorAndHedge(
  position: LiquidityPosition,
  signer: ethers.Signer,
  riskParams: RiskParameters = DEFAULT_RISK_PARAMS
): Promise<void> {
  console.log('Starting position monitoring and hedging...');
  
  const checkInterval = 30000; // Check every 30 seconds
  
  const monitor = setInterval(async () => {
    try {
      const marketData = getDefaultMarketData();
      const hedgeAction = hedgePosition(position, marketData, riskParams);
      
      if (hedgeAction.shouldHedge && hedgeAction.urgency === 'high') {
        console.log('High urgency hedge required - executing immediately');
        await executeHedge(hedgeAction, signer, riskParams);
      } else if (hedgeAction.shouldHedge) {
        console.log(`Hedge recommended but not urgent (${hedgeAction.urgency})`);
      }
      
    } catch (error) {
      console.error('Error in monitoring:', error);
    }
  }, checkInterval);
  
  // Stop monitoring after 10 minutes (for demo purposes)
  setTimeout(() => {
    clearInterval(monitor);
    console.log('Stopped position monitoring');
  }, 600000);
}

/**
 * Calculate portfolio risk metrics
 */
export function calculatePortfolioRisk(
  positions: LiquidityPosition[],
  marketData: MarketData
): {
  totalValue: number;
  totalExposure: number;
  diversificationScore: number;
  riskScore: number;
  recommendations: string[];
} {
  let totalValue = 0;
  let totalVolatileValue = 0;
  const recommendations: string[] = [];
  
  // Calculate total exposure across all positions
  for (const position of positions) {
    const exposure = calculateTokenExposure(position, marketData);
    totalValue += exposure.totalValueUSD;
    totalVolatileValue += exposure.token0ValueUSD; // Assuming token0 is always volatile
  }
  
  const totalExposure = totalValue > 0 ? totalVolatileValue / totalValue : 0;
  
  // Calculate diversification score (simplified)
  const uniqueTokens = new Set();
  positions.forEach(pos => {
    uniqueTokens.add(pos.pool.token0.address);
    uniqueTokens.add(pos.pool.token1.address);
  });
  const diversificationScore = Math.min(100, uniqueTokens.size * 20);
  
  // Calculate overall risk score
  const riskScore = (totalExposure * 0.6) + ((100 - diversificationScore) / 100 * 0.4);
  
  // Generate recommendations
  if (totalExposure > 0.8) {
    recommendations.push('High exposure to volatile assets - consider hedging');
  }
  if (diversificationScore < 40) {
    recommendations.push('Low diversification - consider adding more token pairs');
  }
  if (riskScore > 0.7) {
    recommendations.push('High overall risk - reduce position sizes or add hedges');
  }
  
  return {
    totalValue,
    totalExposure,
    diversificationScore,
    riskScore: riskScore * 100,
    recommendations
  };
}