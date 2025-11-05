# Master Agent Backup & Restore Scripts

Complete backup and restore system for Master Agent project.

## 📦 What Gets Backed Up

1. **Git Repository** - Full history, all branches, all code
2. **Supabase Database** - All tables with your data
3. **Environment Variables** - Configuration templates
4. **Documentation** - All markdown files and guides

## 🚀 Quick Start

### Run Full Backup (Recommended)

```bash
cd /Users/heathmaxwell/master_agent
./scripts/full-backup.sh
```

This backs up everything to: `~/master_agent_backups/full-backup-YYYYMMDD-HHMMSS/`

### Database-Only Backup

```bash
cd /Users/heathmaxwell/master_agent/backend
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
node backup-database.mjs
```

## 📋 Backup Scripts

### `full-backup.sh`
**What it does:**
- Creates Git bundle (entire repository)
- Backs up all database tables to JSON
- Saves environment variable templates
- Copies documentation
- Creates backup manifest

**Usage:**
```bash
./scripts/full-backup.sh
```

**Output location:**
```
~/master_agent_backups/full-backup-YYYYMMDD-HHMMSS/
├── master_agent.bundle          # Git repository
├── database/                    # Database backup
│   ├── documents.json
│   ├── document_chunks.json
│   ├── conversations.json
│   ├── messages.json
│   ├── user_usage.json
│   └── backup-summary.json
├── env/                         # Environment templates
│   ├── backend-env-template.txt
│   └── frontend-env-template.txt
├── docs/                        # Documentation
└── BACKUP_MANIFEST.md          # Restore instructions
```

### `backup-database.mjs`
**What it does:**
- Backs up all Supabase tables to JSON files
- Creates summary with row counts
- Saves to timestamped directory

**Usage:**
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node scripts/backup-database.mjs
```

**Tables backed up:**
- documents
- document_chunks
- conversations
- messages
- user_usage
- database_connections
- sql_query_history

### `restore-database.mjs`
**What it does:**
- Restores database from JSON backup
- Processes in batches to avoid timeouts
- Shows progress and summary

**Usage:**
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node scripts/restore-database.mjs ~/master_agent_backups/db-backup-2025-11-04T23-45-00
```

**⚠️ Warning:** This INSERTS data into the database. Make sure tables are empty or you want to add this data.

## 🔐 Required Environment Variables

### For Database Backup/Restore

Get from Supabase dashboard → Settings → API:

```bash
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
```

**How to get it:**
1. Go to https://supabase.com/dashboard/project/omjwoyyhpdawjxsbpamc/settings/api
2. Copy "service_role" key (NOT the anon key)
3. Export it in your terminal

**Security note:** This is a sensitive key. Never commit it to Git or share it publicly.

## 📅 Recommended Backup Schedule

### Daily Backups (Automated)

Add to your crontab:
```bash
# Edit crontab
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * /Users/heathmaxwell/master_agent/scripts/full-backup.sh >> ~/master_agent_backups/backup.log 2>&1
```

### Manual Backups

Run before:
- Making major changes
- Deploying new features
- Database migrations
- Testing new functionality

## 🔄 How to Restore

### 1. Restore Git Repository

```bash
cd ~/master_agent_backups/full-backup-YYYYMMDD-HHMMSS
git clone master_agent.bundle ~/master_agent_restored
cd ~/master_agent_restored
git remote set-url origin https://github.com/maxha7766/master_agent.git
```

### 2. Restore Database

```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key"
node scripts/restore-database.mjs ~/master_agent_backups/full-backup-YYYYMMDD-HHMMSS/database
```

### 3. Restore Environment Variables

1. Open `env/backend-env-template.txt`
2. Copy values to Railway dashboard → Variables
3. Open `env/frontend-env-template.txt`
4. Copy values to Vercel dashboard → Settings → Environment Variables

### 4. Redeploy

```bash
# Push to GitHub (triggers auto-deploy)
git push origin main
```

## 💾 Backup Storage

### Location
All backups saved to: `~/master_agent_backups/`

### Typical Sizes
- Git bundle: ~10-50 MB
- Database backup: ~5-100 MB (depends on documents)
- Total: ~20-150 MB per backup

### Retention Policy

Recommended:
- Keep last 7 daily backups
- Keep last 4 weekly backups
- Keep last 6 monthly backups

To clean old backups:
```bash
# Delete backups older than 30 days
find ~/master_agent_backups -type d -name "full-backup-*" -mtime +30 -exec rm -rf {} \;
```

## 🆘 Emergency Recovery

If you lose everything:

1. **Restore from backup:**
   ```bash
   cd ~/master_agent_backups
   ls -lt  # Find latest backup
   cd full-backup-YYYYMMDD-HHMMSS
   ```

2. **Follow BACKUP_MANIFEST.md** in that directory

3. **Or create new deployment:**
   - Restore Git → Push to new GitHub repo
   - Create new Railway project → Connect to GitHub
   - Create new Vercel project → Connect to GitHub
   - Restore database to Supabase
   - Set environment variables

## 🧪 Testing Your Backups

**Important:** Test backups regularly to ensure they work!

```bash
# 1. Create a test backup
./scripts/full-backup.sh

# 2. Find the backup
ls -lt ~/master_agent_backups

# 3. Try restoring Git
cd /tmp
git clone ~/master_agent_backups/full-backup-YYYYMMDD-HHMMSS/master_agent.bundle test-restore

# 4. Verify files
cd test-restore
ls -la

# 5. Clean up
cd ..
rm -rf test-restore
```

## 📞 Troubleshooting

### "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
**Fix:** Export the key before running:
```bash
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"
```

### "Error backing up table: row-level security policy"
**Fix:** Service role key bypasses RLS. Make sure you're using the SERVICE_ROLE key, not the ANON key.

### "Backup failed: timeout"
**Fix:** Large tables might timeout. Edit the script to backup tables individually or increase timeout.

### Git bundle is huge
**Fix:** This is normal if you have large files in history. Consider cleaning Git history:
```bash
git filter-branch --tree-filter 'rm -rf large-directory' HEAD
```

## 🔒 Security Notes

1. **Never commit backup files to Git** - Already in .gitignore
2. **Keep service role key secure** - Don't share or commit it
3. **Encrypt backups if sharing** - Use `zip -e` or `gpg`
4. **Backups contain all your data** - Treat like production database

## 📚 Additional Resources

- [Supabase Backup Guide](https://supabase.com/docs/guides/platform/backups)
- [Git Bundle Documentation](https://git-scm.com/docs/git-bundle)
- [Railway Backup Best Practices](https://docs.railway.app/guides/backups)
