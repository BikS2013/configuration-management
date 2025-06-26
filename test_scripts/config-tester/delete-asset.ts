import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function deleteTestAsset() {
    const connectionString = process.env.DB_CONNECTION_STRING || 'postgresql://biks:biks2013@localhost:5432/agent_cache';
    const ownerKey = process.env.OWNER_KEY || 'test-page';
    const assetKey = process.env.ASSET_KEY || 'settings/env-settings';
    
    console.log('Connecting to database:', connectionString);
    console.log('Deleting asset for owner_key:', ownerKey, 'asset_key:', assetKey);
    
    const pool = new Pool({
        connectionString: connectionString
    });
    
    try {
        // Delete the asset
        const deleteQuery = `
            DELETE FROM public.asset 
            WHERE owner_key = $1 AND asset_key = $2
        `;
        
        const result = await pool.query(deleteQuery, [ownerKey, assetKey]);
        console.log('Deleted rows:', result.rowCount);
        
        // Verify deletion
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM public.asset 
            WHERE owner_key = $1 AND asset_key = $2
        `;
        
        const checkResult = await pool.query(checkQuery, [ownerKey, assetKey]);
        console.log('Remaining assets with this key:', checkResult.rows[0].count);
        
    } catch (error) {
        console.error('Database error:', error);
    } finally {
        await pool.end();
    }
}

// Run the deletion
deleteTestAsset().catch(console.error);