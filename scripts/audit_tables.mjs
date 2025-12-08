import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const TYPES_FILE = 'backend/src/models/database.types.ts';
const SEARCH_DIRS = ['backend/src', 'frontend'];
const IGNORE_FILES = ['backend/src/models/database.types.ts', 'backend/src/database/migrations'];

function getTables() {
    const content = readFileSync(TYPES_FILE, 'utf-8');
    const tables = [];
    let insideTables = false;

    // Simple parsing logic tailored to Supabase generated types
    // Look for "Tables: {" and then extract keys
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.includes('Tables: {')) {
            insideTables = true;
            continue;
        }

        if (insideTables) {
            // Stop if we hit the closing brace of Tables block
            // This is risky but works if the file is standard prettier formatted
            if (line.trim() === '}') {
                // Check if indentation level matches closing of Tables
                // Assuming Tables is indented by 4 spaces, closing brace should be 4 spaces
                if (line.startsWith('    }')) {
                    insideTables = false;
                    break;
                }
            }

            // Match table definitions. They usually look like:
            //       agency_tickers: {
            const match = line.match(/^\s{6}([a-z0-9_]+): \{/);
            if (match) {
                tables.push(match[1]);
            }
        }
    }
    console.log('Tables found:', tables);
    return tables;
}

function checkUsage(table) {
    let count = 0;
    try {
        // Grep for table name, excluding the types file and migrations
        // We look for string usage of the table name, e.g. from('table_name') or "table_name"
        const cmd = `grep -r "${table}" ${SEARCH_DIRS.join(' ')} --exclude-dir=node_modules --exclude="${path.basename(TYPES_FILE)}"`;
        const result = execSync(cmd, { encoding: 'utf-8' });

        // Filter out migration files from results manually if grep --exclude-dir isn't enough
        const lines = result.split('\n').filter(line => line.length > 0);
        const validLines = lines.filter(line => !line.includes('backend/src/database/migrations'));

        count = validLines.length;

        // If count is low, print the lines for verification
        if (count > 0 && count < 3) {
            // console.log(`  Hits for ${table}:`, validLines.map(l => l.substring(0, 100).trim()));
        }
    } catch (e) {
        // grep returns exit code 1 if no matches found
        count = 0;
    }
    return count;
}

function runAudit() {
    console.log('🔍 Starting Database Table Audit...');
    console.log(`Parsing ${TYPES_FILE}...`);

    const tables = getTables();
    console.log(`Found ${tables.length} tables in schema.`);

    const unused = [];
    const used = [];

    console.log('Checking usage...');
    for (const table of tables) {
        const usageCount = checkUsage(table);
        if (usageCount === 0) {
            unused.push(table);
        } else {
            used.push({ name: table, count: usageCount });
        }
    }

    console.log('\n================================');
    console.log(`✅ USED TABLES (${used.length})`);
    console.log('================================');
    used.forEach(u => console.log(`- ${u.name} (${u.count} refs)`));

    console.log('\n================================');
    console.log(`❌ UNUSED TABLES (${unused.length})`);
    console.log('================================');
    unused.forEach(t => console.log(`- ${t}`));

    console.log('\n================================');
}

runAudit();
