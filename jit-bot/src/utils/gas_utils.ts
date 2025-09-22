import { ethers } from 'ethers';

/**
 * Gas calculation and adjustment utilities
 */

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  totalCost: bigint;
}

/**
 * Calculate gas cost for LP operations (mint + burn)
 */
export function calculateLPGasCost(
  gasPrice: bigint,
  hasExistingPosition: boolean = false
): GasEstimate {
  // Estimated gas costs for LP operations
  const mintGas = hasExistingPosition ? 150000n : 200000n; // Lower if position exists
  const burnGas = 100000n;
  const totalGas = mintGas + burnGas;
  
  const gasLimit = totalGas + (totalGas * 20n / 100n); // 20% buffer
  const totalCost = gasLimit * gasPrice;
  
  return {
    gasLimit,
    gasPrice,
    totalCost
  };
}

/**
 * Calculate gas cost for swap operations
 */
export function calculateSwapGasCost(
  gasPrice: bigint,
  complexSwap: boolean = false
): GasEstimate {
  const baseGas = complexSwap ? 180000n : 120000n;
  const gasLimit = baseGas + (baseGas * 15n / 100n); // 15% buffer
  const totalCost = gasLimit * gasPrice;
  
  return {
    gasLimit,
    gasPrice,
    totalCost
  };
}

/**
 * Get current gas prices from network
 */
export async function getCurrentGasPrices(provider: ethers.Provider): Promise<{
  gasPrice: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}> {
  try {
    const feeData = await provider.getFeeData();
    
    return {
      gasPrice: feeData.gasPrice || 0n,
      maxFeePerGas: feeData.maxFeePerGas || undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || undefined
    };
  } catch (error) {
    console.error('Error getting gas prices:', error);
    // Fallback gas price (20 gwei)
    return {
      gasPrice: ethers.parseUnits('20', 'gwei')
    };
  }
}

/**
 * Calculate priority fee for fast execution
 */
export function calculatePriorityFee(
  baseFee: bigint,
  urgency: 'low' | 'medium' | 'high' = 'medium'
): bigint {
  const multipliers = {
    low: 110n,    // 1.1x
    medium: 120n, // 1.2x
    high: 150n    // 1.5x
  };
  
  return (baseFee * multipliers[urgency]) / 100n;
}

/**
 * Estimate total transaction cost including gas
 */
export function estimateTransactionCost(
  gasEstimate: GasEstimate,
  tokenValueUSD: number
): {
  gasCostUSD: number;
  netProfitUSD: number;
  profitMargin: number;
} {
  // Assuming ETH price for gas cost calculation (simplified)
  const ethPriceUSD = 1800; // This should be fetched from oracle
  const gasCostETH = Number(gasEstimate.totalCost) / 1e18;
  const gasCostUSD = gasCostETH * ethPriceUSD;
  
  const netProfitUSD = tokenValueUSD - gasCostUSD;
  const profitMargin = tokenValueUSD > 0 ? (netProfitUSD / tokenValueUSD) * 100 : 0;
  
  return {
    gasCostUSD,
    netProfitUSD,
    profitMargin
  };
}