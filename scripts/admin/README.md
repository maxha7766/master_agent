# Admin Scripts

Administrative utilities for database maintenance and user management.

## Scripts

### Data Management
- `delete-*.mjs` - Delete documents and data
- `clean-*.mjs` - Clean up orphaned records
- `transfer-*.mjs` - Transfer data between users
- `verify-*.mjs` - Verify data integrity

### User Management
- `reset-password.js` - Reset user passwords

## Usage

```bash
node scripts/admin/clean-documents.mjs
node scripts/admin/reset-password.js user@example.com
```

## Safety

⚠️ **DANGER**: These scripts modify production data. Always:
1. Create a backup before running
2. Test on development database first
3. Verify the script targets correct records
4. Have a rollback plan

## Requirements

- Admin access to Supabase
- `SUPABASE_SERVICE_ROLE_KEY` in `.env`
