/**
 * Database Connection Manager
 * Manages external database connections with encryption and pooling
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { supabase } from '../../models/database.js';
import { encryptConnectionDetails, decryptConnectionDetails, type ConnectionDetails, type EncryptedConnectionDetails } from '../../lib/encryption.js';
import { log } from '../../lib/logger.js';

const { Pool: PgPool } = pg;

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite';

export interface DatabaseConnection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  dbType: DatabaseType;
  status: 'active' | 'inactive' | 'error';
  lastConnectedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConnectionInput {
  name: string;
  description?: string;
  dbType: DatabaseType;
  connectionDetails: ConnectionDetails;
}

export interface UpdateConnectionInput {
  name?: string;
  description?: string;
  connectionDetails?: ConnectionDetails;
  status?: 'active' | 'inactive';
}

// In-memory connection pool cache (cleared on server restart)
const connectionPools = new Map<string, any>();

class ConnectionManager {
  /**
   * Create a new database connection
   */
  async createConnection(userId: string, input: CreateConnectionInput): Promise<DatabaseConnection> {
    try {
      // Encrypt connection details
      const encrypted = encryptConnectionDetails(input.connectionDetails);

      // Insert into database
      const { data, error } = await supabase
        .from('database_connections')
        .insert({
          user_id: userId,
          name: input.name,
          description: input.description,
          db_type: input.dbType,
          ...encrypted,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        log.error('Failed to create database connection', { error, userId });
        throw new Error(`Failed to create connection: ${error.message}`);
      }

      log.info('Database connection created', { connectionId: data.id, userId, dbType: input.dbType });

      return this.mapToConnectionObject(data);
    } catch (error) {
      log.error('Error creating database connection', { error, userId });
      throw error;
    }
  }

  /**
   * Get all connections for a user
   */
  async listConnections(userId: string): Promise<DatabaseConnection[]> {
    try {
      const { data, error } = await supabase
        .from('database_connections')
        .select('id, user_id, name, description, db_type, status, last_connected_at, last_error, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        log.error('Failed to list database connections', { error, userId });
        throw new Error(`Failed to list connections: ${error.message}`);
      }

      return (data || []).map(this.mapToConnectionObject);
    } catch (error) {
      log.error('Error listing database connections', { error, userId });
      throw error;
    }
  }

  /**
   * Get a specific connection
   */
  async getConnection(userId: string, connectionId: string): Promise<DatabaseConnection | null> {
    try {
      const { data, error } = await supabase
        .from('database_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToConnectionObject(data);
    } catch (error) {
      log.error('Error getting database connection', { error, userId, connectionId });
      return null;
    }
  }

  /**
   * Update a connection
   */
  async updateConnection(
    userId: string,
    connectionId: string,
    input: UpdateConnectionInput
  ): Promise<DatabaseConnection> {
    try {
      const updates: any = {};

      if (input.name) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.status) updates.status = input.status;

      // Encrypt new connection details if provided
      if (input.connectionDetails) {
        const encrypted = encryptConnectionDetails(input.connectionDetails);
        Object.assign(updates, encrypted);
      }

      const { data, error } = await supabase
        .from('database_connections')
        .update(updates)
        .eq('id', connectionId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error || !data) {
        throw new Error('Connection not found or update failed');
      }

      // Clear cached pool if connection details changed
      if (input.connectionDetails) {
        this.closeConnection(connectionId);
      }

      log.info('Database connection updated', { connectionId, userId });

      return this.mapToConnectionObject(data);
    } catch (error) {
      log.error('Error updating database connection', { error, userId, connectionId });
      throw error;
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(userId: string, connectionId: string): Promise<void> {
    try {
      // Close any active connections first
      this.closeConnection(connectionId);

      const { error } = await supabase
        .from('database_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete connection: ${error.message}`);
      }

      log.info('Database connection deleted', { connectionId, userId });
    } catch (error) {
      log.error('Error deleting database connection', { error, userId, connectionId });
      throw error;
    }
  }

  /**
   * Test a connection (before saving or on demand)
   */
  async testConnection(connectionDetails: ConnectionDetails, dbType: DatabaseType): Promise<{ success: boolean; error?: string }> {
    try {
      const pool = await this.createConnectionPool(connectionDetails, dbType);

      // Test query based on database type
      let testQuery: string;
      switch (dbType) {
        case 'postgresql':
          testQuery = 'SELECT 1';
          break;
        case 'mysql':
          testQuery = 'SELECT 1';
          break;
        case 'sqlite':
          testQuery = 'SELECT 1';
          break;
        default:
          throw new Error(`Unsupported database type: ${dbType}`);
      }

      // Execute test query
      if (dbType === 'postgresql') {
        const client = await (pool as pg.Pool).connect();
        try {
          await client.query(testQuery);
        } finally {
          client.release();
        }
      } else if (dbType === 'mysql') {
        const connection = await (pool as mysql.Pool).getConnection();
        try {
          await connection.query(testQuery);
        } finally {
          connection.release();
        }
      } else if (dbType === 'sqlite') {
        await (pool as Database).get(testQuery);
      }

      // Close test connection
      await this.closePool(pool, dbType);

      return { success: true };
    } catch (error) {
      log.error('Connection test failed', { error, dbType });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get or create a connection pool for a specific connection ID
   */
  async getOrCreatePool(connectionId: string, userId: string): Promise<any> {
    // Check cache first
    if (connectionPools.has(connectionId)) {
      return connectionPools.get(connectionId);
    }

    // Fetch connection details from database
    const { data, error } = await supabase
      .from('database_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new Error('Connection not found');
    }

    // Decrypt connection details
    const encrypted: EncryptedConnectionDetails = {
      database_encrypted: data.database_encrypted,
      host_encrypted: data.host_encrypted,
      port_encrypted: data.port_encrypted,
      username_encrypted: data.username_encrypted,
      password_encrypted: data.password_encrypted,
      connection_string_encrypted: data.connection_string_encrypted,
    };

    const connectionDetails = decryptConnectionDetails(encrypted);
    const pool = await this.createConnectionPool(connectionDetails, data.db_type as DatabaseType);

    // Cache the pool
    connectionPools.set(connectionId, pool);

    // Update last_connected_at
    await supabase
      .from('database_connections')
      .update({ last_connected_at: new Date().toISOString() })
      .eq('id', connectionId);

    return pool;
  }

  /**
   * Create a connection pool based on database type
   */
  private async createConnectionPool(details: ConnectionDetails, dbType: DatabaseType): Promise<any> {
    switch (dbType) {
      case 'postgresql':
        return new PgPool({
          host: details.host,
          port: details.port || 5432,
          database: details.database,
          user: details.username,
          password: details.password,
          max: 5, // Max 5 connections in pool
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });

      case 'mysql':
        return mysql.createPool({
          host: details.host,
          port: details.port || 3306,
          database: details.database,
          user: details.username,
          password: details.password,
          connectionLimit: 5,
          waitForConnections: true,
          queueLimit: 0,
        });

      case 'sqlite':
        return open({
          filename: details.database,
          driver: sqlite3.Database,
        });

      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  /**
   * Close a specific connection pool
   */
  private async closePool(pool: any, dbType: DatabaseType): Promise<void> {
    try {
      switch (dbType) {
        case 'postgresql':
          await (pool as pg.Pool).end();
          break;
        case 'mysql':
          await (pool as mysql.Pool).end();
          break;
        case 'sqlite':
          await (pool as Database).close();
          break;
      }
    } catch (error) {
      log.error('Error closing connection pool', { error, dbType });
    }
  }

  /**
   * Close a connection and remove from cache
   */
  closeConnection(connectionId: string): void {
    const pool = connectionPools.get(connectionId);
    if (pool) {
      // We don't know the type here, so try all methods
      if (pool.end) pool.end().catch(() => {});
      if (pool.close) pool.close().catch(() => {});
      connectionPools.delete(connectionId);
    }
  }

  /**
   * Close all connections (on server shutdown)
   */
  async closeAllConnections(): Promise<void> {
    for (const [id, pool] of connectionPools.entries()) {
      try {
        if (pool.end) await pool.end();
        if (pool.close) await pool.close();
      } catch (error) {
        log.error('Error closing connection', { error, connectionId: id });
      }
    }
    connectionPools.clear();
  }

  /**
   * Map database row to ConnectionObject
   */
  private mapToConnectionObject(data: any): DatabaseConnection {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      dbType: data.db_type,
      status: data.status,
      lastConnectedAt: data.last_connected_at,
      lastError: data.last_error,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export const connectionManager = new ConnectionManager();
