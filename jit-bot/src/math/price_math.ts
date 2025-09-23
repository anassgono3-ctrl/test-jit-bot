import JSBI from 'jsbi';
import { sqrt } from './liquidity_math';

/**
 * Price Math utilities for Uniswap v3
 * Based on Uniswap v3 core SqrtPriceMath.sol
 * https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/SqrtPriceMath.sol
 */

export const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));
export const Q192 = JSBI.exponentiate(Q96, JSBI.BigInt(2));

/**
 * Gets the next sqrt price given a delta of token0
 * Always rounds up, because in the exact output case (increasing price) we need to move the price at least
 * far enough to get the desired output amount, and in the exact input case (decreasing price) we need to move the
 * price less in order to not send too much output.
 * The most precise formula for this is liquidity * sqrtPX96 / (liquidity +- amount * sqrtPX96),
 * if this is impossible because of overflow, we calculate liquidity / (liquidity / sqrtPX96 +- amount).
 * @param sqrtPX96 The starting price, i.e. before accounting for the token0 delta
 * @param liquidity The amount of usable liquidity
 * @param amount How much of token0 to add or remove from virtual reserves
 * @param add Whether to add or remove the amount of token0
 * @returns The price after adding or removing amount, depending on add
 */
export function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: JSBI,
  liquidity: JSBI,
  amount: JSBI,
  add: boolean
): JSBI {
  if (JSBI.equal(amount, JSBI.BigInt(0))) {
    return sqrtPX96;
  }
  
  const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96));
  
  if (add) {
    // Adding amount0 increases price (decreases sqrtPrice)
    // formula: liquidity * sqrtPX96 / (liquidity + amount * sqrtPX96)
    const product = JSBI.multiply(amount, sqrtPX96);
    const denominator = JSBI.add(numerator1, product);
    return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
  } else {
    // Removing amount0 decreases price (increases sqrtPrice) 
    // formula: liquidity * sqrtPX96 / (liquidity - amount * sqrtPX96)
    const product = JSBI.multiply(amount, sqrtPX96);
    
    if (JSBI.greaterThan(numerator1, product)) {
      const denominator = JSBI.subtract(numerator1, product);
      return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
    } else {
      // If we can't subtract, use alternative formula
      const quotient = JSBI.divide(numerator1, sqrtPX96);
      return JSBI.add(quotient, amount);
    }
  }
}

/**
 * Gets the next sqrt price given a delta of token1
 * Always rounds down, because in the exact output case (decreasing price) we need to move the price at least
 * far enough to get the desired output amount, and in the exact input case (increasing price) we need to move the
 * price less in order to not send too much output.
 * The formula we compute is within <1 wei of the lossless version: sqrtPX96 +- amount / liquidity
 * @param sqrtPX96 The starting price, i.e., before accounting for the token1 delta
 * @param liquidity The amount of usable liquidity
 * @param amount How much of token1 to add, or remove, from virtual reserves
 * @param add Whether to add, or remove, the amount of token1
 * @returns The price after adding or removing `amount`
 */
export function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: JSBI,
  liquidity: JSBI,
  amount: JSBI,
  add: boolean
): JSBI {
  if (add) {
    const quotient = JSBI.lessThanOrEqual(amount, JSBI.BigInt('0xffffffffffffffffffffffffffffffff'))
      ? JSBI.divide(JSBI.leftShift(amount, JSBI.BigInt(96)), liquidity)
      : JSBI.divide(JSBI.multiply(amount, Q96), liquidity);
    
    return JSBI.add(sqrtPX96, quotient);
  } else {
    const quotient = JSBI.lessThanOrEqual(amount, JSBI.BigInt('0xffffffffffffffffffffffffffffffff'))
      ? divRoundingUp(JSBI.leftShift(amount, JSBI.BigInt(96)), liquidity)
      : divRoundingUp(JSBI.multiply(amount, Q96), liquidity);
    
    if (JSBI.lessThanOrEqual(quotient, sqrtPX96)) {
      return JSBI.subtract(sqrtPX96, quotient);
    } else {
      throw new Error('Price cannot go below zero');
    }
  }
}

/**
 * Gets the next sqrt price given an input amount of token0 or token1
 * Throws if price or liquidity are 0, or if the next price is out of bounds
 * @param sqrtPX96 The starting price, i.e., before accounting for the input amount
 * @param liquidity The amount of usable liquidity
 * @param amountIn How much of token0, or token1, is being swapped in
 * @param zeroForOne Whether the amount in is token0 or token1
 * @returns The price after adding the input amount to token0 or token1
 */
export function getNextSqrtPriceFromInput(
  sqrtPX96: JSBI,
  liquidity: JSBI,
  amountIn: JSBI,
  zeroForOne: boolean
): JSBI {
  if (JSBI.lessThanOrEqual(sqrtPX96, JSBI.BigInt(0))) {
    throw new Error('Price cannot be zero or negative');
  }
  if (JSBI.lessThanOrEqual(liquidity, JSBI.BigInt(0))) {
    throw new Error('Liquidity cannot be zero or negative');
  }
  
  return zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
    : getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
}

/**
 * Gets the next sqrt price given an output amount of token0 or token1
 * Throws if price or liquidity are 0, or if the next price is out of bounds
 * @param sqrtPX96 The starting price before accounting for the output amount
 * @param liquidity The amount of usable liquidity
 * @param amountOut How much of token0, or token1, is being swapped out
 * @param zeroForOne Whether the amount out is token0 or token1
 * @returns The price after removing the output amount of token0 or token1
 */
export function getNextSqrtPriceFromOutput(
  sqrtPX96: JSBI,
  liquidity: JSBI,
  amountOut: JSBI,
  zeroForOne: boolean
): JSBI {
  if (JSBI.lessThanOrEqual(sqrtPX96, JSBI.BigInt(0))) {
    throw new Error('Price cannot be zero or negative');
  }
  if (JSBI.lessThanOrEqual(liquidity, JSBI.BigInt(0))) {
    throw new Error('Liquidity cannot be zero or negative');
  }
  
  return zeroForOne
    ? getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
    : getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
}

/**
 * Gets the amount0 delta between two prices
 * Calculates liquidity / sqrt(lower) - liquidity / sqrt(upper),
 * i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(lower) * sqrt(upper))
 * @param sqrtRatioAX96 A sqrt price
 * @param sqrtRatioBX96 Another sqrt price
 * @param liquidity The amount of usable liquidity
 * @param roundUp Whether to round the amount up or down
 * @returns The amount0 delta
 */
export function getAmount0Delta(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96));
  const numerator2 = JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96);
  
  if (JSBI.lessThanOrEqual(sqrtRatioAX96, JSBI.BigInt(0))) {
    throw new Error('Invalid sqrt ratio');
  }
  
  return roundUp
    ? divRoundingUp(
        mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
        sqrtRatioAX96
      )
    : JSBI.divide(
        JSBI.divide(JSBI.multiply(numerator1, numerator2), sqrtRatioBX96),
        sqrtRatioAX96
      );
}

/**
 * Gets the amount1 delta between two prices
 * Calculates liquidity * (sqrt(upper) - sqrt(lower))
 * @param sqrtRatioAX96 A sqrt price
 * @param sqrtRatioBX96 Another sqrt price
 * @param liquidity The amount of usable liquidity
 * @param roundUp Whether to round the amount up, or down
 * @returns The amount1 delta
 */
export function getAmount1Delta(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }
  
  return roundUp
    ? mulDivRoundingUp(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96), Q96)
    : JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)), Q96);
}

/**
 * Convert price to sqrtPriceX96 format
 * @param price the price to convert  
 * @returns sqrtPriceX96 representation
 */
export function priceToSqrtPriceX96(price: number): JSBI {
  if (price <= 0) {
    throw new Error('Price must be positive');
  }
  
  // Use high precision calculation
  // sqrtPrice = sqrt(price) * 2^96
  const sqrtPrice = Math.sqrt(price);
  const sqrtPriceBigInt = JSBI.BigInt(Math.floor(sqrtPrice * Math.pow(2, 96)));
  
  return sqrtPriceBigInt;
}

/**
 * Convert sqrtPriceX96 to readable price
 * @param sqrtPriceX96 the sqrtPriceX96 to convert
 * @returns human readable price
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: JSBI): number {
  // price = (sqrtPriceX96 / 2^96)^2
  const sqrtPrice = JSBI.toNumber(sqrtPriceX96) / Math.pow(2, 96);
  return sqrtPrice * sqrtPrice;
}

// Helper functions

/**
 * Add a signed liquidity delta to liquidity and revert if it overflows or underflows
 */
function addDelta(x: JSBI, y: JSBI): JSBI {
  if (JSBI.lessThan(y, JSBI.BigInt(0))) {
    const z = JSBI.subtract(x, JSBI.unaryMinus(y));
    if (JSBI.greaterThanOrEqual(z, x)) {
      throw new Error('Subtraction underflow');
    }
    return z;
  } else {
    const z = JSBI.add(x, y);
    if (JSBI.lessThan(z, x)) {
      throw new Error('Addition overflow');
    }
    return z;
  }
}

/**
 * Calculates floor(a×b÷denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
 * Equivalent to (a * b) / denominator but with overflow protection
 */
function mulDiv(a: JSBI, b: JSBI, denominator: JSBI): JSBI {
  if (JSBI.equal(denominator, JSBI.BigInt(0))) {
    throw new Error('Division by zero');
  }
  return JSBI.divide(JSBI.multiply(a, b), denominator);
}

/**
 * Calculates ceil(a×b÷denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
 */
function mulDivRoundingUp(a: JSBI, b: JSBI, denominator: JSBI): JSBI {
  const result = mulDiv(a, b, denominator);
  if (JSBI.greaterThan(JSBI.remainder(JSBI.multiply(a, b), denominator), JSBI.BigInt(0))) {
    if (JSBI.equal(result, JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'))) {
      throw new Error('Overflow in mulDivRoundingUp');
    }
    return JSBI.add(result, JSBI.BigInt(1));
  }
  return result;
}

/**
 * Calculates ceil(a÷b). Throws if b == 0
 */
function divRoundingUp(a: JSBI, b: JSBI): JSBI {
  if (JSBI.equal(b, JSBI.BigInt(0))) {
    throw new Error('Division by zero');
  }
  const result = JSBI.divide(a, b);
  return JSBI.greaterThan(JSBI.remainder(a, b), JSBI.BigInt(0))
    ? JSBI.add(result, JSBI.BigInt(1))
    : result;
}