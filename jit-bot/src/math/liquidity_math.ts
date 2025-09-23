import JSBI from 'jsbi';

/**
 * Liquidity Math utilities for Uniswap v3
 * Based on Uniswap v3 core LiquidityMath.sol and supporting libraries
 * https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/LiquidityMath.sol
 */

export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

/**
 * Add a signed liquidity delta to liquidity and revert if it overflows or underflows
 * @param x the liquidity before change
 * @param y the delta by which liquidity should be changed
 * @returns the liquidity delta
 */
export function addDelta(x: JSBI, y: JSBI): JSBI {
  if (JSBI.lessThan(y, JSBI.BigInt(0))) {
    const deltaAbs = JSBI.unaryMinus(y);
    if (JSBI.greaterThan(deltaAbs, x)) {
      throw new Error('LS'); // Liquidity subtraction underflow
    }
    return JSBI.subtract(x, deltaAbs);
  } else {
    // Check for overflow - if x + y < x, then we overflowed
    const z = JSBI.add(x, y);
    if (JSBI.lessThan(z, x)) {
      throw new Error('LA'); // Liquidity addition overflow
    }
    return z;
  }
}

/**
 * Computes the amount of liquidity received for a given amount of token0 and price range
 * Calculates liquidity = amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary
 * @param amount0 The amount0 being sent in
 * @returns The amount of liquidity received
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
 * Computes the amount of liquidity received for a given amount of token1 and price range
 * Calculates liquidity = amount1 / (sqrt(upper) - sqrt(lower))
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary
 * @param amount1 The amount1 being sent in
 * @returns The amount of liquidity received
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
 * Computes the maximum amount of liquidity received for a given amount of token0, token1, the current
 * pool prices and the prices at the tick boundaries
 * @param sqrtRatioX96 A sqrt price representing the current pool prices
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary
 * @param amount0 The amount of token0 being sent in
 * @param amount1 The amount of token1 being sent in
 * @returns The amount of liquidity received
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
 * Computes the amount of token0 for a given amount of liquidity and a price range
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary  
 * @param liquidity The liquidity being valued
 * @returns The amount of token0
 */
export function getAmount0ForLiquidity(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return JSBI.divide(
    JSBI.multiply(
      JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96),
      JSBI.leftShift(liquidity, JSBI.BigInt(96))
    ),
    JSBI.multiply(sqrtRatioBX96, sqrtRatioAX96)
  );
}

/**
 * Computes the amount of token1 for a given amount of liquidity and a price range
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary
 * @param liquidity The liquidity being valued
 * @returns The amount of token1
 */
export function getAmount1ForLiquidity(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return JSBI.divide(
    JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)),
    Q96
  );
}

/**
 * Computes the token0 and token1 value for a given amount of liquidity, the current
 * pool prices and the prices at the tick boundaries
 * @param sqrtRatioX96 A sqrt price representing the current pool prices
 * @param sqrtRatioAX96 A sqrt price representing the first tick boundary
 * @param sqrtRatioBX96 A sqrt price representing the second tick boundary
 * @param liquidity The liquidity being valued
 * @returns The amounts of token0 and token1
 */
export function getAmountsForLiquidity(
  sqrtRatioX96: JSBI,
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI
): { amount0: JSBI; amount1: JSBI } {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  let amount0 = JSBI.BigInt(0);
  let amount1 = JSBI.BigInt(0);
  
  if (JSBI.lessThanOrEqual(sqrtRatioX96, sqrtRatioAX96)) {
    amount0 = getAmount0ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  } else if (JSBI.lessThan(sqrtRatioX96, sqrtRatioBX96)) {
    amount0 = getAmount0ForLiquidity(sqrtRatioX96, sqrtRatioBX96, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioX96, liquidity);
  } else {
    amount1 = getAmount1ForLiquidity(sqrtRatioAX96, sqrtRatioBX96, liquidity);
  }
  
  return { amount0, amount1 };
}

/**
 * Helper function to calculate square root using Newton's method
 * @param value The value to take square root of
 * @returns The square root
 */
export function sqrt(value: JSBI): JSBI {
  if (JSBI.equal(value, JSBI.BigInt(0))) {
    return JSBI.BigInt(0);
  }
  
  if (JSBI.equal(value, JSBI.BigInt(1))) {
    return JSBI.BigInt(1);
  }
  
  // Newton's method for integer square root
  let x = value;
  let y = JSBI.add(JSBI.divide(value, JSBI.BigInt(2)), JSBI.BigInt(1));
  
  while (JSBI.lessThan(y, x)) {
    x = y;
    y = JSBI.divide(
      JSBI.add(x, JSBI.divide(value, x)),
      JSBI.BigInt(2)
    );
  }
  
  return x;
}

/**
 * Calculate liquidity net for fee growth tracking
 * @param liquidityGross The total liquidity referencing the tick
 * @param liquidityNet The amount of liquidity added (subtracted) when tick is crossed from left to right (right to left)
 * @param upper Whether the tick is an upper tick
 * @returns The net liquidity change
 */
export function liquidityNet(liquidityGross: JSBI, liquidityNet: JSBI, upper: boolean): JSBI {
  return upper ? JSBI.unaryMinus(liquidityNet) : liquidityNet;
}