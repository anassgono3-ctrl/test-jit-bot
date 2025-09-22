import JSBI from 'jsbi';
import { getSqrtRatioAtTick, getTickAtSqrtRatio, priceToTick, tickToPrice } from '../math/tick_math';
import { 
  getLiquidityForAmount0, 
  getLiquidityForAmount1, 
  getLiquidityForAmounts,
  getAmount0ForLiquidity,
  getAmount1ForLiquidity,
  getAmountsForLiquidity,
  sqrt 
} from '../math/liquidity_math';
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice } from '../math/price_math';

/**
 * Precision math utilities for liquidity calculations
 * @deprecated Use individual modules instead: tick_math, liquidity_math, price_math
 */

export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

// Re-export functions from the new modular structure for backward compatibility
export { 
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  priceToTick,
  tickToPrice,
  getLiquidityForAmount0,
  getLiquidityForAmount1,
  getLiquidityForAmounts,
  getAmount0ForLiquidity,
  getAmount1ForLiquidity,
  getAmountsForLiquidity,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
  sqrt
};

/**
 * Format JSBI to human readable number
 */
export function formatTokenAmount(amount: JSBI, decimals: number): string {
  const divisor = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals));
  const quotient = JSBI.divide(amount, divisor);
  const remainder = JSBI.remainder(amount, divisor);
  
  const quotientStr = quotient.toString();
  const remainderStr = remainder.toString().padStart(decimals, '0');
  
  return `${quotientStr}.${remainderStr.slice(0, 6)}`; // Show 6 decimal places
}