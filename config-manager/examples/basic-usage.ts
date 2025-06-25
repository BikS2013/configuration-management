import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import { createConfigService } from '@biks2013/config-service';
import * as YAML from 'yaml';

// Example configuration interface
interface AppConfig {
  database: {
    host: string;
    port: number;
    name: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
  };
  features: {
    enableCache: boolean;
    maxRetries: number;
  };
}

async function main() {
  // Create an integrated configuration service
  const configService = createConfigService<AppConfig>({
    sources: [
      {
        type: 'github',
        priority: 1,
        options: {
          client: new GitHubAssetClient({
            repo: 'org/config-repo',
            token: process.env.GITHUB_TOKEN!,
            branch: 'main',
            cacheEnabled: true,
            cacheTTL: 300000, // 5 minutes
          }),
          assetKey: 'config/app-config.yaml',
        },
      },
      {
        type: 'database',
        priority: 2,
        options: {
          service: new AssetDatabaseService({
            connectionString: process.env.DATABASE_URL!,
            ownerCategory: 'application',
            ownerKey: 'my-app',
            ssl: true,
          }),
          assetKey: 'app-config',
          category: 'config',
        },
      },
    ],
    parser: async (content) => YAML.parse(content),
  }, (service, data) => {
    // Process parsed configuration
    service.configs.set('database', data.database);
    service.configs.set('api', data.api);
    service.configs.set('features', data.features);
  });

  // Use the service
  const service = configService();

  // Get specific configuration values
  const dbHost = await service.getConfig('database.host');
  if (dbHost !== null) {
    console.log('Database Host:', dbHost);
  } else {
    console.log('Configuration not found in GitHub or Database');
  }

  const apiTimeout = await service.getConfig('api.timeout');
  console.log('API Timeout:', apiTimeout);

  // Get all configuration
  const allConfig = await service.getAll();
  if (allConfig.size > 0) {
    console.log('All Configuration:', Object.fromEntries(allConfig));
  } else {
    console.log('No configuration available');
  }

  // Handle missing configuration
  const nonExistent = await service.getConfig('non.existent.key');
  console.log('Non-existent key returns:', nonExistent); // Will be undefined

  // Reload configuration
  await service.reload();
  console.log('Configuration reloaded');

  // Clean up
  await service.destroy();
}

// Run the example
main().catch(console.error);