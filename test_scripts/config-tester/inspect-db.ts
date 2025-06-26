import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function inspectDatabase() {
    const connectionString = process.env.DB_CONNECTION_STRING || 'postgresql://biks:biks2013@localhost:5432/agent_cache';
    const ownerKey = process.env.OWNER_KEY || 'test-page';
    
    console.log('Connecting to database:', connectionString);
    console.log('Looking for assets with owner_key:', ownerKey);
    
    const pool = new Pool({
        connectionString: connectionString
    });
    
    try {
        // Check if tables exist
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('asset', 'asset_log')
            ORDER BY table_name;
        `;
        
        const tablesResult = await pool.query(tablesQuery);
        console.log('\nExisting tables:', tablesResult.rows);
        
        // Count all assets
        const countQuery = 'SELECT COUNT(*) as total FROM public.asset';
        const countResult = await pool.query(countQuery);
        console.log('\nTotal assets in database:', countResult.rows[0].total);
        
        // List all unique owner_keys
        const ownersQuery = 'SELECT DISTINCT owner_key, owner_category FROM public.asset ORDER BY owner_key';
        const ownersResult = await pool.query(ownersQuery);
        console.log('\nUnique owner_keys in database:');
        ownersResult.rows.forEach((row: any) => {
            console.log(`  - ${row.owner_key} (category: ${row.owner_category})`);
        });
        
        // Find assets for our owner_key
        const assetsQuery = `
            SELECT id, owner_key, asset_key, asset_category, created_at, data_hash, description
            FROM public.asset 
            WHERE owner_key = $1
            ORDER BY created_at DESC
        `;
        
        const assetsResult = await pool.query(assetsQuery, [ownerKey]);
        console.log(`\nAssets for owner_key '${ownerKey}':`, assetsResult.rows.length);
        
        if (assetsResult.rows.length > 0) {
            assetsResult.rows.forEach((row: any, index: number) => {
                console.log(`\nAsset ${index + 1}:`);
                console.log('  ID:', row.id);
                console.log('  Asset Key:', row.asset_key);
                console.log('  Category:', row.asset_category);
                console.log('  Created:', row.created_at);
                console.log('  Description:', row.description);
                console.log('  Data Hash:', row.data_hash);
            });
            
            // Show the actual data for the first asset
            const dataQuery = 'SELECT data FROM public.asset WHERE id = $1';
            const dataResult = await pool.query(dataQuery, [assetsResult.rows[0].id]);
            console.log('\nData for first asset:');
            console.log(JSON.stringify(dataResult.rows[0].data, null, 2));
        }
        
        // Check asset_log table
        const logQuery = `
            SELECT COUNT(*) as total 
            FROM public.asset_log 
            WHERE owner_key = $1
        `;
        const logResult = await pool.query(logQuery, [ownerKey]);
        console.log(`\nHistory entries for owner_key '${ownerKey}':`, logResult.rows[0].total);
        
    } catch (error) {
        console.error('Database inspection error:', error);
    } finally {
        await pool.end();
    }
}

// Run the inspection
inspectDatabase().catch(console.error);