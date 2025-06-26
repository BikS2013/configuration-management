import express from 'express';
import path from 'path';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import { createConfigService } from '@biks2013/config-service';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3333;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Endpoint to get environment configuration
app.get('/api/config', (req, res) => {
    res.json({
        githubToken: process.env.GITHUB_TOKEN || '',
        repoOwner: process.env.REPO_OWNER || '',
        repoName: process.env.REPO_NAME || '',
        branch: process.env.BRANCH || '',
        ownerKey: process.env.OWNER_KEY || '',
        assetKey: process.env.ASSET_KEY || '',
        assetPath: process.env.ASSET_PATH || '',
        dbConnectionString: process.env.DB_CONNECTION_STRING || '',
        useDatabase: process.env.USE_DATABASE === 'true',
        defaultTestMode: process.env.DEFAULT_TEST_MODE || 'configService'
    });
});

app.post('/api/test', async (req, res) => {
    const {
        githubToken,
        repoOwner,
        repoName,
        branch,
        ownerKey,
        assetKey,
        assetPath,
        dbConnectionString,
        useDatabase,
        testMode
    } = req.body;

    try {
        let result: any = {};
        let githubClient: GitHubAssetClient | undefined;
        let database: AssetDatabaseService | undefined;

        // Validate parameters based on test mode
        if (testMode === 'direct') {
            if (!githubToken || !repoOwner || !repoName || !assetPath) {
                throw new Error('Missing required GitHub parameters for direct fetch.');
            }
        } else {
            if (!githubToken || !repoOwner || !repoName || !ownerKey || !assetKey || !assetPath) {
                throw new Error('Missing required parameters. Please fill in all configuration fields.');
            }
        }

        // Initialize GitHub client if needed
        if (githubToken && repoOwner && repoName) {
            githubClient = new GitHubAssetClient({
                token: githubToken,
                repo: `${repoOwner}/${repoName}`,
                branch: branch || undefined,
                timeout: 5000, // 5 seconds timeout for faster failure
                retryOptions: {
                    retries: 1, // Only 1 retry for faster testing
                    minTimeout: 500,
                    maxTimeout: 1000
                }
            });
        }

        // Initialize database if configured
        if (useDatabase && dbConnectionString && testMode !== 'direct') {
            try {
                console.log('Initializing database with ownerKey:', ownerKey);
                database = new AssetDatabaseService({
                    connectionString: dbConnectionString,
                    ownerCategory: 'config-manager',
                    ownerKey: ownerKey
                });
                await database.ensureSchema();
                console.log('Database initialized successfully');
                
                // Debug: List all assets in database
                const allAssets = await database.listAssets();
                console.log('All assets in database:', allAssets);
            } catch (dbError: any) {
                console.error('Database initialization error:', dbError);
                throw new Error(`Database connection failed: ${dbError.message}. Check your connection string and ensure PostgreSQL is running.`);
            }
        }

        switch (testMode) {
            case 'direct':
                // Direct GitHub fetch without any caching
                if (!githubClient) {
                    throw new Error('GitHub client not initialized.');
                }
                try {
                    console.log('Direct fetch from GitHub:', assetPath);
                    const asset = await githubClient.getAsset(assetPath);
                    
                    result = {
                        success: true,
                        asset: asset.content,
                        metadata: {
                            path: assetPath,
                            size: asset.size,
                            sha: asset.sha,
                            source: 'github-direct'
                        }
                    };
                } catch (fetchError: any) {
                    throw new Error(`GitHub fetch failed: ${fetchError.message}`);
                }
                break;

            case 'configService':
                // Use the config service with auto-caching
                if (!githubClient) {
                    throw new Error('GitHub client not initialized.');
                }
                
                const sources: any[] = [];
                
                // Add GitHub source first (primary source)
                sources.push({
                    type: 'github',
                    priority: 1,
                    options: {
                        client: githubClient,
                        assetKey: assetPath
                    }
                });
                
                // Add database source as fallback (lower priority)
                if (database) {
                    sources.push({
                        type: 'database',
                        priority: 2,
                        options: {
                            service: database,
                            assetKey: assetKey,
                            category: 'configuration'
                        }
                    });
                }
                
                console.log('Creating ConfigService with sources:', sources.map(s => s.type));
                
                const configServiceFactory = createConfigService({
                    sources,
                    parser: async (content: string) => {
                        // Try to parse as JSON, otherwise keep as string
                        try {
                            return { type: 'json', data: JSON.parse(content) };
                        } catch {
                            return { type: 'text', data: content };
                        }
                    }
                }, (service, parsed) => {
                    // Store the parsed data in the service's config map
                    // The service parameter is the actual service instance
                    (service as any).configs.set('content', parsed);
                });
                
                const configService = configServiceFactory();
                const config = await configService.getConfig();
                
                // Get the source after loading
                const sourceUsed = (configService as any).getLastLoadSource?.() || 'unknown';
                console.log('Source used for loading:', sourceUsed);
                console.log('ConfigService type:', configService.constructor.name);
                console.log('Has getLastLoadSource method?', typeof (configService as any).getLastLoadSource);
                
                if (config === null || config === undefined) {
                    // This means both sources failed - provide helpful information
                    result = {
                        success: false,
                        error: 'Configuration not found in any source',
                        metadata: {
                            dbEnabled: database ? true : false,
                            note: database 
                                ? 'Both GitHub and database sources failed. Check console logs for details.' 
                                : 'GitHub source failed and no database fallback configured.',
                            hint: 'The library attempted all configured sources in priority order. See console for fallback behavior.'
                        }
                    };
                } else {
                    // Get the content we stored
                    const content = await configService.getConfig('content');
                    
                    result = {
                        success: true,
                        asset: content.type === 'json' ? JSON.stringify(content.data, null, 2) : content.data,
                        metadata: {
                            type: content.type,
                            source: 'config-service',
                            actualSource: sourceUsed,
                            dbEnabled: database ? true : false,
                            note: database 
                                ? `Asset loaded from ${sourceUsed === 'database' ? 'DATABASE (GitHub failed)' : 'GITHUB (cached to database)'}. GitHub is primary, database is fallback.`
                                : 'No database configured - GitHub only'
                        }
                    };
                }
                break;


            default:
                throw new Error('Invalid test mode selected');
        }

        // Close database connection if opened
        if (database) {
            await database.close();
        }

        res.json(result);

    } catch (error: any) {
        console.error('Test error:', error);
        
        const errorResponse = {
            success: false,
            error: error.message,
            errorType: error.name || 'Error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: {}
        };

        if (error.message.includes('Database')) {
            errorResponse.errorType = 'DatabaseError';
            errorResponse.details = {
                hint: 'Ensure PostgreSQL is running and the connection string is correct.',
                format: 'postgresql://user:password@host:port/database'
            };
        } else if (error.message.includes('GitHub')) {
            errorResponse.errorType = 'GitHubError';
            errorResponse.details = {
                hint: 'Check your GitHub token has the necessary permissions and the repository exists.',
                requiredScopes: ['repo']
            };
        } else if (error.message.includes('Missing required')) {
            errorResponse.errorType = 'ValidationError';
            errorResponse.details = {
                hint: 'All fields marked as required must be filled in.'
            };
        }

        res.status(400).json(errorResponse);
    }
});

app.listen(PORT, () => {
    console.log(`Config tester server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to test the library`);
});