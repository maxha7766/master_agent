/**
 * Schema Discovery Service
 * Auto-detects database schema (tables, columns, relationships)
 */

import pg from 'pg';
import mysql from 'mysql2/promise';
import { Database } from 'sqlite';
import { connectionManager, type DatabaseType } from './connection-manager.js';
import { supabase } from '../../models/database.js';
import { LLMFactory } from '../llm/factory.js';
import { log } from '../../lib/logger.js';

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
}

export interface TableInfo {
  name: string;
  schema?: string;
  columns: TableColumn[];
  rowCount?: number;
  description?: string; // AI-generated description
}

export interface DatabaseSchema {
  tables: TableInfo[];
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }>;
  aiSummary?: string; // AI-generated summary of the schema
}

class SchemaDiscoveryService {
  /**
   * Discover and cache database schema
   */
  async discoverSchema(userId: string, connectionId: string): Promise<DatabaseSchema> {
    try {
      log.info('Starting schema discovery', { userId, connectionId });

      // Get connection details
      const connection = await connectionManager.getConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Get connection pool
      const pool = await connectionManager.getOrCreatePool(connectionId, userId);

      // Discover schema based on database type
      let schema: DatabaseSchema;
      switch (connection.dbType) {
        case 'postgresql':
          schema = await this.discoverPostgreSQLSchema(pool);
          break;
        case 'mysql':
          schema = await this.discoverMySQLSchema(pool);
          break;
        case 'sqlite':
          schema = await this.discoverSQLiteSchema(pool);
          break;
        default:
          throw new Error(`Unsupported database type: ${connection.dbType}`);
      }

      // Generate AI summary of schema
      schema.aiSummary = await this.generateSchemaSummary(schema);

      // Cache schema in database
      await supabase
        .from('database_connections')
        .update({
          schema_cache: schema as any,
          last_schema_refresh: new Date().toISOString(),
        })
        .eq('id', connectionId);

      log.info('Schema discovery complete', {
        connectionId,
        tableCount: schema.tables.length,
      });

      return schema;
    } catch (error) {
      log.error('Schema discovery failed', { error, userId, connectionId });
      throw error;
    }
  }

  /**
   * Get cached schema (if exists and recent)
   */
  async getCachedSchema(userId: string, connectionId: string, maxAgeHours: number = 24): Promise<DatabaseSchema | null> {
    try {
      const { data, error } = await supabase
        .from('database_connections')
        .select('schema_cache, last_schema_refresh')
        .eq('id', connectionId)
        .eq('user_id', userId)
        .single();

      if (error || !data || !data.schema_cache) {
        return null;
      }

      // Check if cache is still fresh
      if (data.last_schema_refresh) {
        const cacheAge = Date.now() - new Date(data.last_schema_refresh).getTime();
        const maxAge = maxAgeHours * 60 * 60 * 1000;

        if (cacheAge > maxAge) {
          return null; // Cache expired
        }
      }

      return data.schema_cache as DatabaseSchema;
    } catch (error) {
      log.error('Error getting cached schema', { error, userId, connectionId });
      return null;
    }
  }

  /**
   * Discover PostgreSQL schema
   */
  private async discoverPostgreSQLSchema(pool: pg.Pool): Promise<DatabaseSchema> {
    const client = await pool.connect();
    try {
      // Get all tables
      const tablesResult = await client.query(`
        SELECT
          table_schema,
          table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tables: TableInfo[] = [];
      const relationships: DatabaseSchema['relationships'] = [];

      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        const tableSchema = row.table_schema;

        // Get columns for this table
        const columnsResult = await client.query(`
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
            fk.foreign_table_name,
            fk.foreign_column_name
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT ku.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage ku
              ON tc.constraint_name = ku.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = $1
              AND tc.table_schema = $2
          ) pk ON c.column_name = pk.column_name
          LEFT JOIN (
            SELECT
              kcu.column_name,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = $1
              AND tc.table_schema = $2
          ) fk ON c.column_name = fk.column_name
          WHERE c.table_name = $1
            AND c.table_schema = $2
          ORDER BY c.ordinal_position
        `, [tableName, tableSchema]);

        const columns: TableColumn[] = columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          isPrimaryKey: col.is_primary_key,
          isForeignKey: !!col.foreign_table_name,
          foreignKeyTable: col.foreign_table_name,
          foreignKeyColumn: col.foreign_column_name,
        }));

        // Get row count (with timeout)
        let rowCount: number | undefined;
        try {
          const countResult = await client.query(`SELECT COUNT(*) FROM "${tableSchema}"."${tableName}"`);
          rowCount = parseInt(countResult.rows[0].count, 10);
        } catch (error) {
          // Ignore count errors (might be permission issues)
          rowCount = undefined;
        }

        tables.push({
          name: tableName,
          schema: tableSchema,
          columns,
          rowCount,
        });

        // Extract relationships
        for (const col of columns) {
          if (col.isForeignKey && col.foreignKeyTable && col.foreignKeyColumn) {
            relationships.push({
              fromTable: tableName,
              fromColumn: col.name,
              toTable: col.foreignKeyTable,
              toColumn: col.foreignKeyColumn,
            });
          }
        }
      }

      return { tables, relationships };
    } finally {
      client.release();
    }
  }

  /**
   * Discover MySQL schema
   */
  private async discoverMySQLSchema(pool: mysql.Pool): Promise<DatabaseSchema> {
    const connection = await pool.getConnection();
    try {
      // Get database name
      const [dbResult] = await connection.query('SELECT DATABASE() as db_name');
      const dbName = (dbResult as any)[0].db_name;

      // Get all tables
      const [tablesResult] = await connection.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `, [dbName]);

      const tables: TableInfo[] = [];
      const relationships: DatabaseSchema['relationships'] = [];

      for (const row of tablesResult as any[]) {
        const tableName = row.table_name;

        // Get columns
        const [columnsResult] = await connection.query(`
          SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            c.column_key,
            k.referenced_table_name,
            k.referenced_column_name
          FROM information_schema.columns c
          LEFT JOIN information_schema.key_column_usage k
            ON c.table_schema = k.table_schema
            AND c.table_name = k.table_name
            AND c.column_name = k.column_name
            AND k.referenced_table_name IS NOT NULL
          WHERE c.table_schema = ?
            AND c.table_name = ?
          ORDER BY c.ordinal_position
        `, [dbName, tableName]);

        const columns: TableColumn[] = (columnsResult as any[]).map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          isPrimaryKey: col.column_key === 'PRI',
          isForeignKey: !!col.referenced_table_name,
          foreignKeyTable: col.referenced_table_name,
          foreignKeyColumn: col.referenced_column_name,
        }));

        // Get row count
        let rowCount: number | undefined;
        try {
          const [countResult] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
          rowCount = (countResult as any)[0].count;
        } catch (error) {
          rowCount = undefined;
        }

        tables.push({
          name: tableName,
          columns,
          rowCount,
        });

        // Extract relationships
        for (const col of columns) {
          if (col.isForeignKey && col.foreignKeyTable && col.foreignKeyColumn) {
            relationships.push({
              fromTable: tableName,
              fromColumn: col.name,
              toTable: col.foreignKeyTable,
              toColumn: col.foreignKeyColumn,
            });
          }
        }
      }

      return { tables, relationships };
    } finally {
      connection.release();
    }
  }

  /**
   * Discover SQLite schema
   */
  private async discoverSQLiteSchema(db: Database): Promise<DatabaseSchema> {
    // Get all tables
    const tables: TableInfo[] = [];
    const relationships: DatabaseSchema['relationships'] = [];

    const tablesResult = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    for (const row of tablesResult) {
      const tableName = row.name;

      // Get columns
      const columnsResult = await db.all(`PRAGMA table_info("${tableName}")`);
      const foreignKeysResult = await db.all(`PRAGMA foreign_key_list("${tableName}")`);

      const columns: TableColumn[] = columnsResult.map(col => {
        const fk = foreignKeysResult.find((fk: any) => fk.from === col.name);
        return {
          name: col.name,
          type: col.type,
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value,
          isPrimaryKey: col.pk === 1,
          isForeignKey: !!fk,
          foreignKeyTable: fk?.table,
          foreignKeyColumn: fk?.to,
        };
      });

      // Get row count
      let rowCount: number | undefined;
      try {
        const countResult = await db.get(`SELECT COUNT(*) as count FROM "${tableName}"`);
        rowCount = countResult?.count;
      } catch (error) {
        rowCount = undefined;
      }

      tables.push({
        name: tableName,
        columns,
        rowCount,
      });

      // Extract relationships
      for (const fk of foreignKeysResult) {
        relationships.push({
          fromTable: tableName,
          fromColumn: fk.from,
          toTable: fk.table,
          toColumn: fk.to,
        });
      }
    }

    return { tables, relationships };
  }

  /**
   * Generate AI summary of database schema
   */
  private async generateSchemaSummary(schema: DatabaseSchema): Promise<string> {
    try {
      const provider = LLMFactory.getProvider('gpt-5.1-codex');

      const schemaDescription = schema.tables.map(table => {
        const columnList = table.columns.map(col =>
          `  - ${col.name} (${col.type}${col.isPrimaryKey ? ', PRIMARY KEY' : ''}${col.isForeignKey ? ', FK -> ' + col.foreignKeyTable : ''})`
        ).join('\n');

        return `Table: ${table.name}${table.rowCount !== undefined ? ` (${table.rowCount} rows)` : ''}\n${columnList}`;
      }).join('\n\n');

      const prompt = `Analyze this database schema and provide a concise 2-3 sentence summary describing what this database contains and its purpose:

${schemaDescription}

Provide only the summary, no preamble.`;

      const response = await provider.chat(
        [{ role: 'user', content: prompt }],
        'gpt-5.1-codex',
        { temperature: 0.3, maxTokens: 200 }
      );

      return response.content;
    } catch (error) {
      log.error('Failed to generate schema summary', { error });
      return 'Database schema summary unavailable';
    }
  }
}

export const schemaDiscoveryService = new SchemaDiscoveryService();
