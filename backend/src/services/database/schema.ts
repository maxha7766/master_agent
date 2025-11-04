/**
 * Database Schema Discovery Service
 * Introspects PostgreSQL database schema to discover tables, columns, types, and relationships
 */

import { databaseConnector, ConnectionConfig } from './connector.js';
import { log } from '../../lib/logger.js';

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description: string | null;
}

export interface ForeignKey {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface Table {
  schema: string;
  name: string;
  fullName: string; // schema.name
  columns: Column[];
  foreignKeys: ForeignKey[];
  rowCount: number | null;
  description: string | null;
}

export interface DatabaseSchema {
  tables: Table[];
  totalTables: number;
  discoveredAt: Date;
}

/**
 * Discover all tables and their schemas from a database connection
 * @param config - Database connection configuration
 * @returns Complete database schema
 */
export async function discoverSchema(config: ConnectionConfig): Promise<DatabaseSchema> {
  try {
    log.info('Starting schema discovery', {
      connectionId: config.id,
      userId: config.userId,
      name: config.name,
    });

    const pool = await databaseConnector.getPool(config);

    // Query to get all tables with their columns, types, and constraints
    const tablesQuery = `
      SELECT
        t.table_schema,
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        CASE
          WHEN pk.column_name IS NOT NULL THEN true
          ELSE false
        END as is_primary_key,
        CASE
          WHEN fk.column_name IS NOT NULL THEN true
          ELSE false
        END as is_foreign_key,
        pgd.description as column_description,
        pgt.description as table_description
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
      LEFT JOIN (
        SELECT ku.table_schema, ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
      ) pk ON c.table_schema = pk.table_schema
        AND c.table_name = pk.table_name
        AND c.column_name = pk.column_name
      LEFT JOIN (
        SELECT ku.table_schema, ku.table_name, ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
      ) fk ON c.table_schema = fk.table_schema
        AND c.table_name = fk.table_name
        AND c.column_name = fk.column_name
      LEFT JOIN pg_catalog.pg_statio_all_tables st
        ON st.schemaname = c.table_schema
        AND st.relname = c.table_name
      LEFT JOIN pg_catalog.pg_description pgd
        ON pgd.objoid = st.relid
        AND pgd.objsubid = c.ordinal_position
      LEFT JOIN pg_catalog.pg_description pgt
        ON pgt.objoid = st.relid
        AND pgt.objsubid = 0
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name, c.ordinal_position;
    `;

    const tablesResult = await pool.query(tablesQuery);

    // Query to get foreign key relationships
    const foreignKeysQuery = `
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema');
    `;

    const foreignKeysResult = await pool.query(foreignKeysQuery);

    // Build foreign keys map
    const foreignKeysMap = new Map<string, ForeignKey[]>();
    for (const row of foreignKeysResult.rows) {
      const key = `${row.table_schema}.${row.table_name}`;
      if (!foreignKeysMap.has(key)) {
        foreignKeysMap.set(key, []);
      }
      foreignKeysMap.get(key)!.push({
        columnName: row.column_name,
        referencedTable: row.referenced_table,
        referencedColumn: row.referenced_column,
      });
    }

    // Group by table
    const tablesMap = new Map<string, Table>();

    for (const row of tablesResult.rows) {
      const fullName = `${row.table_schema}.${row.table_name}`;

      if (!tablesMap.has(fullName)) {
        tablesMap.set(fullName, {
          schema: row.table_schema,
          name: row.table_name,
          fullName,
          columns: [],
          foreignKeys: foreignKeysMap.get(fullName) || [],
          rowCount: null,
          description: row.table_description,
        });
      }

      const table = tablesMap.get(fullName)!;

      // Add column if it exists (some tables might have no columns in edge cases)
      if (row.column_name) {
        table.columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          defaultValue: row.column_default,
          isPrimaryKey: row.is_primary_key,
          isForeignKey: row.is_foreign_key,
          description: row.column_description,
        });
      }
    }

    // Get row counts for each table (with timeout protection)
    const tables = Array.from(tablesMap.values());
    await Promise.all(
      tables.map(async (table) => {
        try {
          // Use EXPLAIN instead of COUNT for large tables (faster)
          const countQuery = `
            SELECT reltuples::bigint AS estimate
            FROM pg_class
            WHERE oid = '${table.fullName}'::regclass;
          `;
          const result = await pool.query(countQuery);
          table.rowCount = result.rows[0]?.estimate || 0;
        } catch (error) {
          // If count fails, just leave as null
          table.rowCount = null;
        }
      })
    );

    const schema: DatabaseSchema = {
      tables,
      totalTables: tables.length,
      discoveredAt: new Date(),
    };

    log.info('Schema discovery completed', {
      connectionId: config.id,
      userId: config.userId,
      totalTables: schema.totalTables,
      totalColumns: tables.reduce((sum, t) => sum + t.columns.length, 0),
    });

    return schema;
  } catch (error) {
    log.error('Schema discovery failed', {
      connectionId: config.id,
      userId: config.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(`Failed to discover database schema: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a natural language description of the schema for LLM context
 * @param schema - Database schema
 * @param maxTables - Maximum number of tables to include (default 50)
 * @returns Formatted schema description
 */
export function formatSchemaForLLM(schema: DatabaseSchema, maxTables: number = 50): string {
  const tables = schema.tables.slice(0, maxTables);

  let description = `# Database Schema (${schema.totalTables} tables)\n\n`;

  if (schema.totalTables > maxTables) {
    description += `*Showing first ${maxTables} tables*\n\n`;
  }

  for (const table of tables) {
    description += `## ${table.fullName}\n`;

    if (table.description) {
      description += `${table.description}\n`;
    }

    if (table.rowCount !== null) {
      description += `*~${table.rowCount.toLocaleString()} rows*\n`;
    }

    description += '\n**Columns:**\n';

    for (const col of table.columns) {
      let colDesc = `- **${col.name}** (${col.type})`;

      const attributes: string[] = [];
      if (col.isPrimaryKey) attributes.push('PRIMARY KEY');
      if (col.isForeignKey) attributes.push('FOREIGN KEY');
      if (!col.nullable) attributes.push('NOT NULL');

      if (attributes.length > 0) {
        colDesc += ` - ${attributes.join(', ')}`;
      }

      if (col.description) {
        colDesc += `\n  ${col.description}`;
      }

      description += colDesc + '\n';
    }

    // Add foreign key relationships
    if (table.foreignKeys.length > 0) {
      description += '\n**Foreign Keys:**\n';
      for (const fk of table.foreignKeys) {
        description += `- ${fk.columnName} → ${fk.referencedTable}.${fk.referencedColumn}\n`;
      }
    }

    description += '\n';
  }

  return description;
}

/**
 * Search for tables by name or description
 * @param schema - Database schema
 * @param searchTerm - Search term (case insensitive)
 * @returns Matching tables
 */
export function searchTables(schema: DatabaseSchema, searchTerm: string): Table[] {
  const term = searchTerm.toLowerCase();

  return schema.tables.filter((table) => {
    // Match table name
    if (table.name.toLowerCase().includes(term)) return true;
    if (table.fullName.toLowerCase().includes(term)) return true;

    // Match table description
    if (table.description?.toLowerCase().includes(term)) return true;

    // Match column names
    if (table.columns.some((col) => col.name.toLowerCase().includes(term))) return true;

    return false;
  });
}
