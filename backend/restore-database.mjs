#!/usr/bin/env node
/**
 * Database Restore Script
 * Restores Supabase tables from JSON backup files
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://omjwoyyhpdawjxsbpamc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function restoreTable(tableName, data) {
  console.log(`📥 Restoring table: ${tableName}...`);
  console.log(`   Rows to restore: ${data.length}`);

  if (data.length === 0) {
    console.log(`⚠️  No data to restore for ${tableName}`);
    return { success: true, rowsRestored: 0 };
  }

  try {
    // Insert data in batches of 100 to avoid timeout
    const batchSize = 100;
    let totalRestored = 0;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);

      const { error } = await supabase
        .from(tableName)
        .insert(batch);

      if (error) {
        console.error(`❌ Error restoring batch ${i}-${i + batch.length} of ${tableName}:`, error.message);
        return { success: false, error: error.message, rowsRestored: totalRestored };
      }

      totalRestored += batch.length;
      console.log(`   Restored ${totalRestored}/${data.length} rows...`);
    }

    console.log(`✅ Restored ${totalRestored} rows to ${tableName}`);
    return { success: true, rowsRestored: totalRestored };
  } catch (error) {
    console.error(`❌ Failed to restore ${tableName}:`, error.message);
    return { success: false, error: error.message, rowsRestored: 0 };
  }
}

async function runRestore(backupDir) {
  console.log(`\n🚀 Starting database restore...`);
  console.log(`📁 Backup directory: ${backupDir}\n`);

  // Read backup summary
  const summaryPath = join(backupDir, 'backup-summary.json');
  let summary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch (error) {
    console.error(`❌ Cannot read backup summary from ${summaryPath}`);
    process.exit(1);
  }

  console.log(`📊 Backup created: ${summary.timestamp}`);
  console.log(`   Total tables: ${Object.keys(summary.tables).length}`);
  console.log(`   Total rows: ${summary.totalRows}\n`);

  // Confirm restore
  console.log('⚠️  WARNING: This will INSERT data into the database.');
  console.log('   Make sure the tables are empty or you want to add this data.\n');

  const restoreSummary = {
    timestamp: new Date().toISOString(),
    backupTimestamp: summary.timestamp,
    tables: {},
    totalRowsRestored: 0,
  };

  // Restore each table
  for (const [tableName, tableInfo] of Object.entries(summary.tables)) {
    if (tableInfo.error) {
      console.log(`⏭️  Skipping ${tableName} (was not backed up)`);
      continue;
    }

    const filePath = join(backupDir, tableInfo.file);

    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      const result = await restoreTable(tableName, data);

      restoreSummary.tables[tableName] = result;
      if (result.success) {
        restoreSummary.totalRowsRestored += result.rowsRestored;
      }
    } catch (error) {
      console.error(`❌ Error reading ${filePath}:`, error.message);
      restoreSummary.tables[tableName] = {
        success: false,
        error: error.message,
      };
    }

    console.log(''); // Blank line between tables
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Restore Summary:');
  console.log(`   Total rows restored: ${restoreSummary.totalRowsRestored}`);
  console.log('\n📋 Per-table breakdown:');
  for (const [table, info] of Object.entries(restoreSummary.tables)) {
    if (info.success) {
      console.log(`   ${table}: ✅ ${info.rowsRestored} rows`);
    } else {
      console.log(`   ${table}: ❌ ${info.error}`);
    }
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return restoreSummary;
}

// Get backup directory from command line
const backupDir = process.argv[2];

if (!backupDir) {
  console.error('❌ Usage: node restore-database.mjs <backup-directory>');
  console.error('\nExample:');
  console.error('  node restore-database.mjs ~/master_agent_backups/db-backup-2025-11-04T23-45-00');
  process.exit(1);
}

// Run restore
runRestore(backupDir)
  .then(() => {
    console.log('✅ Restore complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  });
