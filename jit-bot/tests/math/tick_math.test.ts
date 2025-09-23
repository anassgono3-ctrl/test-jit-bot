import JSBI from 'jsbi';
import {
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  priceToTick,
  tickToPrice,
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO
} from '../../src/math/tick_math';

describe('TickMath', () => {
  describe('getSqrtRatioAtTick', () => {
    it('should return correct sqrt ratio for tick 0', () => {
      const sqrtRatio = getSqrtRatioAtTick(0);
      expect(sqrtRatio.toString()).toBe('79228162514264337593543950336');
    });

    it('should return correct sqrt ratio for positive tick', () => {
      const sqrtRatio = getSqrtRatioAtTick(60);
      expect(JSBI.greaterThan(sqrtRatio, JSBI.BigInt('79228162514264337593543950336'))).toBe(true);
    });

    it('should return correct sqrt ratio for negative tick', () => {
      const sqrtRatio = getSqrtRatioAtTick(-60);
      expect(JSBI.lessThan(sqrtRatio, JSBI.BigInt('79228162514264337593543950336'))).toBe(true);
    });

    it('should handle min tick', () => {
      const sqrtRatio = getSqrtRatioAtTick(MIN_TICK);
      expect(sqrtRatio.toString()).toBe(MIN_SQRT_RATIO.toString());
    });

    it('should handle max tick', () => {
      const sqrtRatio = getSqrtRatioAtTick(MAX_TICK);
      expect(JSBI.lessThanOrEqual(sqrtRatio, MAX_SQRT_RATIO)).toBe(true);
    });

    it('should throw for tick below min', () => {
      expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow('TICK');
    });

    it('should throw for tick above max', () => {
      expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow('TICK');
    });

    it('should be monotonic increasing', () => {
      const sqrt1 = getSqrtRatioAtTick(100);
      const sqrt2 = getSqrtRatioAtTick(101);
      expect(JSBI.greaterThan(sqrt2, sqrt1)).toBe(true);
    });
  });

  describe('getTickAtSqrtRatio', () => {
    it('should return tick 0 for ratio at tick 0', () => {
      const sqrtRatio = getSqrtRatioAtTick(0);
      const tick = getTickAtSqrtRatio(sqrtRatio);
      expect(tick).toBe(0);
    });

    it('should return correct tick for known sqrt ratios', () => {
      const testTicks = [-887200, -100000, -60, 0, 60, 100000, 887200];
      
      for (const expectedTick of testTicks) {
        const sqrtRatio = getSqrtRatioAtTick(expectedTick);
        const actualTick = getTickAtSqrtRatio(sqrtRatio);
        expect(actualTick).toBe(expectedTick);
      }
    });

    it('should throw for sqrt ratio below min', () => {
      const sqrtRatio = JSBI.subtract(MIN_SQRT_RATIO, JSBI.BigInt(1));
      expect(() => getTickAtSqrtRatio(sqrtRatio)).toThrow('SQRT_RATIO');
    });

    it('should throw for sqrt ratio above max', () => {
      expect(() => getTickAtSqrtRatio(MAX_SQRT_RATIO)).toThrow('SQRT_RATIO');
    });

    it('should be inverse of getSqrtRatioAtTick', () => {
      const testTicks = [-10000, -100, 0, 100, 10000];
      
      for (const tick of testTicks) {
        const sqrtRatio = getSqrtRatioAtTick(tick);
        const backToTick = getTickAtSqrtRatio(sqrtRatio);
        expect(backToTick).toBe(tick);
      }
    });

    it('should handle edge cases near boundaries', () => {
      // Test values just inside the valid range
      const nearMin = JSBI.add(MIN_SQRT_RATIO, JSBI.BigInt(1));
      const nearMax = JSBI.subtract(MAX_SQRT_RATIO, JSBI.BigInt(1));
      
      expect(() => getTickAtSqrtRatio(nearMin)).not.toThrow();
      expect(() => getTickAtSqrtRatio(nearMax)).not.toThrow();
    });
  });

  describe('priceToTick', () => {
    it('should return 0 for price 1', () => {
      expect(priceToTick(1)).toBe(0);
    });

    it('should return positive tick for price > 1', () => {
      expect(priceToTick(2)).toBeGreaterThan(0);
    });

    it('should return negative tick for price < 1', () => {
      expect(priceToTick(0.5)).toBeLessThan(0);
    });

    it('should be monotonic increasing', () => {
      const tick1 = priceToTick(1.5);
      const tick2 = priceToTick(2.0);
      expect(tick2).toBeGreaterThan(tick1);
    });

    it('should handle very small prices', () => {
      const tick = priceToTick(0.0001);
      expect(typeof tick).toBe('number');
      expect(tick).toBeLessThan(0);
    });

    it('should handle very large prices', () => {
      const tick = priceToTick(10000);
      expect(typeof tick).toBe('number');
      expect(tick).toBeGreaterThan(0);
    });
  });

  describe('tickToPrice', () => {
    it('should return 1 for tick 0', () => {
      expect(tickToPrice(0)).toBeCloseTo(1, 10);
    });

    it('should return price > 1 for positive tick', () => {
      expect(tickToPrice(100)).toBeGreaterThan(1);
    });

    it('should return price < 1 for negative tick', () => {
      expect(tickToPrice(-100)).toBeLessThan(1);
    });

    it('should be monotonic increasing', () => {
      const price1 = tickToPrice(100);
      const price2 = tickToPrice(101);
      expect(price2).toBeGreaterThan(price1);
    });

    it('should be inverse of priceToTick for reasonable values', () => {
      const testPrices = [0.1, 0.5, 1, 1.5, 2, 10];
      
      for (const price of testPrices) {
        const tick = priceToTick(price);
        const backToPrice = tickToPrice(tick);
        expect(backToPrice).toBeCloseTo(price, 3);
      }
    });

    it('should handle extreme ticks within bounds', () => {
      // Test with ticks that should be within reasonable bounds
      const largeTick = 100000;
      const smallTick = -100000;
      
      expect(() => tickToPrice(largeTick)).not.toThrow();
      expect(() => tickToPrice(smallTick)).not.toThrow();
      expect(tickToPrice(largeTick)).toBeGreaterThan(1);
      expect(tickToPrice(smallTick)).toBeLessThan(1);
    });
  });

  describe('edge cases and precision', () => {
    it('should maintain precision across conversions', () => {
      const testTicks = [-60, -6, 0, 6, 60];
      
      for (const tick of testTicks) {
        const sqrtRatio = getSqrtRatioAtTick(tick);
        const backToTick = getTickAtSqrtRatio(sqrtRatio);
        expect(backToTick).toBe(tick);
      }
    });

    it('should handle sequential ticks correctly', () => {
      for (let tick = -100; tick <= 100; tick++) {
        const sqrtRatio1 = getSqrtRatioAtTick(tick);
        const sqrtRatio2 = getSqrtRatioAtTick(tick + 1);
        expect(JSBI.greaterThan(sqrtRatio2, sqrtRatio1)).toBe(true);
      }
    });

    it('should satisfy mathematical properties', () => {
      // Test that tick differences correspond to price ratios
      const tick1 = 60;
      const tick2 = 120;
      
      const price1 = tickToPrice(tick1);
      const price2 = tickToPrice(tick2);
      
      // Price ratio should be close to 1.0001^(tick2-tick1)
      const expectedRatio = Math.pow(1.0001, tick2 - tick1);
      const actualRatio = price2 / price1;
      
      expect(actualRatio).toBeCloseTo(expectedRatio, 8);
    });
  });
});