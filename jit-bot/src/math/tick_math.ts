import JSBI from 'jsbi';

/**
 * Tick Math utilities for Uniswap v3
 * Based on Uniswap v3 core TickMath.sol
 * https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol
 */

// Constants from Uniswap v3 core
export const MIN_TICK = -887272;
export const MAX_TICK = -MIN_TICK;

export const MIN_SQRT_RATIO = JSBI.BigInt('4295128739');
export const MAX_SQRT_RATIO = JSBI.BigInt('1461446703485210103287273052203988822378723970342');

/**
 * Returns the sqrt ratio as a Q64.96 for the given tick. The sqrt ratio is computed as sqrt(1.0001^tick) * 2^96.
 * Throws if |tick| > max tick
 * @param tick the tick for which to compute the sqrt ratio
 */
export function getSqrtRatioAtTick(tick: number): JSBI {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error('TICK');
  }

  const absTick = tick < 0 ? -tick : tick;

  // Magic numbers from Uniswap v3 core implementation
  let ratio = JSBI.BigInt((absTick & 0x1) !== 0 ? '0xfffcb933bd6fad37aa2d162d1a594001' : '0x100000000000000000000000000000000');
  if ((absTick & 0x2) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xfff97272373d413259a46990580e213a')), JSBI.BigInt(128));
  if ((absTick & 0x4) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')), JSBI.BigInt(128));
  if ((absTick & 0x8) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')), JSBI.BigInt(128));
  if ((absTick & 0x10) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xffcb9843d60f6159c9db58835c926644')), JSBI.BigInt(128));
  if ((absTick & 0x20) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xff973b41fa98c081472e6896dfb254c0')), JSBI.BigInt(128));
  if ((absTick & 0x40) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xff2ea16466c96a3843ec78b326b52861')), JSBI.BigInt(128));
  if ((absTick & 0x80) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xfe5dee046a99a2a811c461f1969c3053')), JSBI.BigInt(128));
  if ((absTick & 0x100) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')), JSBI.BigInt(128));
  if ((absTick & 0x200) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xf987a7253ac413176f2b074cf7815e54')), JSBI.BigInt(128));
  if ((absTick & 0x400) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xf3392b0822b70005940c7a398e4b70f3')), JSBI.BigInt(128));
  if ((absTick & 0x800) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')), JSBI.BigInt(128));
  if ((absTick & 0x1000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')), JSBI.BigInt(128));
  if ((absTick & 0x2000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')), JSBI.BigInt(128));
  if ((absTick & 0x4000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x70d869a156d2a1b890bb3df62baf32f7')), JSBI.BigInt(128));
  if ((absTick & 0x8000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x31be135f97d08fd981231505542fcfa6')), JSBI.BigInt(128));
  if ((absTick & 0x10000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')), JSBI.BigInt(128));
  if ((absTick & 0x20000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x5d6af8dedb81196699c329225ee604')), JSBI.BigInt(128));
  if ((absTick & 0x40000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x2216e584f5fa1ea926041bedfe98')), JSBI.BigInt(128));
  if ((absTick & 0x80000) !== 0) ratio = JSBI.signedRightShift(JSBI.multiply(ratio, JSBI.BigInt('0x48a170391f7dc42444e8fa2')), JSBI.BigInt(128));

  if (tick > 0) ratio = JSBI.divide(JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'), ratio);

  // this divides by 1<<32 rounding up to go from a Q128.128 to a Q128.96.
  // we then downcast because we know the result always fits within 160 bits due to our tick input constraint
  // we round up in the division so getTickAtSqrtRatio of the output price is always consistent
  return JSBI.greaterThan(JSBI.remainder(ratio, JSBI.BigInt('4294967296')), JSBI.BigInt(0))
    ? JSBI.add(JSBI.divide(ratio, JSBI.BigInt('4294967296')), JSBI.BigInt(1))
    : JSBI.divide(ratio, JSBI.BigInt('4294967296'));
}

/**
 * Returns the tick corresponding to a given sqrt ratio, s.t. #getSqrtRatioAtTick(tick) <= sqrtRatioX96
 * and #getSqrtRatioAtTick(tick + 1) > sqrtRatioX96
 * @param sqrtRatioX96 the sqrt ratio as a Q64.96 for which to compute the tick
 */
export function getTickAtSqrtRatio(sqrtRatioX96: JSBI): number {
  if (JSBI.lessThan(sqrtRatioX96, MIN_SQRT_RATIO) || JSBI.greaterThanOrEqual(sqrtRatioX96, MAX_SQRT_RATIO)) {
    throw new Error('SQRT_RATIO');
  }

  // Use binary search to find the tick - simpler and more reliable than bit manipulation
  let low = MIN_TICK;
  let high = MAX_TICK;
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const sqrtRatioAtMid = getSqrtRatioAtTick(mid);
    
    if (JSBI.equal(sqrtRatioAtMid, sqrtRatioX96)) {
      return mid;
    } else if (JSBI.lessThan(sqrtRatioAtMid, sqrtRatioX96)) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  
  return high;
}

/**
 * Convert a price to a tick using exact math
 * @param price the price to convert
 */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

/**
 * Convert a tick to a price using exact math
 * @param tick the tick to convert
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}