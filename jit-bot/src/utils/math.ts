import JSBI from 'jsbi';

/**
 * Precision math utilities for liquidity calculations
 */

export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

/**
 * Convert price to sqrtPriceX96 format
 */
export function priceToSqrtPriceX96(price: number): JSBI {
  const priceBigInt = JSBI.BigInt(Math.floor(price * 1e18));
  const sqrtPrice = sqrt(priceBigInt);
  return JSBI.multiply(sqrtPrice, Q96);
}

/**
 * Convert sqrtPriceX96 to readable price
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: JSBI): number {
  const sqrtPrice = JSBI.divide(sqrtPriceX96, Q96);
  const price = JSBI.multiply(sqrtPrice, sqrtPrice);
  return JSBI.toNumber(price) / 1e18;
}

/**
 * Calculate square root of a JSBI number
 */
export function sqrt(value: JSBI): JSBI {
  if (JSBI.equal(value, JSBI.BigInt(0))) {
    return JSBI.BigInt(0);
  }
  
  let z = JSBI.add(value, JSBI.BigInt(1));
  let y = value;
  
  while (JSBI.lessThan(z, y)) {
    y = z;
    z = JSBI.divide(
      JSBI.add(
        JSBI.divide(value, z),
        z
      ),
      JSBI.BigInt(2)
    );
  }
  
  return y;
}

/**
 * Calculate tick from price
 */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * Calculate price from tick
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

/**
 * Calculate liquidity from token amounts
 */
export function getLiquidityForAmounts(
  sqrtRatioX96: JSBI,
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: JSBI,
  amount1: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  if (JSBI.lessThanOrEqual(sqrtRatioX96, sqrtRatioAX96)) {
    return getLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0);
  } else if (JSBI.lessThan(sqrtRatioX96, sqrtRatioBX96)) {
    const liquidity0 = getLiquidityForAmount0(sqrtRatioX96, sqrtRatioBX96, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioX96, amount1);
    return JSBI.lessThan(liquidity0, liquidity1) ? liquidity0 : liquidity1;
  } else {
    return getLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1);
  }
}

/**
 * Calculate liquidity for amount0
 */
export function getLiquidityForAmount0(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  const intermediate = JSBI.divide(
    JSBI.multiply(sqrtRatioAX96, sqrtRatioBX96),
    Q96
  );
  
  return JSBI.divide(
    JSBI.multiply(amount0, intermediate),
    JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)
  );
}

/**
 * Calculate liquidity for amount1
 */
export function getLiquidityForAmount1(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount1: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return JSBI.divide(
    JSBI.multiply(amount1, Q96),
    JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)
  );
}

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