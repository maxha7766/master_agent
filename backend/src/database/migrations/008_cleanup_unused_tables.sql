-- Migration: 008_cleanup_unused_tables
-- Description: Drops tables identified as unused in the master_agent codebase
-- Date: 2025-12-07

-- 1. Daily Briefs Cluster
DROP TABLE IF EXISTS daily_brief_headlines CASCADE;
DROP TABLE IF EXISTS daily_brief_schedules CASCADE;
DROP TABLE IF EXISTS daily_brief_sources CASCADE;
DROP TABLE IF EXISTS daily_briefs CASCADE;

-- 2. Legacy/Unused Features
DROP TABLE IF EXISTS agency_tickers CASCADE;
DROP TABLE IF EXISTS dealer_mappings CASCADE;
DROP TABLE IF EXISTS inventories CASCADE;
DROP TABLE IF EXISTS story_map CASCADE;
DROP TABLE IF EXISTS story_mappings CASCADE;

-- 3. Logging/Reports (Superseded by other tables)
DROP TABLE IF EXISTS query_logs CASCADE;
DROP TABLE IF EXISTS research_reports CASCADE;
