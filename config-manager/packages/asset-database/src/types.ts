export interface AssetDatabaseOptions {
  connectionString: string;
  ownerCategory: string;
  ownerKey: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface AssetRecord {
  id: string;
  created_at: Date;
  owner_category: string;
  asset_category: string;
  owner_key: string;
  asset_key: string;
  description?: string;
  data: any;
  data_hash: string;
}

export interface AssetHistoryRecord {
  id: string;
  asset_id: string;
  created_at: Date;
  owner_category: string;
  asset_category: string;
  owner_key: string;
  asset_key: string;
  description?: string;
  data: any;
  data_hash: string;
}

export interface AssetMetadata {
  id: string;
  asset_key: string;
  asset_category: string;
  created_at: Date;
  data_hash: string;
  description?: string;
}

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}