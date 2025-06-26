import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function inspectAllAssets() {
    const connectionString = process.env.DB_CONNECTION_STRING || 'postgresql://biks:biks2013@localhost:5432/agent_cache';
    
    console.log('Connecting to database:', connectionString);
    
    const pool = new Pool({
        connectionString: connectionString
    });
    
    try {
        // Show ALL assets in the database
        const allAssetsQuery = `
            SELECT id, owner_category, owner_key, asset_key, asset_category, 
                   created_at, description, data_hash
            FROM public.asset 
            ORDER BY created_at DESC
            LIMIT 20
        `;
        
        const allAssetsResult = await pool.query(allAssetsQuery);
        console.log('\nALL ASSETS IN DATABASE (most recent 20):');
        console.log('=========================================');
        
        allAssetsResult.rows.forEach((row: any, index: number) => {
            console.log(`\nAsset ${index + 1}:`);
            console.log('  ID:', row.id);
            console.log('  Owner Category:', row.owner_category);
            console.log('  Owner Key:', row.owner_key);
            console.log('  Asset Key:', row.asset_key);
            console.log('  Asset Category:', row.asset_category);
            console.log('  Created:', row.created_at);
            console.log('  Description:', row.description);
            console.log('  Data Hash:', row.data_hash.substring(0, 16) + '...');
        });
        
        // Show data for the most recent asset
        if (allAssetsResult.rows.length > 0) {
            const dataQuery = 'SELECT data FROM public.asset WHERE id = $1';
            const dataResult = await pool.query(dataQuery, [allAssetsResult.rows[0].id]);
            console.log('\n\nDATA FOR MOST RECENT ASSET:');
            console.log('============================');
            console.log(JSON.stringify(dataResult.rows[0].data, null, 2));
        }
        
    } catch (error) {
        console.error('Database inspection error:', error);
    } finally {
        await pool.end();
    }
}

// Run the inspection
inspectAllAssets().catch(console.error);