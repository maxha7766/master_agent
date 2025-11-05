#!/usr/bin/env node
/**
 * Database Backup Script
 * Backs up all Supabase tables to JSON files
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it in Railway or your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TABLES_TO_BACKUP = [
  'documents',
  'chunks',
  'conversations',
  'messages',
  'user_usage',
  'database_connections',
  'sql_query_history',
  // Add other tables as needed
];

async function backupTable(tableName) {
  console.log(`📦 Backing up table: ${tableName}...`);

  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' });

    if (error) {
      console.error(`❌ Error backing up ${tableName}:`, error.message);
      return null;
    }

    console.log(`✅ Backed up ${count || data?.length || 0} rows from ${tableName}`);
    return { data, count };
  } catch (error) {
    console.error(`❌ Failed to backup ${tableName}:`, error.message);
    return null;
  }
}

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupDir = join(process.env.HOME, 'master_agent_backups', `db-backup-${timestamp}`);

  console.log(`\n🚀 Starting database backup...`);
  console.log(`📁 Backup directory: ${backupDir}\n`);

  // Create backup directory
  mkdirSync(backupDir, { recursive: true });

  const backupSummary = {
    timestamp: new Date().toISOString(),
    tables: {},
    totalRows: 0,
  };

  // Backup each table
  for (const tableName of TABLES_TO_BACKUP) {
    const result = await backupTable(tableName);

    if (result) {
      const { data, count } = result;
      const rowCount = count || data?.length || 0;

      // Save to JSON file
      const filePath = join(backupDir, `${tableName}.json`);
      writeFileSync(filePath, JSON.stringify(data, null, 2));

      backupSummary.tables[tableName] = {
        rows: rowCount,
        file: `${tableName}.json`,
      };
      backupSummary.totalRows += rowCount;
    } else {
      backupSummary.tables[tableName] = {
        error: 'Backup failed',
      };
    }
  }

  // Save backup summary
  const summaryPath = join(backupDir, 'backup-summary.json');
  writeFileSync(summaryPath, JSON.stringify(backupSummary, null, 2));

  console.log('\n📊 Backup Summary:');
  console.log(`   Total tables: ${Object.keys(backupSummary.tables).length}`);
  console.log(`   Total rows: ${backupSummary.totalRows}`);
  console.log(`   Location: ${backupDir}`);

  // Show per-table breakdown
  console.log('\n📋 Per-table breakdown:');
  for (const [table, info] of Object.entries(backupSummary.tables)) {
    if (info.error) {
      console.log(`   ${table}: ❌ ${info.error}`);
    } else {
      console.log(`   ${table}: ${info.rows} rows`);
    }
  }

  console.log('\n✅ Backup complete!\n');

  return backupDir;
}

// Run backup
runBackup()
  .then((backupDir) => {
    console.log(`💾 Your data is safe at: ${backupDir}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  });
