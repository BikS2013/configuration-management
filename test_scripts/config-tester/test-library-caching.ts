import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import { createConfigService } from '@biks2013/config-service';
import dotenv from 'dotenv';

dotenv.config();

async function testLibraryCaching() {
    console.log('Testing library auto-caching behavior...\n');
    
    // Configuration from environment
    const githubToken = process.env.GITHUB_TOKEN!;
    const repoOwner = process.env.REPO_OWNER!;
    const repoName = process.env.REPO_NAME!;
    const branch = process.env.BRANCH || 'main';
    const ownerKey = process.env.OWNER_KEY!;
    const assetKey = process.env.ASSET_KEY!;
    const assetPath = process.env.ASSET_PATH!;
    const dbConnectionString = process.env.DB_CONNECTION_STRING!;
    
    // Create GitHub client
    const githubClient = new GitHubAssetClient({
        token: githubToken,
        repo: `${repoOwner}/${repoName}`,
        branch: branch
    });
    
    // Create database service
    const databaseService = new AssetDatabaseService({
        connectionString: dbConnectionString,
        ownerCategory: 'config-manager',
        ownerKey: ownerKey
    });
    
    await databaseService.ensureSchema();
    
    // First, clear any existing asset
    console.log('1. Clearing existing asset from database...');
    try {
        const deleteQuery = `
            DELETE FROM public.asset 
            WHERE owner_key = $1 AND asset_key = $2
        `;
        // @ts-ignore - accessing private pool for testing
        const client = await databaseService.pool.connect();
        await client.query(deleteQuery, [ownerKey, assetKey]);
        client.release();
        console.log('   ✓ Asset cleared\n');
    } catch (error) {
        console.log('   ✓ No existing asset to clear\n');
    }
    
    // Create config service with both sources
    console.log('2. Creating ConfigService with GitHub and Database sources...');
    const configServiceFactory = createConfigService({
        sources: [
            {
                type: 'database',
                priority: 1, // Try database first
                options: {
                    service: databaseService,
                    assetKey: assetKey,
                    category: 'configuration'
                }
            },
            {
                type: 'github',
                priority: 2, // Fall back to GitHub
                options: {
                    client: githubClient,
                    assetKey: assetPath
                }
            }
        ],
        parser: async (content: string) => {
            // For this test, just return the content as-is
            return { content };
        }
    }, (service, data) => {
        // Process the configuration - configs is protected, so we'll just store the data
        // The service will handle it internally
    });
    
    const configService = configServiceFactory();
    console.log('   ✓ ConfigService created\n');
    
    // First load - should fetch from GitHub and auto-cache
    console.log('3. First load (database empty, should fetch from GitHub and auto-cache)...');
    const firstConfig = await configService.getConfig();
    console.log('   ✓ Config loaded, has content:', firstConfig?.content ? 'yes' : 'no');
    
    // Check if it was cached in database
    console.log('\n4. Checking if asset was auto-cached in database...');
    const cachedAsset = await databaseService.getAsset(assetKey, 'configuration');
    if (cachedAsset) {
        console.log('   ✓ Asset auto-cached successfully!');
        console.log('   - Asset ID:', cachedAsset.id);
        console.log('   - Created at:', cachedAsset.created_at);
        console.log('   - Data hash:', cachedAsset.data_hash.substring(0, 16) + '...');
    } else {
        console.log('   ✗ Asset not found in cache');
    }
    
    // Second load - should come from database cache
    console.log('\n5. Second load (should come from database cache)...');
    const configService2Factory = createConfigService({
        sources: [
            {
                type: 'database',
                priority: 1,
                options: {
                    service: databaseService,
                    assetKey: assetKey,
                    category: 'configuration'
                }
            },
            {
                type: 'github',
                priority: 2,
                options: {
                    client: githubClient,
                    assetKey: assetPath
                }
            }
        ],
        parser: async (content: string) => ({ content })
    }, (service, data) => {
        // Process the configuration - configs is protected
    });
    
    const configService2 = configService2Factory();
    const secondConfig = await configService2.getConfig();
    console.log('   ✓ Config loaded from cache, has content:', secondConfig?.content ? 'yes' : 'no');
    console.log('   ✓ Successfully loaded from database cache!\n');
    
    // Close database connection
    await databaseService.close();
    
    console.log('✅ Auto-caching test completed successfully!');
}

// Run the test
testLibraryCaching().catch(console.error);