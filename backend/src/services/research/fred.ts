/**
 * FRED API Service
 * Federal Reserve Economic Data - 800,000+ economic time series
 * Requires API key: https://fred.stlouisfed.org/docs/api/api_key.html
 */

import { log } from '../../lib/logger.js';

export interface FREDSeriesInfo {
  id: string;
  title: string;
  notes: string;
  frequency: string;
  units: string;
  lastUpdated: Date;
}

export interface FREDObservation {
  date: string;
  value: string;
}

export class FREDService {
  private apiKey: string;
  private baseUrl = 'https://api.stlouisfed.org/fred';

  constructor() {
    const key = process.env.FRED_API_KEY;
    if (!key) {
      throw new Error('FRED_API_KEY environment variable is required');
    }
    this.apiKey = key;
  }

  /**
   * Search for economic series
   */
  async searchSeries(
    query: string,
    options: {
      limit?: number;
      orderBy?: 'search_rank' | 'series_id' | 'title' | 'units' | 'frequency' | 'popularity';
    } = {}
  ): Promise<FREDSeriesInfo[]> {
    try {
      const { limit = 10, orderBy = 'search_rank' } = options;

      const params = new URLSearchParams({
        search_text: query,
        api_key: this.apiKey,
        file_type: 'json',
        limit: String(limit),
        order_by: orderBy,
      });

      const response = await fetch(`${this.baseUrl}/series/search?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.seriess) {
        return [];
      }

      const results: FREDSeriesInfo[] = data.seriess.map((series: any) => ({
        id: series.id,
        title: series.title,
        notes: series.notes || '',
        frequency: series.frequency_short,
        units: series.units_short,
        lastUpdated: new Date(series.last_updated),
      }));

      log.info('FRED series search successful', {
        query,
        resultsCount: results.length,
      });

      return results;
    } catch (error) {
      log.error('FRED series search failed', {
        error: error instanceof Error ? error.message : String(error),
        query,
      });
      throw error;
    }
  }

  /**
   * Get observations (data points) for a specific series
   */
  async getSeriesObservations(
    seriesId: string,
    options: {
      limit?: number;
      sortOrder?: 'asc' | 'desc';
      observationStart?: Date;
      observationEnd?: Date;
    } = {}
  ): Promise<FREDObservation[]> {
    try {
      const {
        limit = 100,
        sortOrder = 'desc',
        observationStart,
        observationEnd,
      } = options;

      const params = new URLSearchParams({
        series_id: seriesId,
        api_key: this.apiKey,
        file_type: 'json',
        limit: String(limit),
        sort_order: sortOrder,
      });

      if (observationStart) {
        params.append('observation_start', observationStart.toISOString().split('T')[0]);
      }

      if (observationEnd) {
        params.append('observation_end', observationEnd.toISOString().split('T')[0]);
      }

      const response = await fetch(`${this.baseUrl}/series/observations?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.observations) {
        return [];
      }

      const observations: FREDObservation[] = data.observations.map((obs: any) => ({
        date: obs.date,
        value: obs.value,
      }));

      log.info('FRED observations fetch successful', {
        seriesId,
        observationsCount: observations.length,
      });

      return observations;
    } catch (error) {
      log.error('FRED observations fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        seriesId,
      });
      throw error;
    }
  }

  /**
   * Get series details
   */
  async getSeriesDetails(seriesId: string): Promise<FREDSeriesInfo | null> {
    try {
      const params = new URLSearchParams({
        series_id: seriesId,
        api_key: this.apiKey,
        file_type: 'json',
      });

      const response = await fetch(`${this.baseUrl}/series?${params}`);

      if (!response.ok) {
        throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.seriess || data.seriess.length === 0) {
        return null;
      }

      const series = data.seriess[0];

      return {
        id: series.id,
        title: series.title,
        notes: series.notes || '',
        frequency: series.frequency_short,
        units: series.units_short,
        lastUpdated: new Date(series.last_updated),
      };
    } catch (error) {
      log.error('FRED series details fetch failed', {
        error: error instanceof Error ? error.message : String(error),
        seriesId,
      });
      return null;
    }
  }
}
