/**
 * Alpha Vantage API Service
 * Stock market data, forex, crypto, and technical indicators
 * Requires API key: https://www.alphavantage.co/support/#api-key
 */

import { log } from '../../lib/logger.js';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: string;
  volume: number;
  lastTradingDay: string;
}

export interface CompanyOverview {
  symbol: string;
  name: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
}

export class AlphaVantageService {
  private apiKey: string;
  private baseUrl = 'https://www.alphavantage.co/query';

  constructor() {
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  /**
   * Get real-time stock quote
   */
  async getQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const params = new URLSearchParams({
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('Alpha Vantage rate limit reached');
      }

      const quote = data['Global Quote'];

      if (!quote || Object.keys(quote).length === 0) {
        return null;
      }

      const result: StockQuote = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: quote['10. change percent'],
        volume: parseInt(quote['06. volume']),
        lastTradingDay: quote['07. latest trading day'],
      };

      log.info('Alpha Vantage quote fetch successful', { symbol });

      return result;
    } catch (error) {
      log.error('Alpha Vantage quote fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        symbol,
      });
      throw error;
    }
  }

  /**
   * Get company overview and fundamentals
   */
  async getCompanyOverview(symbol: string): Promise<CompanyOverview | null> {
    try {
      const params = new URLSearchParams({
        function: 'OVERVIEW',
        symbol,
        apikey: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('Alpha Vantage rate limit reached');
      }

      if (!data.Symbol) {
        return null;
      }

      const result: CompanyOverview = {
        symbol: data.Symbol as string,
        name: data.Name as string,
        description: (data.Description as string) || '',
        sector: (data.Sector as string) || '',
        industry: (data.Industry as string) || '',
        marketCap: parseInt(data.MarketCapitalization as string) || 0,
        peRatio: parseFloat(data.PERatio as string) || 0,
        dividendYield: parseFloat(data.DividendYield as string) || 0,
      };

      log.info('Alpha Vantage company overview fetch successful', { symbol });

      return result;
    } catch (error) {
      log.error('Alpha Vantage company overview fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        symbol,
      });
      throw error;
    }
  }

  /**
   * Search for symbols (companies)
   */
  async searchSymbols(keywords: string): Promise<Array<{ symbol: string; name: string; type: string; region: string }>> {
    try {
      const params = new URLSearchParams({
        function: 'SYMBOL_SEARCH',
        keywords,
        apikey: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('Alpha Vantage rate limit reached');
      }

      if (!data.bestMatches) {
        return [];
      }

      const results = (data.bestMatches as any[]).map((match: any) => ({
        symbol: match['1. symbol'],
        name: match['2. name'],
        type: match['3. type'],
        region: match['4. region'],
      }));

      log.info('Alpha Vantage symbol search successful', {
        keywords,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('Alpha Vantage symbol search failed', {
        error: error instanceof Error ? error.message : String(error),
        keywords,
      });
      throw error;
    }
  }

  /**
   * Get daily time series (last 100 days)
   */
  async getDailyTimeSeries(symbol: string): Promise<Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>> {
    try {
      const params = new URLSearchParams({
        function: 'TIME_SERIES_DAILY',
        symbol,
        apikey: this.apiKey,
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error('Alpha Vantage rate limit reached');
      }

      const timeSeries = data['Time Series (Daily)'];

      if (!timeSeries) {
        return [];
      }

      const results = Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume']),
      }));

      log.info('Alpha Vantage daily time series fetch successful', {
        symbol,
        dataPoints: results.length,
      });

      return results;
    } catch (error) {
      log.error('Alpha Vantage daily time series fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        symbol,
      });
      throw error;
    }
  }
}
