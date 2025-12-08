-- Migration: 009_drop_pools
-- Description: Drops unused pools table
-- Date: 2025-12-07

DROP TABLE IF EXISTS pools CASCADE;
