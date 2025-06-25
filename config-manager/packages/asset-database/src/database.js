"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetDatabaseService = void 0;
const pg_1 = require("pg");
const crypto_1 = require("crypto");
const schema_1 = require("./schema");
class AssetDatabaseService {
    constructor(options) {
        this.initialized = false;
        this.options = options;
        this.pool = this.createPool();
    }
    createPool() {
        const config = this.parseConnectionString(this.options.connectionString);
        if (this.options.ssl !== undefined) {
            config.ssl = this.options.ssl ? { rejectUnauthorized: false } : false;
        }
        if (this.options.poolSize) {
            config.max = this.options.poolSize;
        }
        return new pg_1.Pool(config);
    }
    parseConnectionString(connectionString) {
        const url = new URL(connectionString);
        const config = {
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
    async ensureSchema() {
        if (this.initialized) {
            return;
        }
        let client;
        try {
            client = await this.pool.connect();
            await client.query(schema_1.SCHEMA_SQL);
            this.initialized = true;
        }
        catch (error) {
            throw new Error(`Failed to ensure database schema: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async getAsset(key, category) {
        await this.ensureSchema();
        let client;
        try {
            client = await this.pool.connect();
            let query = `
        SELECT * FROM public.asset 
        WHERE owner_key = $1 AND asset_key = $2
      `;
            const params = [this.options.ownerKey, key];
            if (category) {
                query += ' AND asset_category = $3';
                params.push(category);
            }
            const result = await client.query(query, params);
            if (result.rows.length === 0) {
                return null;
            }
            return result.rows[0];
        }
        catch (error) {
            throw new Error(`Failed to get asset: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async storeAsset(key, content, category = 'default', description) {
        await this.ensureSchema();
        const data = { content };
        const dataHash = this.calculateHash(JSON.stringify(data));
        let client;
        try {
            client = await this.pool.connect();
            // Begin transaction
            await client.query('BEGIN');
            // Check if asset exists
            const existingResult = await client.query('SELECT id, data_hash FROM public.asset WHERE owner_key = $1 AND asset_key = $2', [this.options.ownerKey, key]);
            if (existingResult.rows.length > 0) {
                const existing = existingResult.rows[0];
                // Only update if content has changed
                if (existing.data_hash !== dataHash) {
                    // Insert into history log
                    await client.query(`INSERT INTO public.asset_log 
            (asset_id, owner_category, asset_category, owner_key, asset_key, description, data, data_hash)
            SELECT id, owner_category, asset_category, owner_key, asset_key, description, data, data_hash
            FROM public.asset WHERE id = $1`, [existing.id]);
                    // Update asset
                    await client.query(`UPDATE public.asset 
            SET data = $1, data_hash = $2, description = $3, created_at = CURRENT_TIMESTAMP
            WHERE id = $4`, [data, dataHash, description, existing.id]);
                }
            }
            else {
                // Insert new asset
                await client.query(`INSERT INTO public.asset 
          (owner_category, asset_category, owner_key, asset_key, description, data, data_hash)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`, [this.options.ownerCategory, category, this.options.ownerKey, key, description, data, dataHash]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            throw new Error(`Failed to store asset: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async listAssets(category) {
        await this.ensureSchema();
        let client;
        try {
            client = await this.pool.connect();
            let query = `
        SELECT id, asset_key, asset_category, created_at, data_hash, description
        FROM public.asset 
        WHERE owner_key = $1
      `;
            const params = [this.options.ownerKey];
            if (category) {
                query += ' AND asset_category = $2';
                params.push(category);
            }
            query += ' ORDER BY created_at DESC';
            const result = await client.query(query, params);
            return result.rows;
        }
        catch (error) {
            throw new Error(`Failed to list assets: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async getAssetHistory(key) {
        await this.ensureSchema();
        let client;
        try {
            client = await this.pool.connect();
            const result = await client.query(`SELECT l.* FROM public.asset_log l
        JOIN public.asset a ON l.asset_id = a.id
        WHERE a.owner_key = $1 AND a.asset_key = $2
        ORDER BY l.created_at DESC`, [this.options.ownerKey, key]);
            return result.rows;
        }
        catch (error) {
            throw new Error(`Failed to get asset history: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async deleteAsset(key) {
        await this.ensureSchema();
        let client;
        try {
            client = await this.pool.connect();
            await client.query('BEGIN');
            // Delete history first (due to foreign key)
            await client.query(`DELETE FROM public.asset_log 
        WHERE asset_id IN (
          SELECT id FROM public.asset 
          WHERE owner_key = $1 AND asset_key = $2
        )`, [this.options.ownerKey, key]);
            // Delete asset
            const result = await client.query('DELETE FROM public.asset WHERE owner_key = $1 AND asset_key = $2', [this.options.ownerKey, key]);
            await client.query('COMMIT');
            return result.rowCount !== null && result.rowCount > 0;
        }
        catch (error) {
            if (client) {
                await client.query('ROLLBACK');
            }
            throw new Error(`Failed to delete asset: ${error}`);
        }
        finally {
            if (client) {
                client.release();
            }
        }
    }
    async close() {
        await this.pool.end();
    }
    calculateHash(data) {
        return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
    }
}
exports.AssetDatabaseService = AssetDatabaseService;
