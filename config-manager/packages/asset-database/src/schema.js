"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_SQL = void 0;
exports.SCHEMA_SQL = `
-- Main asset table
CREATE TABLE IF NOT EXISTS public.asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  owner_category VARCHAR(255) NOT NULL,
  asset_category VARCHAR(255) NOT NULL,
  owner_key VARCHAR(255) NOT NULL,
  asset_key VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  UNIQUE(owner_key, asset_key)
);

-- Asset history/audit log
CREATE TABLE IF NOT EXISTS public.asset_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.asset(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  owner_category VARCHAR(255) NOT NULL,
  asset_category VARCHAR(255) NOT NULL,
  owner_key VARCHAR(255) NOT NULL,
  asset_key VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  data_hash VARCHAR(64) NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_asset_owner_key ON public.asset(owner_key);
CREATE INDEX IF NOT EXISTS idx_asset_asset_key ON public.asset(asset_key);
CREATE INDEX IF NOT EXISTS idx_asset_category ON public.asset(asset_category);
CREATE INDEX IF NOT EXISTS idx_asset_owner_category ON public.asset(owner_category);
CREATE INDEX IF NOT EXISTS idx_asset_log_asset_id ON public.asset_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_log_created_at ON public.asset_log(created_at);
`;
