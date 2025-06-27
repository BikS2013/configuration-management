# Configuration Service Pattern

This document describes the standard pattern for implementing configuration services using the @biks2013/config-service library, following the GitHub-first, database-fallback approach.

## Overview

This pattern provides a consistent way to implement configuration services that:
- Retrieve configuration files from a GitHub repository (primary source)
- Fall back to PostgreSQL database cache when GitHub is unavailable
- Maintain automatic synchronization between sources
- Support multiple configuration formats (JSON, YAML, XML, etc.)
- Provide type safety and verbose logging options

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Application   │────▶│  ConfigService   │────▶│  GitHub Client  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               │                           ▼
                               │                  ┌─────────────────┐
                               └─────────────────▶│    Database     │
                                                  └─────────────────┘
```

## Core Implementation

### Using the ConfigService Factory

```typescript
import { createConfigService } from '@biks2013/config-service';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';

// Initialize clients
const githubClient = new GitHubAssetClient({
  repo: process.env.GITHUB_REPO || 'myorg/config-repo',
  token: process.env.GITHUB_TOKEN!,
  branch: process.env.GITHUB_BRANCH || 'main',
  cacheEnabled: true,
  cacheTTL: 300000 // 5 minutes
});

const database = new AssetDatabaseService({
  connectionString: process.env.DATABASE_URL!,
  ownerCategory: 'config-service',
  ownerKey: process.env.SERVICE_NAME || 'my-app',
  verbose: process.env.CONFIG_VERBOSE === 'true'
});

// Create service
const configServiceFactory = createConfigService({
  sources: [
    {
      type: 'github',
      priority: 1,  // Primary source
      options: {
        client: githubClient,
        assetKey: process.env.CONFIG_PATH || 'config/app.json'
      }
    },
    {
      type: 'database',
      priority: 2,  // Fallback source
      options: {
        service: database,
        assetKey: process.env.CONFIG_KEY || 'app-config',
        category: 'configuration'
      }
    }
  ],
  parser: async (content) => JSON.parse(content),
  verbose: process.env.CONFIG_VERBOSE === 'true'
}, (service, data) => {
  // Process parsed configuration
  service.configs.set('content', data);
});

// Get singleton instance
const configService = configServiceFactory();
```

## Implementation Examples

### Example 1: Feature Flags Service

```typescript
// feature-flags.service.ts
import yaml from 'js-yaml';
import { createConfigService } from '@biks2013/config-service';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';

interface FeatureFlags {
  flags: Array<{
    name: string;
    enabled: boolean;
    description?: string;
    rolloutPercentage?: number;
  }>;
}

// Initialize clients (reuse from above or create new)
const githubClient = new GitHubAssetClient({
  repo: process.env.GITHUB_REPO!,
  token: process.env.GITHUB_TOKEN!,
});

const database = new AssetDatabaseService({
  connectionString: process.env.DATABASE_URL!,
  ownerCategory: 'feature-flags',
  ownerKey: process.env.SERVICE_NAME!,
});

export const getFeatureFlagsService = createConfigService<FeatureFlags>({
  sources: [
    {
      type: 'github',
      priority: 1,
      options: {
        client: githubClient,
        assetKey: process.env.FEATURE_FLAGS_ASSET_KEY || 'settings/feature-flags.yaml'
      }
    },
    {
      type: 'database',
      priority: 2,
      options: {
        service: database,
        assetKey: 'feature-flags',
        category: 'configuration'
      }
    }
  ],
  parser: async (content) => yaml.load(content) as FeatureFlags,
  verbose: true
});

// Usage in routes
router.get('/flags', async (req, res) => {
  const service = getFeatureFlagsService();
  const config = await service.getConfig('content');
  if (config) {
    res.json({ flags: config.flags });
  } else {
    res.status(503).json({ error: 'Feature flags not available' });
  }
});

// Check specific flag
async function isFeatureEnabled(flagName: string): Promise<boolean> {
  const service = getFeatureFlagsService();
  const config = await service.getConfig('content');
  if (!config) return false;
  
  const flag = config.flags.find(f => f.name === flagName);
  return flag?.enabled || false;
}
```

### Example 2: API Rate Limits Service

```typescript
// api-limits.service.ts
import { createConfigService } from '@biks2013/config-service';

interface ApiLimits {
  limits: Array<{
    endpoint: string;
    rateLimit: number;
    window: string;
    burst?: number;
  }>;
  globalLimit?: {
    requests: number;
    window: string;
  };
}

export const getApiLimitsService = createConfigService<ApiLimits>({
  sources: [
    {
      type: 'github',
      priority: 1,
      options: {
        client: githubClient,
        assetKey: process.env.API_LIMITS_ASSET_KEY || 'settings/api-limits.json'
      }
    },
    {
      type: 'database',
      priority: 2,
      options: {
        service: database,
        assetKey: 'api-limits',
        category: 'configuration'
      }
    }
  ],
  parser: async (content) => JSON.parse(content) as ApiLimits,
  verbose: true
});

// Rate limit middleware
export const rateLimitMiddleware = async (req, res, next) => {
  const service = getApiLimitsService();
  const config = await service.getConfig('content');
  
  if (!config) {
    // Apply default limits if config unavailable
    return next();
  }
  
  const limit = config.limits.find(l => 
    req.path.startsWith(l.endpoint)
  );
  
  if (limit) {
    // Apply rate limiting logic
    req.rateLimit = limit;
  }
  
  next();
};
```

### Example 3: Custom ConfigService Extension

```typescript
// custom-config.service.ts
import { ConfigService } from '@biks2013/config-service';
import xml2js from 'xml2js';

interface CustomConfig {
  settings: {
    items: Array<{ id: string; value: any; type: string }>;
  };
}

class CustomConfigService extends ConfigService<CustomConfig> {
  // Add custom methods
  async getByType(type: string): Promise<any[]> {
    await this.ensureInitialized();
    const config = await this.getConfig('content');
    if (!config) return [];
    
    return config.settings.items
      .filter(item => item.type === type)
      .map(item => item.value);
  }
  
  async getSettingValue(id: string): Promise<any> {
    await this.ensureInitialized();
    const config = await this.getConfig('content');
    if (!config) return null;
    
    const item = config.settings.items.find(i => i.id === id);
    return item?.value || null;
  }
}

// Create factory with custom class
function createCustomConfigService() {
  let instance: CustomConfigService | null = null;
  
  return () => {
    if (!instance) {
      instance = new CustomConfigService({
        sources: [
          {
            type: 'github',
            priority: 1,
            options: {
              client: githubClient,
              assetKey: process.env.CUSTOM_CONFIG_ASSET_KEY || 'settings/custom.xml'
            }
          },
          {
            type: 'database',
            priority: 2,
            options: {
              service: database,
              assetKey: 'custom-config',
              category: 'configuration'
            }
          }
        ],
        parser: async (content) => {
          const parser = new xml2js.Parser();
          return await parser.parseStringPromise(content);
        }
      }, (service, data) => {
        service.configs.set('content', data);
      });
    }
    return instance;
  };
}

export const getCustomConfigService = createCustomConfigService();
```

## Environment Variables

Each configuration service should use environment variables for flexibility:

```bash
# GitHub Configuration
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_REPO=myorg/config-repo
GITHUB_BRANCH=main

# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
SERVICE_NAME=my-app

# Service-specific Asset Keys
FEATURE_FLAGS_ASSET_KEY=settings/feature-flags.yaml
API_LIMITS_ASSET_KEY=settings/api-limits.json
CUSTOM_CONFIG_ASSET_KEY=settings/custom.xml

# Logging
CONFIG_VERBOSE=true
DATABASE_VERBOSE=true
```

## Key Design Principles

1. **GitHub-First, Database-Fallback**: Always attempts GitHub first, falls back to database cache for resilience

2. **Automatic Caching**: When GitHub succeeds, content is automatically cached to database

3. **Priority-Based Loading**: Sources are tried in priority order (1 = highest)

4. **Type Safety**: Full TypeScript support with generic types

5. **Singleton Pattern**: Each configuration service is a singleton via factory function

6. **Parser Injection**: Support for any file format through parser functions

7. **Verbose Logging**: Detailed logs for debugging when enabled

8. **Lazy Initialization**: Configuration loaded only when first accessed

## Benefits

- **High Availability**: Database fallback ensures service continues during GitHub outages
- **Version Control**: All configurations tracked in Git
- **Audit Trail**: Database maintains version history
- **Performance**: In-memory caching reduces API calls
- **Type Safety**: TypeScript interfaces for all configurations
- **Flexibility**: Support for JSON, YAML, XML, or custom formats
- **Hot Reload**: `reload()` method for configuration updates without restart
- **Minimal Dependencies**: Only requires the three @biks2013 packages

## Usage Guidelines

### 1. Initialize Clients Once

```typescript
// config-clients.ts
export const githubClient = new GitHubAssetClient({
  repo: process.env.GITHUB_REPO!,
  token: process.env.GITHUB_TOKEN!,
  branch: process.env.GITHUB_BRANCH || 'main',
  cacheEnabled: true,
  cacheTTL: 300000
});

export const database = new AssetDatabaseService({
  connectionString: process.env.DATABASE_URL!,
  ownerCategory: 'config-service',
  ownerKey: process.env.SERVICE_NAME!,
  verbose: process.env.DATABASE_VERBOSE === 'true'
});

// Ensure database schema on startup
await database.ensureSchema();
```

### 2. Error Handling

```typescript
try {
  const service = getConfigService();
  const config = await service.getConfig();
  
  if (!config) {
    // Both sources failed
    logger.error('Configuration not available from any source');
    // Use defaults or fail gracefully
  }
} catch (error) {
  logger.error('Configuration loading error:', error);
  // Handle initialization errors
}
```

### 3. Configuration Validation

```typescript
const configServiceFactory = createConfigService({
  sources: [...],
  parser: async (content) => {
    const config = JSON.parse(content);
    
    // Validate schema
    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Invalid configuration: ${error.message}`);
    }
    
    return value;
  },
  verbose: true
});
```

### 4. Refresh Strategy

```typescript
// Periodic refresh
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

setInterval(async () => {
  try {
    const service = getConfigService();
    await service.reload();
    logger.info('Configuration refreshed successfully');
  } catch (error) {
    logger.error('Configuration refresh failed:', error);
    // Continue using cached configuration
  }
}, REFRESH_INTERVAL);

// Event-based refresh
eventEmitter.on('config-update', async () => {
  const service = getConfigService();
  await service.reload();
});

// Manual refresh endpoint
router.post('/admin/refresh-config', authenticate, async (req, res) => {
  const service = getConfigService();
  await service.reload();
  res.json({ message: 'Configuration refreshed' });
});
```

### 5. Testing

```typescript
// test/config.test.ts
import { createConfigService } from '@biks2013/config-service';

describe('ConfigService', () => {
  it('should load configuration', async () => {
    const mockConfig = {
      version: '1.0.0',
      features: { cache: true }
    };
    
    const service = createConfigService({
      sources: [
        {
          type: 'custom',
          priority: 1,
          options: {
            load: async () => JSON.stringify(mockConfig)
          }
        }
      ],
      parser: async (content) => JSON.parse(content)
    })();
    
    const config = await service.getConfig();
    expect(config).toEqual(mockConfig);
  });
});
```

## Migration from Direct File Access

To migrate existing configuration files to this pattern:

1. **Upload Configuration Files**: Add files to your GitHub configuration repository
2. **Create Type Interfaces**: Define TypeScript interfaces for your configurations
3. **Set Up Clients**: Initialize GitHub and database clients
4. **Create Services**: Use `createConfigService` factory for each configuration
5. **Replace File Reads**: Update code to use service methods instead of direct file access
6. **Add Environment Variables**: Configure asset keys and connection strings
7. **Test Fallback**: Verify database fallback works when GitHub is unavailable

## Best Practices

1. **Logging**: Use verbose mode in development, monitor failures in production
2. **Validation**: Always validate configuration structure after parsing
3. **Defaults**: Provide sensible defaults for missing configurations
4. **Documentation**: Document expected configuration structure with examples
5. **Security**: Never store secrets in configuration files - use environment variables
6. **Monitoring**: Track configuration loading failures and response times
7. **Caching**: Configure appropriate TTL for GitHub client cache
8. **Database Maintenance**: Periodically clean old configuration versions

## Verbose Mode Output

When verbose mode is enabled, you'll see detailed logs:

```
🌐 [GitHub] Reading asset from path: config/app.json
✅ [GitHub] Successfully read asset 'config/app.json':
   📦 Size: 1234 bytes
   🔑 SHA: abc123def456...
   👁️ Preview: {"version":"1.0.0","features":{"api":true...

💾 [Database] Registering asset 'app-config' in database
================================================================================
🔔 [Database] ⚠️  DIFFERENCE DETECTED ⚠️
================================================================================
📝 Content from GitHub differs from database cache!
📏 Previous length: 1200 bytes
📏 New length: 1234 bytes
📊 Size difference: 34 bytes

📈 Content similarity: 95.2%
================================================================================

✅ [Database] Successfully registered asset 'app-config' in database
[ConfigService] Configuration loaded successfully from github:config/app.json
```

## Troubleshooting

### GitHub Connection Issues

```typescript
// Test GitHub connectivity
try {
  const asset = await githubClient.getAsset('README.md');
  console.log('GitHub connection successful');
} catch (error) {
  console.error('GitHub connection failed:', error);
  // Check token permissions, network, rate limits
}
```

### Database Connection Issues

```typescript
// Test database connectivity
try {
  await database.ensureSchema();
  console.log('Database connection successful');
} catch (error) {
  console.error('Database connection failed:', error);
  // Check connection string, PostgreSQL status
}
```

### Configuration Not Loading

1. Enable verbose mode to see detailed logs
2. Check environment variables are set correctly
3. Verify file exists in GitHub repository
4. Ensure database has proper permissions
5. Check for parser errors in configuration format

## Summary

The @biks2013 configuration service pattern provides:

- **Resilient Configuration Management**: GitHub primary, database fallback
- **Automatic Synchronization**: Changes cached from GitHub to database
- **Type-Safe Access**: Full TypeScript support
- **Flexible Formats**: Support for any configuration format
- **Production Ready**: Built-in error handling and logging
- **Easy Testing**: Works with local files for development

This pattern ensures your applications have reliable access to configuration with automatic failover and comprehensive logging.