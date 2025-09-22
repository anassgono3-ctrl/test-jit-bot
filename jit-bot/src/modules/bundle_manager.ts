import { ethers } from 'ethers';
import JSBI from 'jsbi';
import { LiquidityPosition } from './lp_calculation';
import { calculateLPGasCost, calculateSwapGasCost } from '../utils/gas_utils';

/**
 * Bundle Preparation & Management Module
 * Generates mint-swap-burn bundles for simulation on forked mainnet
 */

export interface SwapDetails {
  tokenIn: string;
  tokenOut: string;
  amount: JSBI;
  amountOutMinimum: JSBI;
  recipient: string;
  deadline: number;
  sqrtPriceLimitX96: JSBI;
}

export interface BundleTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
}

export interface Bundle {
  id: string;
  transactions: BundleTransaction[];
  liquidityPosition: LiquidityPosition;
  swapDetails: SwapDetails;
  estimatedGas: bigint;
  estimatedProfit: number;
  timestamp: number;
  status: 'pending' | 'simulated' | 'executed' | 'failed';
}

// Uniswap V3 contract addresses (mainnet)
const UNISWAP_V3_ADDRESSES = {
  POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  SWAP_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
};

/**
 * Create a complete bundle with mint-swap-burn transactions
 */
export function createBundle(
  liquidity: LiquidityPosition,
  swap: SwapDetails,
  signer: ethers.Signer
): Bundle {
  try {
    const bundleId = generateBundleId();
    const timestamp = Date.now();
    
    // Prepare transactions
    const transactions: BundleTransaction[] = [];
    
    // 1. Mint LP position transaction
    const mintTx = prepareMintTransaction(liquidity, signer);
    transactions.push(mintTx);
    
    // 2. Swap transaction (the MEV opportunity)
    const swapTx = prepareSwapTransaction(swap, signer);
    transactions.push(swapTx);
    
    // 3. Burn LP position transaction
    const burnTx = prepareBurnTransaction(liquidity, signer);
    transactions.push(burnTx);
    
    // Calculate total gas estimate
    const totalGas = transactions.reduce(
      (sum, tx) => sum + BigInt(tx.gasLimit),
      0n
    );
    
    // Estimate profit after gas costs
    const gasPrice = BigInt(transactions[0].gasPrice);
    const gasCostETH = Number(totalGas * gasPrice) / 1e18;
    const gasCostUSD = gasCostETH * 1800; // ETH price estimate
    const estimatedProfit = liquidity.expectedFees - gasCostUSD;
    
    return {
      id: bundleId,
      transactions,
      liquidityPosition: liquidity,
      swapDetails: swap,
      estimatedGas: totalGas,
      estimatedProfit,
      timestamp,
      status: 'pending'
    };
  } catch (error) {
    console.error('Error creating bundle:', error);
    throw new Error(`Failed to create bundle: ${error}`);
  }
}

/**
 * Prepare mint transaction for LP position
 */
function prepareMintTransaction(
  liquidity: LiquidityPosition,
  signer: ethers.Signer
): BundleTransaction {
  const positionManagerABI = [
    'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)'
  ];
  
  const contract = new ethers.Contract(
    UNISWAP_V3_ADDRESSES.POSITION_MANAGER,
    positionManagerABI,
    signer
  );
  
  const params = {
    token0: liquidity.pool.token0.address,
    token1: liquidity.pool.token1.address,
    fee: liquidity.pool.fee,
    tickLower: liquidity.tickLower,
    tickUpper: liquidity.tickUpper,
    amount0Desired: liquidity.amount0.toString(),
    amount1Desired: liquidity.amount1.toString(),
    amount0Min: JSBI.multiply(liquidity.amount0, JSBI.BigInt(95)).toString(), // 5% slippage
    amount1Min: JSBI.multiply(liquidity.amount1, JSBI.BigInt(95)).toString(),
    recipient: signer.getAddress(),
    deadline: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  };
  
  const data = contract.interface.encodeFunctionData('mint', [params]);
  
  return {
    to: UNISWAP_V3_ADDRESSES.POSITION_MANAGER,
    data,
    value: '0',
    gasLimit: '200000',
    gasPrice: ethers.parseUnits('20', 'gwei').toString()
  };
}

/**
 * Prepare swap transaction
 */
function prepareSwapTransaction(
  swap: SwapDetails,
  signer: ethers.Signer
): BundleTransaction {
  const swapRouterABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
  ];
  
  const contract = new ethers.Contract(
    UNISWAP_V3_ADDRESSES.SWAP_ROUTER,
    swapRouterABI,
    signer
  );
  
  const params = {
    tokenIn: swap.tokenIn,
    tokenOut: swap.tokenOut,
    fee: 3000, // 0.3% fee tier
    recipient: swap.recipient,
    deadline: swap.deadline,
    amountIn: swap.amount.toString(),
    amountOutMinimum: swap.amountOutMinimum.toString(),
    sqrtPriceLimitX96: swap.sqrtPriceLimitX96.toString()
  };
  
  const data = contract.interface.encodeFunctionData('exactInputSingle', [params]);
  
  return {
    to: UNISWAP_V3_ADDRESSES.SWAP_ROUTER,
    data,
    value: '0',
    gasLimit: '150000',
    gasPrice: ethers.parseUnits('20', 'gwei').toString()
  };
}

/**
 * Prepare burn transaction for LP position
 */
function prepareBurnTransaction(
  liquidity: LiquidityPosition,
  signer: ethers.Signer
): BundleTransaction {
  const positionManagerABI = [
    'function burn(uint256 tokenId) external payable',
    'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external payable returns (uint256 amount0, uint256 amount1)'
  ];
  
  const contract = new ethers.Contract(
    UNISWAP_V3_ADDRESSES.POSITION_MANAGER,
    positionManagerABI,
    signer
  );
  
  // Note: In practice, you'd need to track the tokenId from the mint transaction
  const tokenId = '0'; // Placeholder - would be from mint result
  
  const data = contract.interface.encodeFunctionData('burn', [tokenId]);
  
  return {
    to: UNISWAP_V3_ADDRESSES.POSITION_MANAGER,
    data,
    value: '0',
    gasLimit: '100000',
    gasPrice: ethers.parseUnits('20', 'gwei').toString()
  };
}

/**
 * Generate unique bundle ID
 */
function generateBundleId(): string {
  return `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate bundle before execution
 */
export function validateBundle(bundle: Bundle): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (bundle.transactions.length !== 3) {
    errors.push('Bundle must contain exactly 3 transactions (mint, swap, burn)');
  }
  
  if (bundle.estimatedProfit <= 0) {
    errors.push('Bundle has negative or zero profit');
  }
  
  if (bundle.estimatedGas > BigInt('500000')) {
    errors.push('Bundle gas estimate too high');
  }
  
  // Check transaction sequencing
  const expectedSequence = ['mint', 'swap', 'burn'];
  for (let i = 0; i < bundle.transactions.length; i++) {
    if (!bundle.transactions[i].data) {
      errors.push(`Transaction ${i} missing data`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Estimate bundle execution time
 */
export function estimateBundleExecutionTime(bundle: Bundle): number {
  // Base time per transaction + network confirmation time
  const baseTimePerTx = 1000; // 1 second
  const networkConfirmationTime = 12000; // 12 seconds (average block time)
  
  return (bundle.transactions.length * baseTimePerTx) + networkConfirmationTime;
}