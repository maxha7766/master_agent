/**
 * Database Connector Service
 * Manages PostgreSQL connections with connection pooling and health checks
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { decryptConnectionString } from './encryption.js';
import { log } from '../../lib/logger.js';

interface ConnectionConfig {
  id: string;
  encryptedConnectionString: string;
  name: string;
  userId: string;
}

interface PoolInfo {
  pool: Pool;
  config: ConnectionConfig;
  lastUsed: Date;
}

/**
 * Connection pool manager
 * Maintains pools for multiple database connections
 */
class DatabaseConnector {
  private pools: Map<string, PoolInfo> = new Map();
  private readonly MAX_IDLE_TIME = 10 * 60 * 1000; // 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove idle connections
    this.startCleanupInterval();
  }

  /**
   * Get or create a connection pool for a database
   * @param config - Connection configuration with encrypted connection string
   * @returns PostgreSQL pool
   */
  async getPool(config: ConnectionConfig): Promise<Pool> {
    const existingPool = this.pools.get(config.id);

    if (existingPool) {
      // Update last used time
      existingPool.lastUsed = new Date();
      return existingPool.pool;
    }

    // Decrypt connection string
    let connectionString: string;
    try {
      connectionString = decryptConnectionString(config.encryptedConnectionString);
    } catch (error) {
      log.error('Failed to decrypt connection string', {
        connectionId: config.id,
        userId: config.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to decrypt database credentials');
    }

    // Create new pool
    const pool = new Pool({
      connectionString,
      max: 5, // Maximum 5 connections per database
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // 10 second connection timeout
      allowExitOnIdle: true, // Allow Node to exit when all clients are idle
    });

    // Add error handler
    pool.on('error', (err) => {
      log.error('Unexpected pool error', {
        connectionId: config.id,
        userId: config.userId,
        error: err.message,
      });
    });

    // Test connection
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      log.info('Database connection established', {
        connectionId: config.id,
        userId: config.userId,
        name: config.name,
      });
    } catch (error) {
      await pool.end();
      log.error('Failed to connect to database', {
        connectionId: config.id,
        userId: config.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Store pool
    this.pools.set(config.id, {
      pool,
      config,
      lastUsed: new Date(),
    });

    return pool;
  }

  /**
   * Execute a query with timeout
   * @param connectionId - Database connection ID
   * @param query - SQL query string
   * @param params - Query parameters
   * @param timeoutMs - Query timeout in milliseconds (default 5000)
   * @returns Query result
   */
  async executeQuery(
    connectionId: string,
    query: string,
    params: any[] = [],
    timeoutMs: number = 5000
  ): Promise<QueryResult> {
    const poolInfo = this.pools.get(connectionId);

    if (!poolInfo) {
      throw new Error(`No connection pool found for connection ID: ${connectionId}`);
    }

    const { pool, config } = poolInfo;
    let client: PoolClient | null = null;

    try {
      // Get client from pool
      client = await pool.connect();

      // Set statement timeout
      await client.query(`SET statement_timeout = ${timeoutMs}`);

      // Execute query with parameters
      const result = await client.query(query, params);

      // Update last used time
      poolInfo.lastUsed = new Date();

      log.info('Query executed successfully', {
        connectionId,
        userId: config.userId,
        rowCount: result.rowCount,
        queryLength: query.length,
      });

      return result;
    } catch (error) {
      log.error('Query execution failed', {
        connectionId,
        userId: config.userId,
        error: error instanceof Error ? error.message : String(error),
        query: query.substring(0, 200), // Log first 200 chars of query
      });
      throw error;
    } finally {
      // Always release client back to pool
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Test a connection to ensure it's working
   * @param config - Connection configuration
   * @returns true if connection successful
   */
  async testConnection(config: ConnectionConfig): Promise<boolean> {
    try {
      const pool = await this.getPool(config);
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      log.error('Connection test failed', {
        connectionId: config.id,
        userId: config.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close a specific connection pool
   * @param connectionId - Connection ID to close
   */
  async closeConnection(connectionId: string): Promise<void> {
    const poolInfo = this.pools.get(connectionId);

    if (poolInfo) {
      await poolInfo.pool.end();
      this.pools.delete(connectionId);

      log.info('Database connection closed', {
        connectionId,
        userId: poolInfo.config.userId,
      });
    }
  }

  /**
   * Close all connection pools
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.keys()).map((id) => this.closeConnection(id));
    await Promise.all(closePromises);

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    log.info('All database connections closed');
  }

  /**
   * Start interval to clean up idle connections
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      const idsToClose: string[] = [];

      for (const [id, poolInfo] of this.pools.entries()) {
        const idleTime = now.getTime() - poolInfo.lastUsed.getTime();

        if (idleTime > this.MAX_IDLE_TIME) {
          idsToClose.push(id);
        }
      }

      for (const id of idsToClose) {
        await this.closeConnection(id);
        log.info('Closed idle database connection', { connectionId: id });
      }
    }, 60000); // Check every minute
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    connections: Array<{
      id: string;
      name: string;
      userId: string;
      lastUsed: Date;
      poolSize: number;
      idleCount: number;
      waitingCount: number;
    }>;
  } {
    const connections = Array.from(this.pools.entries()).map(([id, poolInfo]) => ({
      id,
      name: poolInfo.config.name,
      userId: poolInfo.config.userId,
      lastUsed: poolInfo.lastUsed,
      poolSize: poolInfo.pool.totalCount,
      idleCount: poolInfo.pool.idleCount,
      waitingCount: poolInfo.pool.waitingCount,
    }));

    return {
      totalConnections: this.pools.size,
      connections,
    };
  }
}

// Export singleton instance
export const databaseConnector = new DatabaseConnector();

// Export type
export type { ConnectionConfig };
