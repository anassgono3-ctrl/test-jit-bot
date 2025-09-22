import { ExecutionResult } from './execution_sim';
import { LiquidityPosition } from './lp_calculation';
import { Bundle } from './bundle_manager';
import { HedgeAction } from './risk_hedging';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Logging & Analytics Module
 * Records simulated swap details, liquidity amounts, estimated fees, gas costs
 */

export interface LogEntry {
  timestamp: number;
  type: 'execution' | 'hedge' | 'error' | 'info';
  bundleId?: string;
  data: any;
  level: 'debug' | 'info' | 'warn' | 'error';
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  totalProfit: number;
  totalGasCost: number;
  totalFees: number;
  averageExecutionTime: number;
  successRate: number;
  profitability: number;
}

export interface DailyMetrics {
  date: string;
  executions: number;
  profit: number;
  gasCost: number;
  fees: number;
  volume: number;
  bestPool: string;
  worstPool: string;
}

/**
 * Logger class for comprehensive logging and analytics
 */
export class BotLogger {
  private logFile: string;
  private metricsFile: string;
  private logBuffer: LogEntry[] = [];
  private metrics: ExecutionMetrics;
  private dailyMetrics: Map<string, DailyMetrics> = new Map();
  
  constructor(logDir: string = './logs') {
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const today = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logDir, `bot-${today}.log`);
    this.metricsFile = path.join(logDir, `metrics-${today}.json`);
    
    // Initialize metrics
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      totalProfit: 0,
      totalGasCost: 0,
      totalFees: 0,
      averageExecutionTime: 0,
      successRate: 0,
      profitability: 0
    };
    
    this.loadExistingMetrics();
  }
  
  /**
   * Log execution result
   */
  public logExecution(result: ExecutionResult): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type: 'execution',
      bundleId: result.bundleId,
      level: result.success ? 'info' : 'error',
      data: {
        success: result.success,
        profit: result.actualProfit,
        fees: result.actualFees,
        gasCost: result.actualGasCost,
        slippage: result.slippage,
        executionTime: result.executionTime,
        transactionHashes: result.transactionHashes,
        errors: result.errors,
        metrics: result.metrics
      }
    };
    
    this.addLogEntry(logEntry);
    this.updateMetrics(result);
    this.updateDailyMetrics(result);
    
    // Console output
    if (result.success) {
      console.log(`✅ Bundle ${result.bundleId} executed successfully`);
      console.log(`   Profit: $${result.actualProfit.toFixed(4)} | Fees: $${result.actualFees.toFixed(4)} | Gas: $${result.actualGasCost.toFixed(4)}`);
      console.log(`   Execution time: ${result.executionTime}ms | Slippage: ${result.slippage.toFixed(3)}%`);
    } else {
      console.log(`❌ Bundle ${result.bundleId} failed`);
      console.log(`   Errors: ${result.errors.join(', ')}`);
    }
  }
  
  /**
   * Log hedge action
   */
  public logHedge(hedgeAction: HedgeAction, executionResult?: any): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type: 'hedge',
      level: hedgeAction.shouldHedge ? 'info' : 'debug',
      data: {
        shouldHedge: hedgeAction.shouldHedge,
        hedgeType: hedgeAction.hedgeType,
        token0Hedge: hedgeAction.token0Hedge,
        token1Hedge: hedgeAction.token1Hedge,
        estimatedCost: hedgeAction.estimatedCost,
        targetExposure: hedgeAction.targetExposure,
        urgency: hedgeAction.urgency,
        reason: hedgeAction.reason,
        executionResult
      }
    };
    
    this.addLogEntry(logEntry);
    
    if (hedgeAction.shouldHedge) {
      console.log(`🛡️  Hedge action: ${hedgeAction.hedgeType} (${hedgeAction.urgency} urgency)`);
      console.log(`   Hedge amount: ${hedgeAction.token0Hedge.toFixed(4)} ETH | Cost: $${hedgeAction.estimatedCost.toFixed(4)}`);
      console.log(`   Reason: ${hedgeAction.reason}`);
    }
  }
  
  /**
   * Log pool data and opportunities
   */
  public logPoolData(poolName: string, data: any): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type: 'info',
      level: 'debug',
      data: {
        pool: poolName,
        ...data
      }
    };
    
    this.addLogEntry(logEntry);
  }
  
  /**
   * Log error
   */
  public logError(error: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type: 'error',
      level: 'error',
      data: {
        error,
        context
      }
    };
    
    this.addLogEntry(logEntry);
    console.error(`❌ Error: ${error}`);
    if (context) {
      console.error(`   Context:`, context);
    }
  }
  
  /**
   * Log general information
   */
  public logInfo(message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type: 'info',
      level: 'info',
      data: {
        message,
        ...data
      }
    };
    
    this.addLogEntry(logEntry);
    console.log(`ℹ️  ${message}`);
  }
  
  /**
   * Add log entry to buffer and flush if needed
   */
  private addLogEntry(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Flush buffer every 10 entries or immediately for errors
    if (this.logBuffer.length >= 10 || entry.level === 'error') {
      this.flushLogs();
    }
  }
  
  /**
   * Flush log buffer to file
   */
  private flushLogs(): void {
    if (this.logBuffer.length === 0) return;
    
    const logLines = this.logBuffer.map(entry => {
      const timestamp = new Date(entry.timestamp).toISOString();
      const dataStr = JSON.stringify(entry.data);
      return `[${timestamp}] ${entry.level.toUpperCase()} ${entry.type}: ${dataStr}`;
    });
    
    try {
      fs.appendFileSync(this.logFile, logLines.join('\n') + '\n');
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write logs:', error);
    }
  }
  
  /**
   * Update execution metrics
   */
  private updateMetrics(result: ExecutionResult): void {
    this.metrics.totalExecutions++;
    
    if (result.success) {
      this.metrics.successfulExecutions++;
      this.metrics.totalProfit += result.actualProfit;
      this.metrics.totalFees += result.actualFees;
    }
    
    this.metrics.totalGasCost += result.actualGasCost;
    
    // Update averages
    this.metrics.successRate = (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
    this.metrics.profitability = this.metrics.totalGasCost > 0 ? 
      (this.metrics.totalProfit / this.metrics.totalGasCost) * 100 : 0;
    
    // Calculate average execution time
    const totalTime = (this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1)) + result.executionTime;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
    
    this.saveMetrics();
  }
  
  /**
   * Update daily metrics
   */
  private updateDailyMetrics(result: ExecutionResult): void {
    const today = new Date().toISOString().split('T')[0];
    
    let dayMetrics = this.dailyMetrics.get(today);
    if (!dayMetrics) {
      dayMetrics = {
        date: today,
        executions: 0,
        profit: 0,
        gasCost: 0,
        fees: 0,
        volume: 0,
        bestPool: '',
        worstPool: ''
      };
      this.dailyMetrics.set(today, dayMetrics);
    }
    
    dayMetrics.executions++;
    dayMetrics.profit += result.actualProfit;
    dayMetrics.gasCost += result.actualGasCost;
    dayMetrics.fees += result.actualFees;
    dayMetrics.volume += Number(result.metrics.volumeProcessed) || 0;
  }
  
  /**
   * Save metrics to file
   */
  private saveMetrics(): void {
    try {
      const metricsData = {
        overall: this.metrics,
        daily: Array.from(this.dailyMetrics.values()),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.metricsFile, JSON.stringify(metricsData, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }
  
  /**
   * Load existing metrics
   */
  private loadExistingMetrics(): void {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = JSON.parse(fs.readFileSync(this.metricsFile, 'utf-8'));
        if (data.overall) {
          this.metrics = { ...this.metrics, ...data.overall };
        }
        if (data.daily) {
          data.daily.forEach((dayData: DailyMetrics) => {
            this.dailyMetrics.set(dayData.date, dayData);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load existing metrics:', error);
    }
  }
  
  /**
   * Get current metrics
   */
  public getMetrics(): ExecutionMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get daily metrics
   */
  public getDailyMetrics(days: number = 7): DailyMetrics[] {
    const sortedDays = Array.from(this.dailyMetrics.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, days);
    
    return sortedDays;
  }
  
  /**
   * Generate performance report
   */
  public generateReport(): string {
    const metrics = this.getMetrics();
    const recentDays = this.getDailyMetrics(7);
    
    let report = '\n=== JIT BOT PERFORMANCE REPORT ===\n\n';
    
    // Overall metrics
    report += '📊 Overall Metrics:\n';
    report += `   Total Executions: ${metrics.totalExecutions}\n`;
    report += `   Success Rate: ${metrics.successRate.toFixed(1)}%\n`;
    report += `   Total Profit: $${metrics.totalProfit.toFixed(2)}\n`;
    report += `   Total Gas Cost: $${metrics.totalGasCost.toFixed(2)}\n`;
    report += `   Total Fees: $${metrics.totalFees.toFixed(2)}\n`;
    report += `   Profitability: ${metrics.profitability.toFixed(1)}%\n`;
    report += `   Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms\n\n`;
    
    // Daily breakdown
    if (recentDays.length > 0) {
      report += '📈 Recent Daily Performance:\n';
      recentDays.forEach(day => {
        report += `   ${day.date}: ${day.executions} exec, $${day.profit.toFixed(2)} profit, $${day.gasCost.toFixed(2)} gas\n`;
      });
      report += '\n';
    }
    
    // Performance indicators
    report += '🎯 Performance Indicators:\n';
    if (metrics.successRate > 80) {
      report += '   ✅ High success rate\n';
    } else if (metrics.successRate > 60) {
      report += '   ⚠️  Moderate success rate\n';
    } else {
      report += '   ❌ Low success rate - needs improvement\n';
    }
    
    if (metrics.profitability > 200) {
      report += '   ✅ Highly profitable\n';
    } else if (metrics.profitability > 100) {
      report += '   ✅ Profitable\n';
    } else if (metrics.profitability > 0) {
      report += '   ⚠️  Marginally profitable\n';
    } else {
      report += '   ❌ Unprofitable - review strategy\n';
    }
    
    return report;
  }
  
  /**
   * Force flush all pending logs
   */
  public flush(): void {
    this.flushLogs();
    this.saveMetrics();
  }
  
  /**
   * Close logger and flush all data
   */
  public close(): void {
    this.flush();
    console.log('Logger closed and all data saved');
  }
}

// Global logger instance
let globalLogger: BotLogger | null = null;

/**
 * Get or create global logger instance
 */
export function getLogger(logDir?: string): BotLogger {
  if (!globalLogger) {
    globalLogger = new BotLogger(logDir);
  }
  return globalLogger;
}

/**
 * Quick logging functions for convenience
 */
export function logExecution(result: ExecutionResult): void {
  getLogger().logExecution(result);
}

export function logHedge(hedgeAction: HedgeAction, executionResult?: any): void {
  getLogger().logHedge(hedgeAction, executionResult);
}

export function logError(error: string, context?: any): void {
  getLogger().logError(error, context);
}

export function logInfo(message: string, data?: any): void {
  getLogger().logInfo(message, data);
}

/**
 * Export performance metrics for external analysis
 */
export function exportMetrics(filePath: string): void {
  const logger = getLogger();
  const metrics = logger.getMetrics();
  const dailyMetrics = logger.getDailyMetrics(30); // Last 30 days
  
  const exportData = {
    exportDate: new Date().toISOString(),
    overall: metrics,
    daily: dailyMetrics,
    performance: {
      profitPerExecution: metrics.totalExecutions > 0 ? metrics.totalProfit / metrics.totalExecutions : 0,
      gasCostPerExecution: metrics.totalExecutions > 0 ? metrics.totalGasCost / metrics.totalExecutions : 0,
      feesPerExecution: metrics.totalExecutions > 0 ? metrics.totalFees / metrics.totalExecutions : 0
    }
  };
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
    console.log(`Metrics exported to ${filePath}`);
  } catch (error) {
    console.error('Failed to export metrics:', error);
  }
}