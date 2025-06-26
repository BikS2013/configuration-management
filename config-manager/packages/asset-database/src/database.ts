import { Pool, PoolClient, PoolConfig } from 'pg';
import { createHash } from 'crypto';
import { SCHEMA_SQL } from './schema';
import {
  AssetDatabaseOptions,
  AssetRecord,
  AssetHistoryRecord,
  AssetMetadata,
  DatabaseConfig,
} from './types';

export class AssetDatabaseService {
  private pool: Pool;
  private readonly options: AssetDatabaseOptions;
  private initialized: boolean = false;

  constructor(options: AssetDatabaseOptions) {
    this.options = options;
    this.pool = this.createPool();
  }

  private createPool(): Pool {
    const config: PoolConfig = this.parseConnectionString(this.options.connectionString);
    
    if (this.options.ssl !== undefined) {
      config.ssl = this.options.ssl ? { rejectUnauthorized: false } : false;
    }
    
    if (this.options.poolSize) {
      config.max = this.options.poolSize;
    }

    return new Pool(config);
  }

  private parseConnectionString(connectionString: string): PoolConfig {
    const url = new URL(connectionString);
    
    const config: PoolConfig = {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1),
      user: url.username,
      password: url.password,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
    };

    // Check for Azure PostgreSQL
    if (url.hostname.includes('.postgres.database.azure.com')) {
      config.ssl = { rejectUnauthorized: false };
    }

    return config;
  }

  async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query(SCHEMA_SQL);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to ensure database schema: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async getAsset(key: string, category?: string): Promise<AssetRecord | null> {
    await this.ensureSchema();

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      
      let query = `
        SELECT * FROM public.asset 
        WHERE owner_key = $1 AND asset_key = $2
      `;
      const params: any[] = [this.options.ownerKey, key];

      if (category) {
        query += ' AND asset_category = $3';
        params.push(category);
      }

      if (this.options.verbose) {
        console.log('\n🔍 Database getAsset query:', {
          ownerKey: this.options.ownerKey,
          assetKey: key,
          category: category || 'not specified',
          query: query.trim(),
          params
        });
      }

      const result = await client.query(query, params);
      
      if (this.options.verbose) {
        console.log(`📊 Database getAsset result: found ${result.rows.length} rows`);
        if (result.rows.length > 0) {
          console.log(`   Asset ID: ${result.rows[0].id}`);
          console.log(`   Created: ${new Date(result.rows[0].created_at).toLocaleString()}`);
          console.log(`   Hash: ${result.rows[0].data_hash.substring(0, 16)}...`);
        }
      }
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as AssetRecord;
    } catch (error) {
      throw new Error(`Failed to get asset: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async storeAsset(
    key: string,
    content: string,
    category: string = 'default',
    description?: string
  ): Promise<void> {
    await this.ensureSchema();

    const data = { content };
    const dataHash = this.calculateHash(JSON.stringify(data));

    if (this.options.verbose) {
      console.log('\n💾 Database storeAsset operation:');
      console.log(`   🔑 Key: ${key}`);
      console.log(`   📁 Category: ${category}`);
      console.log(`   📏 Content size: ${content.length} bytes`);
      console.log(`   🔐 New hash: ${dataHash.substring(0, 16)}...`);
    }

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      
      // Begin transaction
      await client.query('BEGIN');

      // Check if asset exists
      const existingResult = await client.query(
        'SELECT id, data_hash FROM public.asset WHERE owner_key = $1 AND asset_key = $2',
        [this.options.ownerKey, key]
      );

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        
        // Only update if content has changed
        if (existing.data_hash !== dataHash) {
          if (this.options.verbose) {
            console.log(`   ♻️  Asset exists, updating...`);
            console.log(`   📝 Old hash: ${existing.data_hash.substring(0, 16)}...`);
          }
          
          // Insert into history log
          await client.query(
            `INSERT INTO public.asset_log 
            (asset_id, owner_category, asset_category, owner_key, asset_key, description, data, data_hash)
            SELECT id, owner_category, asset_category, owner_key, asset_key, description, data, data_hash
            FROM public.asset WHERE id = $1`,
            [existing.id]
          );

          // Update asset
          await client.query(
            `UPDATE public.asset 
            SET data = $1, data_hash = $2, description = $3, created_at = CURRENT_TIMESTAMP
            WHERE id = $4`,
            [data, dataHash, description, existing.id]
          );
          
          if (this.options.verbose) {
            console.log(`   ✅ Asset updated successfully`);
          }
        } else {
          if (this.options.verbose) {
            console.log(`   ⏸️  Asset unchanged (same hash)`);
          }
        }
      } else {
        if (this.options.verbose) {
          console.log(`   🆕 Creating new asset...`);
        }
        
        // Insert new asset
        await client.query(
          `INSERT INTO public.asset 
          (owner_category, asset_category, owner_key, asset_key, description, data, data_hash)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [this.options.ownerCategory, category, this.options.ownerKey, key, description, data, dataHash]
        );
        
        if (this.options.verbose) {
          console.log(`   ✅ New asset created successfully`);
        }
      }

      await client.query('COMMIT');
      
      if (this.options.verbose) {
        console.log(`   ✅ Transaction committed\n`);
      }
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      throw new Error(`Failed to store asset: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async listAssets(category?: string): Promise<AssetMetadata[]> {
    await this.ensureSchema();

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      
      let query = `
        SELECT id, asset_key, asset_category, created_at, data_hash, description
        FROM public.asset 
        WHERE owner_key = $1
      `;
      const params: any[] = [this.options.ownerKey];

      if (category) {
        query += ' AND asset_category = $2';
        params.push(category);
      }

      query += ' ORDER BY created_at DESC';

      const result = await client.query(query, params);
      
      return result.rows as AssetMetadata[];
    } catch (error) {
      throw new Error(`Failed to list assets: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async getAssetHistory(key: string): Promise<AssetHistoryRecord[]> {
    await this.ensureSchema();

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      
      const result = await client.query(
        `SELECT l.* FROM public.asset_log l
        JOIN public.asset a ON l.asset_id = a.id
        WHERE a.owner_key = $1 AND a.asset_key = $2
        ORDER BY l.created_at DESC`,
        [this.options.ownerKey, key]
      );
      
      return result.rows as AssetHistoryRecord[];
    } catch (error) {
      throw new Error(`Failed to get asset history: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async deleteAsset(key: string): Promise<boolean> {
    await this.ensureSchema();

    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      
      await client.query('BEGIN');

      // Delete history first (due to foreign key)
      await client.query(
        `DELETE FROM public.asset_log 
        WHERE asset_id IN (
          SELECT id FROM public.asset 
          WHERE owner_key = $1 AND asset_key = $2
        )`,
        [this.options.ownerKey, key]
      );

      // Delete asset
      const result = await client.query(
        'DELETE FROM public.asset WHERE owner_key = $1 AND asset_key = $2',
        [this.options.ownerKey, key]
      );

      await client.query('COMMIT');
      
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      throw new Error(`Failed to delete asset: ${error}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private calculateHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}