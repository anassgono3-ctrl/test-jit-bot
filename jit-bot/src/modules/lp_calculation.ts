import { Pool } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import { calculateOptimalTickRange, calculateLiquidityAmount, TickRange, LiquidityParams } from '../utils/uniswap_sdk_helpers';
import { getLiquidityForAmounts, priceToSqrtPriceX96 } from '../utils/math';

/**
 * LP Tick Calculation Module
 * Calculates optimal tick range based on pending swap simulation or historical data
 */

export interface LiquidityPosition {
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: JSBI;
  amount0: JSBI;
  amount1: JSBI;
  expectedFees: number;
  gaseCost: number;
  netProfit: number;
}

export interface SwapData {
  amount: number;
  tokenIn: string;
  tokenOut: string;
  expectedPriceImpact: number;
}

/**
 * Calculate optimal liquidity position for maximum fee capture
 */
export function calculateLiquidity(pool: Pool, swapData: SwapData): LiquidityPosition {
  try {
    // Calculate optimal tick range based on swap
    const tickRange = calculateOptimalTickRange(pool, swapData.amount);
    
    // Calculate liquidity amount based on available capital
    const maxAmount0 = JSBI.BigInt(1000000000000000000); // 1 ETH equivalent
    const maxAmount1 = JSBI.BigInt(2000000000); // 2000 USDC equivalent
    
    const liquidity = calculateLiquidityAmount(
      pool,
      tickRange.tickLower,
      tickRange.tickUpper,
      maxAmount0,
      maxAmount1
    );
    
    // Calculate token amounts required
    const sqrtRatioX96 = JSBI.BigInt(pool.sqrtRatioX96.toString());
    const sqrtRatioAX96 = priceToSqrtPriceX96(Math.pow(1.0001, tickRange.tickLower));
    const sqrtRatioBX96 = priceToSqrtPriceX96(Math.pow(1.0001, tickRange.tickUpper));
    
    const finalLiquidity = getLiquidityForAmounts(
      sqrtRatioX96,
      sqrtRatioAX96,
      sqrtRatioBX96,
      maxAmount0,
      maxAmount1
    );
    
    // Estimate expected fees (simplified calculation)
    const feeRate = pool.fee / 1000000; // Convert to decimal
    const expectedFees = swapData.amount * feeRate * 0.8; // Assume 80% fee capture
    
    // Estimate gas cost (will be refined in gas_utils)
    const gaseCost = 0.01; // Placeholder: $0.01 USD
    
    const netProfit = expectedFees - gaseCost;
    
    return {
      pool,
      tickLower: tickRange.tickLower,
      tickUpper: tickRange.tickUpper,
      liquidity: finalLiquidity,
      amount0: maxAmount0,
      amount1: maxAmount1,
      expectedFees,
      gaseCost,
      netProfit
    };
  } catch (error) {
    console.error('Error calculating liquidity position:', error);
    throw new Error(`Failed to calculate liquidity: ${error}`);
  }
}

/**
 * Calculate optimal tick range with dynamic width based on volatility
 */
export function calculateDynamicTickRange(
  pool: Pool,
  swapData: SwapData,
  volatility: number = 0.1
): TickRange {
  const baseWidth = 60; // Base tick width
  const volatilityMultiplier = Math.max(0.5, Math.min(2.0, volatility * 10));
  const dynamicWidth = Math.floor(baseWidth * volatilityMultiplier);
  
  return calculateOptimalTickRange(pool, swapData.amount, dynamicWidth);
}

/**
 * Calculate liquidity efficiency score
 */
export function calculateLiquidityEfficiency(
  position: LiquidityPosition,
  swapData: SwapData
): number {
  const capitalRequired = Number(position.amount0) + Number(position.amount1);
  const expectedReturn = position.expectedFees;
  
  if (capitalRequired === 0) return 0;
  
  const efficiency = (expectedReturn / capitalRequired) * 100;
  return Math.max(0, Math.min(100, efficiency));
}

/**
 * Validate liquidity position before execution
 */
export function validateLiquidityPosition(position: LiquidityPosition): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (JSBI.equal(position.liquidity, JSBI.BigInt(0))) {
    errors.push('Liquidity amount is zero');
  }
  
  if (position.tickLower >= position.tickUpper) {
    errors.push('Invalid tick range: tickLower must be less than tickUpper');
  }
  
  if (position.netProfit <= 0) {
    errors.push('Negative net profit - position not profitable');
  }
  
  const minProfitThreshold = 0.005; // $0.005 minimum profit
  if (position.netProfit < minProfitThreshold) {
    errors.push(`Profit below minimum threshold: ${position.netProfit} < ${minProfitThreshold}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}