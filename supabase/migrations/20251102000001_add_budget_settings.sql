-- ============================================
-- Add Budget Settings to User Settings
-- Migration: 20251102000001_add_budget_settings
-- Created: 2025-11-02
-- ============================================

-- Add monthly_budget_limit column to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS monthly_budget_limit DECIMAL(10, 2) DEFAULT 10.00 NOT NULL
CHECK (monthly_budget_limit >= 0 AND monthly_budget_limit <= 1000);

-- Add comment
COMMENT ON COLUMN user_settings.monthly_budget_limit IS 'Monthly spending limit in USD (0-1000)';

-- Update existing rows to have the default value
UPDATE user_settings
SET monthly_budget_limit = 10.00
WHERE monthly_budget_limit IS NULL;
