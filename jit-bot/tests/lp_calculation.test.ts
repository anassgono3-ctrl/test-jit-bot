import { calculateLiquidity, calculateDynamicTickRange, validateLiquidityPosition } from '../src/modules/lp_calculation';
import { Pool, FeeAmount } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import JSBI from 'jsbi';

describe('LP Calculation Module', () => {
  let mockPool: Pool;
  let mockSwapData: any;
  
  beforeEach(() => {
    // Create mock tokens
    const token0 = new Token(1, '0xA0b86a33E6441c476DECC4E6Af09e9C4F8eB0fC7', 18, 'WETH', 'Wrapped Ether');
    const token1 = new Token(1, '0xA0b86a33E6441c476DECC4E6Af09e9C4F8eB0fC8', 6, 'USDC', 'USD Coin');
    
    // Create mock pool
    mockPool = new Pool(
      token0,
      token1,
      FeeAmount.MEDIUM,
      '1771595571142957166768892000000000000000000000000000000', // sqrtPriceX96
      '10272714827896220757', // liquidity
      -74959 // tickCurrent
    );
    
    mockSwapData = {
      amount: 10, // 10 ETH
      tokenIn: token0.address,
      tokenOut: token1.address,
      expectedPriceImpact: 0.5
    };
  });
  
  describe('calculateLiquidity', () => {
    it('should calculate valid liquidity position', () => {
      const result = calculateLiquidity(mockPool, mockSwapData);
      
      expect(result).toBeDefined();
      expect(result.pool).toBe(mockPool);
      expect(result.tickLower).toBeLessThan(result.tickUpper);
      expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true);
      expect(result.expectedFees).toBeGreaterThan(0);
    });
    
    it('should calculate proper tick range', () => {
      const result = calculateLiquidity(mockPool, mockSwapData);
      
      // Tick range should be around current tick
      const currentTick = mockPool.tickCurrent;
      const tickRange = result.tickUpper - result.tickLower;
      
      expect(result.tickLower).toBeLessThanOrEqual(currentTick);
      expect(result.tickUpper).toBeGreaterThanOrEqual(currentTick);
      expect(tickRange).toBeGreaterThan(0);
      expect(tickRange).toBeLessThan(1000); // Reasonable range
    });
  });
  
  describe('validateLiquidityPosition', () => {
    it('should validate profitable position', () => {
      const position = calculateLiquidity(mockPool, mockSwapData);
      position.netProfit = 0.01; // $0.01 profit
      
      const validation = validateLiquidityPosition(position);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    it('should reject unprofitable position', () => {
      const position = calculateLiquidity(mockPool, mockSwapData);
      position.netProfit = -0.01; // Loss
      
      const validation = validateLiquidityPosition(position);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});