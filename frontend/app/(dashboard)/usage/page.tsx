'use client';

/**
 * Usage Dashboard Page
 * Displays usage statistics, costs, and budget tracking
 */

import { useEffect, useState } from 'react';
import { api, type UsageStats, type BudgetStatus } from '../../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Progress } from '../../../components/ui/progress';
import { toast } from 'sonner';

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');

  // Initialize with current month
  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setSelectedMonth(currentMonth);
    loadUsageData(currentMonth);
    loadBudgetStatus();
  }, []);

  const loadUsageData = async (month: string) => {
    try {
      setLoading(true);
      const data = await api.getUsage(month);
      setUsage(data);
    } catch (error: any) {
      console.error('Failed to load usage data:', error);
      toast.error('Failed to load usage data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBudgetStatus = async () => {
    try {
      const data = await api.getBudgetStatus();
      setBudget(data);
    } catch (error: any) {
      console.error('Failed to load budget status:', error);
    }
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    loadUsageData(month);
  };

  // Generate month options (last 6 months)
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value: monthStr, label });
    }
    return options;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#212121]">
        <p className="text-gray-400">Loading usage data...</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#212121] overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Usage & Costs</h1>
            <p className="text-gray-400">Track your AI usage and spending</p>
          </div>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="flex h-9 rounded-md border border-gray-700 bg-[#171717] px-3 py-1 text-sm text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            {getMonthOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-6">
          {/* Budget Status - Current Month Only */}
          {budget && selectedMonth === new Date().toISOString().slice(0, 7) && (
            <Card className="bg-[#171717] border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Current Budget Status</CardTitle>
                <CardDescription className="text-gray-400">
                  Your spending for this month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Budget Used</span>
                    <span className="text-white font-medium">
                      {formatCurrency(budget.currentCostUsd)} / {formatCurrency(budget.limitUsd)}
                    </span>
                  </div>
                  <Progress
                    value={budget.percentUsed}
                    className="h-2"
                    // Change color based on usage
                    indicatorClassName={
                      budget.isExceeded
                        ? 'bg-red-600'
                        : budget.isWarning
                        ? 'bg-yellow-500'
                        : 'bg-blue-600'
                    }
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{budget.percentUsed.toFixed(1)}% used</span>
                    <span className="text-gray-500">
                      {formatCurrency(budget.remainingUsd)} remaining
                    </span>
                  </div>
                </div>

                {/* Budget Warnings */}
                {budget.isExceeded && (
                  <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                    <p className="text-red-400 text-sm font-medium">Budget Limit Exceeded</p>
                    <p className="text-red-400/80 text-xs mt-1">
                      You've reached your monthly budget limit. New requests may be blocked.
                    </p>
                  </div>
                )}

                {budget.isWarning && !budget.isExceeded && (
                  <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                    <p className="text-yellow-400 text-sm font-medium">Budget Warning</p>
                    <p className="text-yellow-400/80 text-xs mt-1">
                      You've used {budget.percentUsed.toFixed(1)}% of your monthly budget.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Usage Overview */}
          {usage && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Cost */}
                <Card className="bg-[#171717] border-gray-800">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-gray-400">Total Cost</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(usage.totalCostUsd)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {usage.totalMessages} messages
                    </p>
                  </CardContent>
                </Card>

                {/* Total Tokens */}
                <Card className="bg-[#171717] border-gray-800">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-gray-400">Total Tokens</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {formatNumber(usage.totalTokens)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      ~{formatNumber(Math.round(usage.totalTokens / (usage.totalMessages || 1)))} per message
                    </p>
                  </CardContent>
                </Card>

                {/* Budget Remaining */}
                <Card className="bg-[#171717] border-gray-800">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-gray-400">Budget Remaining</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">
                      {formatCurrency(usage.budgetRemaining)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      of {formatCurrency(usage.budgetLimitUsd)} limit
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Cost by Model */}
              <Card className="bg-[#171717] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Cost by Model</CardTitle>
                  <CardDescription className="text-gray-400">
                    Breakdown of spending across different AI models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(usage.costByModel).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(usage.costByModel)
                        .sort(([, a], [, b]) => b - a)
                        .map(([model, cost]) => {
                          const percentage = (cost / usage.totalCostUsd) * 100;
                          const tokens = usage.tokensByModel[model] || 0;
                          return (
                            <div key={model} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-300">{model}</span>
                                <span className="text-white font-medium">
                                  {formatCurrency(cost)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={percentage}
                                  className="h-1.5 flex-1"
                                  indicatorClassName="bg-blue-600"
                                />
                                <span className="text-xs text-gray-500 w-12 text-right">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {formatNumber(tokens)} tokens
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No usage data for this month</p>
                  )}
                </CardContent>
              </Card>

              {/* Token Usage by Model */}
              <Card className="bg-[#171717] border-gray-800">
                <CardHeader>
                  <CardTitle className="text-white">Token Usage by Model</CardTitle>
                  <CardDescription className="text-gray-400">
                    Total tokens processed by each model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(usage.tokensByModel).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(usage.tokensByModel)
                        .sort(([, a], [, b]) => b - a)
                        .map(([model, tokens]) => {
                          const percentage = (tokens / usage.totalTokens) * 100;
                          return (
                            <div key={model} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-300">{model}</span>
                                <span className="text-white font-medium">
                                  {formatNumber(tokens)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={percentage}
                                  className="h-1.5 flex-1"
                                  indicatorClassName="bg-green-600"
                                />
                                <span className="text-xs text-gray-500 w-12 text-right">
                                  {percentage.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">No usage data for this month</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
