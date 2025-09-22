import JSBI from 'jsbi';
import {
  getNextSqrtPriceFromAmount0RoundingUp,
  getNextSqrtPriceFromAmount1RoundingDown,
  getNextSqrtPriceFromInput,
  getNextSqrtPriceFromOutput,
  getAmount0Delta,
  getAmount1Delta,
  priceToSqrtPriceX96,
  sqrtPriceX96ToPrice,
  Q96
} from '../../src/math/price_math';

describe('PriceMath', () => {
  describe('getNextSqrtPriceFromAmount0RoundingUp', () => {
    const sqrtPrice = JSBI.BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96
    const liquidity = JSBI.BigInt('1000000000000000000'); // 1e18
    const amount = JSBI.BigInt('1000000000000000000'); // 1 ETH

    it('should increase price when adding amount0', () => {
      const newPrice = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, amount, true);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should decrease price when removing amount0', () => {
      const newPrice = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, amount, false);
      expect(JSBI.lessThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should return same price for zero amount', () => {
      const newPrice = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, JSBI.BigInt(0), true);
      expect(newPrice.toString()).toBe(sqrtPrice.toString());
    });

    it('should handle large amounts', () => {
      const largeAmount = JSBI.BigInt('10000000000000000000'); // 10 ETH
      const newPrice = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, largeAmount, true);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should be monotonic with amount', () => {
      const amount1 = JSBI.BigInt('1000000000000000000');
      const amount2 = JSBI.BigInt('2000000000000000000');
      
      const price1 = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, amount1, true);
      const price2 = getNextSqrtPriceFromAmount0RoundingUp(sqrtPrice, liquidity, amount2, true);
      
      expect(JSBI.greaterThan(price2, price1)).toBe(true);
    });
  });

  describe('getNextSqrtPriceFromAmount1RoundingDown', () => {
    const sqrtPrice = JSBI.BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96
    const liquidity = JSBI.BigInt('1000000000000000000'); // 1e18
    const amount = JSBI.BigInt('2000000000'); // 2000 USDC (6 decimals)

    it('should increase price when adding amount1', () => {
      const newPrice = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, amount, true);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should decrease price when removing amount1', () => {
      const newPrice = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, amount, false);
      expect(JSBI.lessThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should return same price for zero amount', () => {
      const newPrice = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, JSBI.BigInt(0), true);
      expect(newPrice.toString()).toBe(sqrtPrice.toString());
    });

    it('should handle large amounts', () => {
      const largeAmount = JSBI.BigInt('20000000000'); // 20,000 USDC
      const newPrice = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, largeAmount, true);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should throw when removing more than available', () => {
      const veryLargeAmount = JSBI.multiply(sqrtPrice, JSBI.BigInt(2));
      expect(() => getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, veryLargeAmount, false))
        .toThrow('Price cannot go below zero');
    });

    it('should be monotonic with amount', () => {
      const amount1 = JSBI.BigInt('1000000000');
      const amount2 = JSBI.BigInt('2000000000');
      
      const price1 = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, amount1, true);
      const price2 = getNextSqrtPriceFromAmount1RoundingDown(sqrtPrice, liquidity, amount2, true);
      
      expect(JSBI.greaterThan(price2, price1)).toBe(true);
    });
  });

  describe('getNextSqrtPriceFromInput', () => {
    const sqrtPrice = JSBI.BigInt('79228162514264337593543950336');
    const liquidity = JSBI.BigInt('1000000000000000000');
    const amount = JSBI.BigInt('1000000000000000000');

    it('should handle zero for one swap correctly', () => {
      const newPrice = getNextSqrtPriceFromInput(sqrtPrice, liquidity, amount, true);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should handle one for zero swap correctly', () => {
      const newPrice = getNextSqrtPriceFromInput(sqrtPrice, liquidity, amount, false);
      expect(JSBI.greaterThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should throw for zero price', () => {
      expect(() => getNextSqrtPriceFromInput(JSBI.BigInt(0), liquidity, amount, true))
        .toThrow('Price cannot be zero or negative');
    });

    it('should throw for zero liquidity', () => {
      expect(() => getNextSqrtPriceFromInput(sqrtPrice, JSBI.BigInt(0), amount, true))
        .toThrow('Liquidity cannot be zero or negative');
    });

    it('should handle zero amount input', () => {
      const newPrice = getNextSqrtPriceFromInput(sqrtPrice, liquidity, JSBI.BigInt(0), true);
      expect(newPrice.toString()).toBe(sqrtPrice.toString());
    });
  });

  describe('getNextSqrtPriceFromOutput', () => {
    const sqrtPrice = JSBI.BigInt('79228162514264337593543950336');
    const liquidity = JSBI.BigInt('1000000000000000000');
    const amount = JSBI.BigInt('1000000000000000000');

    it('should handle zero for one swap correctly', () => {
      const newPrice = getNextSqrtPriceFromOutput(sqrtPrice, liquidity, amount, true);
      expect(JSBI.lessThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should handle one for zero swap correctly', () => {
      const newPrice = getNextSqrtPriceFromOutput(sqrtPrice, liquidity, amount, false);
      expect(JSBI.lessThan(newPrice, sqrtPrice)).toBe(true);
    });

    it('should throw for zero price', () => {
      expect(() => getNextSqrtPriceFromOutput(JSBI.BigInt(0), liquidity, amount, true))
        .toThrow('Price cannot be zero or negative');
    });

    it('should throw for zero liquidity', () => {
      expect(() => getNextSqrtPriceFromOutput(sqrtPrice, JSBI.BigInt(0), amount, true))
        .toThrow('Liquidity cannot be zero or negative');
    });

    it('should handle zero amount output', () => {
      const newPrice = getNextSqrtPriceFromOutput(sqrtPrice, liquidity, JSBI.BigInt(0), true);
      expect(newPrice.toString()).toBe(sqrtPrice.toString());
    });

    it('should be inverse of getNextSqrtPriceFromInput for small amounts', () => {
      const smallAmount = JSBI.BigInt('100000000000000000'); // 0.1 ETH
      
      // Start with original price, add input, then remove same amount as output
      const priceAfterInput = getNextSqrtPriceFromInput(sqrtPrice, liquidity, smallAmount, true);
      const priceAfterOutput = getNextSqrtPriceFromOutput(priceAfterInput, liquidity, smallAmount, true);
      
      // Should be close to original (within rounding tolerance)
      const diff = JSBI.subtract(sqrtPrice, priceAfterOutput);
      const absDiff = JSBI.lessThan(diff, JSBI.BigInt(0)) ? JSBI.unaryMinus(diff) : diff;
      const tolerance = JSBI.divide(sqrtPrice, JSBI.BigInt(1000000)); // 0.0001% tolerance
      expect(JSBI.lessThanOrEqual(absDiff, tolerance)).toBe(true);
    });
  });

  describe('getAmount0Delta', () => {
    const sqrtRatioA = JSBI.BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96
    const sqrtRatioB = JSBI.BigInt('112045541949572279837463876454'); // sqrt(2) * 2^96
    const liquidity = JSBI.BigInt('1000000000000000000');

    it('should calculate amount0 delta correctly when rounding up', () => {
      const amount0 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      expect(JSBI.greaterThan(amount0, JSBI.BigInt(0))).toBe(true);
    });

    it('should calculate amount0 delta correctly when rounding down', () => {
      const amount0 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      expect(JSBI.greaterThan(amount0, JSBI.BigInt(0))).toBe(true);
    });

    it('should have rounding up result >= rounding down result', () => {
      const amount0Up = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      const amount0Down = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      expect(JSBI.greaterThanOrEqual(amount0Up, amount0Down)).toBe(true);
    });

    it('should handle swapped sqrt ratios', () => {
      const amount0_1 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      const amount0_2 = getAmount0Delta(sqrtRatioB, sqrtRatioA, liquidity, true);
      expect(amount0_1.toString()).toBe(amount0_2.toString());
    });

    it('should return zero for same sqrt ratios', () => {
      const amount0 = getAmount0Delta(sqrtRatioA, sqrtRatioA, liquidity, true);
      expect(amount0.toString()).toBe('0');
    });

    it('should be monotonic with liquidity', () => {
      const liquidity1 = JSBI.BigInt('1000000000000000000');
      const liquidity2 = JSBI.BigInt('2000000000000000000');
      
      const amount0_1 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity1, true);
      const amount0_2 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity2, true);
      
      expect(JSBI.greaterThan(amount0_2, amount0_1)).toBe(true);
    });

    it('should throw for invalid sqrt ratio', () => {
      expect(() => getAmount0Delta(JSBI.BigInt(0), sqrtRatioB, liquidity, true))
        .toThrow('Invalid sqrt ratio');
    });
  });

  describe('getAmount1Delta', () => {
    const sqrtRatioA = JSBI.BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96
    const sqrtRatioB = JSBI.BigInt('112045541949572279837463876454'); // sqrt(2) * 2^96
    const liquidity = JSBI.BigInt('1000000000000000000');

    it('should calculate amount1 delta correctly when rounding up', () => {
      const amount1 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      expect(JSBI.greaterThan(amount1, JSBI.BigInt(0))).toBe(true);
    });

    it('should calculate amount1 delta correctly when rounding down', () => {
      const amount1 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      expect(JSBI.greaterThan(amount1, JSBI.BigInt(0))).toBe(true);
    });

    it('should have rounding up result >= rounding down result', () => {
      const amount1Up = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      const amount1Down = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      expect(JSBI.greaterThanOrEqual(amount1Up, amount1Down)).toBe(true);
    });

    it('should handle swapped sqrt ratios', () => {
      const amount1_1 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, true);
      const amount1_2 = getAmount1Delta(sqrtRatioB, sqrtRatioA, liquidity, true);
      expect(amount1_1.toString()).toBe(amount1_2.toString());
    });

    it('should return zero for same sqrt ratios', () => {
      const amount1 = getAmount1Delta(sqrtRatioA, sqrtRatioA, liquidity, true);
      expect(amount1.toString()).toBe('0');
    });

    it('should be monotonic with liquidity', () => {
      const liquidity1 = JSBI.BigInt('1000000000000000000');
      const liquidity2 = JSBI.BigInt('2000000000000000000');
      
      const amount1_1 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity1, true);
      const amount1_2 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity2, true);
      
      expect(JSBI.greaterThan(amount1_2, amount1_1)).toBe(true);
    });
  });

  describe('priceToSqrtPriceX96', () => {
    it('should convert price 1 correctly', () => {
      const sqrtPriceX96 = priceToSqrtPriceX96(1);
      expect(JSBI.greaterThan(sqrtPriceX96, JSBI.BigInt(0))).toBe(true);
    });

    it('should convert price > 1 correctly', () => {
      const sqrtPriceX96_1 = priceToSqrtPriceX96(1);
      const sqrtPriceX96_2 = priceToSqrtPriceX96(4); // 2^2
      
      expect(JSBI.greaterThan(sqrtPriceX96_2, sqrtPriceX96_1)).toBe(true);
    });

    it('should convert price < 1 correctly', () => {
      const sqrtPriceX96_1 = priceToSqrtPriceX96(1);
      const sqrtPriceX96_quarter = priceToSqrtPriceX96(0.25); // (1/2)^2
      
      expect(JSBI.lessThan(sqrtPriceX96_quarter, sqrtPriceX96_1)).toBe(true);
    });

    it('should throw for zero price', () => {
      expect(() => priceToSqrtPriceX96(0)).toThrow('Price must be positive');
    });

    it('should throw for negative price', () => {
      expect(() => priceToSqrtPriceX96(-1)).toThrow('Price must be positive');
    });

    it('should be monotonic increasing', () => {
      const prices = [0.1, 0.5, 1, 2, 10];
      const sqrtPrices = prices.map(priceToSqrtPriceX96);
      
      for (let i = 1; i < sqrtPrices.length; i++) {
        expect(JSBI.greaterThan(sqrtPrices[i], sqrtPrices[i-1])).toBe(true);
      }
    });

    it('should handle very small prices', () => {
      const sqrtPriceX96 = priceToSqrtPriceX96(0.0001);
      expect(JSBI.greaterThan(sqrtPriceX96, JSBI.BigInt(0))).toBe(true);
    });

    it('should handle very large prices', () => {
      const sqrtPriceX96 = priceToSqrtPriceX96(1000000);
      expect(JSBI.greaterThan(sqrtPriceX96, JSBI.BigInt(0))).toBe(true);
    });
  });

  describe('sqrtPriceX96ToPrice', () => {
    it('should convert sqrt price correctly', () => {
      const originalPrice = 1.5;
      const sqrtPriceX96 = priceToSqrtPriceX96(originalPrice);
      const convertedPrice = sqrtPriceX96ToPrice(sqrtPriceX96);
      
      expect(convertedPrice).toBeCloseTo(originalPrice, 4);
    });

    it('should handle perfect squares', () => {
      const perfectSquares = [0.25, 1, 4, 16];
      
      for (const price of perfectSquares) {
        const sqrtPriceX96 = priceToSqrtPriceX96(price);
        const convertedPrice = sqrtPriceX96ToPrice(sqrtPriceX96);
        expect(convertedPrice).toBeCloseTo(price, 4);
      }
    });

    it('should be inverse of priceToSqrtPriceX96', () => {
      const testPrices = [0.1, 0.5, 1, 1.5, 2, 10, 100];
      
      for (const price of testPrices) {
        const sqrtPriceX96 = priceToSqrtPriceX96(price);
        const convertedPrice = sqrtPriceX96ToPrice(sqrtPriceX96);
        expect(convertedPrice).toBeCloseTo(price, 4);
      }
    });

    it('should handle minimum positive sqrt price', () => {
      const minSqrtPrice = JSBI.BigInt(1);
      const price = sqrtPriceX96ToPrice(minSqrtPrice);
      expect(price).toBeGreaterThan(0);
    });

    it('should be monotonic increasing', () => {
      const sqrtPrices = [
        JSBI.BigInt('39614081257132168796771975168'), // sqrt(0.25) * 2^96
        JSBI.BigInt('79228162514264337593543950336'), // sqrt(1) * 2^96  
        JSBI.BigInt('158456325028528675187087900672'), // sqrt(4) * 2^96
      ];
      
      const prices = sqrtPrices.map(sqrtPriceX96ToPrice);
      
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThan(prices[i-1]);
      }
    });
  });

  describe('constants', () => {
    it('should have correct Q96 value', () => {
      expect(Q96.toString()).toBe('79228162514264337593543950336');
    });
  });

  describe('integration tests', () => {
    it('should maintain consistency across price conversions', () => {
      const originalPrice = 2.5;
      
      // Convert to sqrt price and back
      const sqrtPriceX96 = priceToSqrtPriceX96(originalPrice);
      const convertedPrice = sqrtPriceX96ToPrice(sqrtPriceX96);
      
      expect(convertedPrice).toBeCloseTo(originalPrice, 4);
    });

    it('should maintain consistency with amount calculations', () => {
      const sqrtRatioA = JSBI.BigInt('79228162514264337593543950336'); // sqrt(1) * 2^96
      const sqrtRatioB = JSBI.BigInt('112045541949572279837463876454'); // sqrt(2) * 2^96
      const liquidity = JSBI.BigInt('1000000000000000000');
      
      // Calculate amounts and verify consistency
      const amount0 = getAmount0Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      const amount1 = getAmount1Delta(sqrtRatioA, sqrtRatioB, liquidity, false);
      
      expect(JSBI.greaterThan(amount0, JSBI.BigInt(0))).toBe(true);
      expect(JSBI.greaterThan(amount1, JSBI.BigInt(0))).toBe(true);
    });

    it('should handle complex swap scenarios', () => {
      const sqrtPrice = JSBI.BigInt('79228162514264337593543950336');
      const liquidity = JSBI.BigInt('1000000000000000000');
      const amountIn = JSBI.BigInt('100000000000000000'); // 0.1 ETH
      
      // Simulate zero for one swap
      const newPriceFromInput = getNextSqrtPriceFromInput(sqrtPrice, liquidity, amountIn, true);
      const amount1Out = getAmount1Delta(sqrtPrice, newPriceFromInput, liquidity, false);
      
      expect(JSBI.greaterThan(newPriceFromInput, sqrtPrice)).toBe(true);
      expect(JSBI.greaterThan(amount1Out, JSBI.BigInt(0))).toBe(true);
    });
  });
});