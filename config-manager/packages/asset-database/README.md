# @biks2013/asset-database

PostgreSQL storage service for configuration assets with version history and audit logging.

## Installation

```bash
npm install @biks2013/asset-database
```

## Features

- 🗄️ PostgreSQL storage with JSONB support
- 📝 Full version history and audit logging
- 🔐 SHA256 hash tracking for change detection
- 🏷️ Category-based organization
- 🔄 Connection pooling and retry logic
- ☁️ Azure PostgreSQL support

## Usage

```typescript
import { AssetDatabaseService } from '@biks2013/asset-database';

const service = new AssetDatabaseService({
  connectionString: 'postgresql://user:pass@localhost:5432/mydb',
  ownerCategory: 'application',
  ownerKey: 'my-app',
  ssl: true,
  poolSize: 10,
});

// Ensure database schema exists
await service.ensureSchema();

// Store an asset
await service.storeAsset(
  'app-config',
  JSON.stringify({ version: '1.0.0' }),
  'config',
  'Application configuration'
);

// Retrieve an asset
const asset = await service.getAsset('app-config', 'config');
if (asset) {
  console.log(asset.data.content);
}

// List all assets
const assets = await service.listAssets('config');

// Get asset history
const history = await service.getAssetHistory('app-config');

// Delete an asset
await service.deleteAsset('app-config');

// Close connection pool
await service.close();
```

## Database Schema

The service automatically creates two tables:

### `asset` Table

```sql
CREATE TABLE public.asset (
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
```

### `asset_log` Table

```sql
CREATE TABLE public.asset_log (
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
```

## API

### Constructor Options

```typescript
interface AssetDatabaseOptions {
  connectionString: string;  // PostgreSQL connection string
  ownerCategory: string;     // Category for this service instance
  ownerKey: string;          // Unique key for this service instance
  ssl?: boolean;             // Enable SSL (default: auto-detect)
  poolSize?: number;         // Connection pool size (default: 10)
}
```

### Methods

#### `ensureSchema(): Promise<void>`

Creates the database schema if it doesn't exist.

#### `getAsset(key: string, category?: string): Promise<AssetRecord | null>`

Retrieves an asset by key and optional category.

#### `storeAsset(key: string, content: string, category?: string, description?: string): Promise<void>`

Stores or updates an asset. Automatically creates history entries.

#### `listAssets(category?: string): Promise<AssetMetadata[]>`

Lists all assets, optionally filtered by category.

#### `getAssetHistory(key: string): Promise<AssetHistoryRecord[]>`

Retrieves the complete history for an asset.

#### `deleteAsset(key: string): Promise<boolean>`

Deletes an asset and its history. Returns true if deleted.

#### `close(): Promise<void>`

Closes the database connection pool.

## Connection String Format

Standard PostgreSQL:
```
postgresql://username:password@host:port/database
```

Azure PostgreSQL:
```
postgresql://username@servername:password@servername.postgres.database.azure.com:5432/database?sslmode=require
```

## License

MIT