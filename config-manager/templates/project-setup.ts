// Template for setting up config-manager in a new project

import { GitHubAssetClient } from '@giorgosmarinos/github-asset-client';
import { AssetDatabaseService } from '@giorgosmarinos/asset-database';
import { createConfigService, ConfigService } from '@giorgosmarinos/config-service';

// Define your configuration interface
interface ProjectConfig {
  // Add your configuration structure here
  app: {
    name: string;
    version: string;
    environment: string;
  };
  database: {
    host: string;
    port: number;
    name: string;
  };
  // Add more configuration sections as needed
}

// Create a singleton instance
let configInstance: ConfigService<ProjectConfig> | null = null;

export function initializeConfig() {
  if (configInstance) {
    return configInstance;
  }

  const serviceFactory = createConfigService<ProjectConfig>({
    sources: [
      {
        type: 'github',
        priority: 1,
        options: {
          client: new GitHubAssetClient({
            repo: process.env.CONFIG_REPO || 'your-org/config-repo',
            token: process.env.GITHUB_TOKEN!,
            branch: process.env.CONFIG_BRANCH || 'main',
            cacheEnabled: true,
            cacheTTL: 300000, // 5 minutes
          }),
          assetKey: `config/${process.env.NODE_ENV || 'development'}.json`,
        },
      },
      {
        type: 'database',
        priority: 2,
        options: {
          service: new AssetDatabaseService({
            connectionString: process.env.DATABASE_URL!,
            ownerCategory: process.env.APP_NAME || 'app',
            ownerKey: process.env.NODE_ENV || 'development',
            ssl: process.env.NODE_ENV === 'production',
          }),
          assetKey: 'app-config',
          category: 'config',
        },
      },
    ],
    parser: async (content) => JSON.parse(content),
  }, (service, data) => {
    // Process the configuration
    for (const [key, value] of Object.entries(data)) {
      service.configs.set(key, value);
    }
  });

  configInstance = serviceFactory();
  return configInstance;
}

// Helper function to get config with proper error handling
export async function getConfig<K extends keyof ProjectConfig>(
  key: K
): Promise<ProjectConfig[K] | null> {
  const config = initializeConfig();
  const value = await config.getConfig(key as string);
  return value as ProjectConfig[K] | null;
}

// Helper to get nested config values
export async function getConfigValue(path: string): Promise<any> {
  const config = initializeConfig();
  return await config.getConfig(path);
}

// Export for direct access if needed
export const config = {
  get: getConfig,
  getValue: getConfigValue,
  reload: async () => {
    const instance = initializeConfig();
    await instance.reload();
  },
  getInstance: initializeConfig,
};