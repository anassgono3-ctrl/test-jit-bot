import { calculateLiquidity, calculateDynamicTickRange, validateLiquidityPosition } from '../src/modules/lp_calculation';
import { Pool, FeeAmount } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import JSBI from 'jsbi';

describe('LP Calculation Module', () => {
  let mockPool: Pool;
  let mockSwapData: any;
  
  beforeEach(() => {
    // Create mock tokens (using real token addresses for testing)
    // WETH address is higher than USDT address, so we need to swap them for correct ordering
    const token0 = new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD');
    const token1 = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
    
    // Create mock pool
    mockPool = new Pool(
      token0,
      token1,
      FeeAmount.MEDIUM,
      '79228162514264337593543950336', // sqrtPriceX96 (approximately 1:1 ratio)
      '10272714827896220757', // liquidity
      0 // tickCurrent (at 1:1 price)
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