# @biks2013/config-service

Configuration service with multi-source fallback pattern, type safety, and hot reload support.

## Installation

```bash
npm install @biks2013/config-service
```

## Features

- 🔄 GitHub-first configuration with automatic database fallback
- 📦 Support for GitHub (primary) and Database (fallback) sources
- 🔒 Type-safe configuration with TypeScript generics
- 💾 Automatic caching from GitHub to Database
- 🏗️ Extensible architecture for custom configuration services
- 🚫 Returns null when configuration not found in any source
- 🛡️ Resilient operation when GitHub is unavailable

## Usage

### Basic Example

```typescript
import { createConfigService } from '@biks2013/config-service';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import * as YAML from 'yaml';

interface AppConfig {
  database: {
    host: string;
    port: number;
  };
  features: {
    enableCache: boolean;
  };
}

const configService = createConfigService<AppConfig>({
  sources: [
    {
      type: 'github',
      priority: 1,  // Primary source - always tried first
      options: {
        client: new GitHubAssetClient({
          repo: 'org/config-repo',
          token: process.env.GITHUB_TOKEN!,
        }),
        assetKey: 'config/app.yaml',
      },
    },
    {
      type: 'database',
      priority: 2,  // Fallback - only used if GitHub fails
      options: {
        service: new AssetDatabaseService({
          connectionString: process.env.DATABASE_URL!,
          ownerCategory: 'app',
          ownerKey: 'my-app',
        }),
        assetKey: 'app-config',
      },
    },
  ],
  parser: async (content) => YAML.parse(content),
}, (service, data) => {
  // Process the parsed configuration
  // Note: configs is protected, processing handled internally
});

// Use the service
const service = configService();

// Get specific config values
const dbHost = await service.getConfig('database.host');
if (dbHost === null) {
  console.log('Configuration not found - GitHub unavailable and no cached version in database');
  return;
}

const cacheEnabled = await service.getConfig('features.enableCache');

// Get all configuration
const allConfig = await service.getAll();

// Reload configuration
await service.reload();

// Clean up
await service.destroy();
```

### Custom Configuration Service

```typescript
import { ConfigService, createConfigService } from '@biks2013/config-service';

interface UserPermissions {
  userId: string;
  permissions: string[];
}

class PermissionService extends ConfigService<UserPermissions[]> {
  private permissions = new Map<string, string[]>();

  protected processConfiguration(data: UserPermissions[]): void {
    this.permissions.clear();
    for (const user of data) {
      this.permissions.set(user.userId, user.permissions);
    }
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    await this.ensureInitialized();
    return this.permissions.get(userId) || [];
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }
}
```

## Configuration Sources

### GitHub Source

```typescript
{
  type: 'github',
  priority: 1,
  options: {
    client: GitHubAssetClient,
    assetKey: 'path/to/config.yaml'
  }
}
```

### Database Source

```typescript
{
  type: 'database',
  priority: 2,
  options: {
    service: AssetDatabaseService,
    assetKey: 'config-key',
    category: 'optional-category'
  }
}
```



## API

### `createConfigService<T>(options, processor)`

Creates a singleton configuration service instance.

#### Options

```typescript
interface ConfigServiceOptions<T> {
  sources: ConfigSource[];           // Configuration sources with priorities
  parser: (content: string) => T;    // Parser function (e.g., JSON.parse, YAML.parse)
  verbose?: boolean;                 // Enable detailed logging (default: false)
}
```

#### Processor Function

```typescript
type ConfigProcessor<T> = (service: ConfigService<T>, data: T) => void;
```

### ConfigService Methods

- `getConfig(key?: string): Promise<any>` - Get configuration value by key (returns null if not found)
- `getAll(): Promise<Map<string, any>>` - Get all configuration values
- `reload(): Promise<void>` - Reload configuration from sources
- `destroy(): Promise<void>` - Clean up resources

## Configuration Loading Strategy

The service follows a GitHub-first approach with database fallback:

1. **Primary Source (GitHub)**: Always attempted first
   - Fetches latest configuration from GitHub repository
   - On success: Automatically caches to database for future fallback
   - On failure: Falls back to database cache

2. **Fallback Source (Database)**: Only used when GitHub is unavailable
   - Provides resilience during GitHub outages
   - Contains previously cached configurations
   - Never accessed directly unless GitHub fails

3. **Returns `null`**: When configuration not found in any source

This ensures you always get the latest configuration when possible, with automatic failover for reliability.

## Verbose Logging

Enable verbose mode to get detailed insights into the configuration loading process:

```typescript
const configService = createConfigService<AppConfig>({
  sources: [...],
  parser: YAML.parse,
  verbose: true  // Enable verbose logging
}, processor);
```

When verbose mode is enabled, you'll see:

1. **GitHub Reads**: Detailed information about assets read from GitHub
   - Asset path being read
   - File size and SHA
   - Content preview

2. **Database Operations**: 
   - Asset registration logs
   - Content length and creation timestamps
   - **Difference Detection**: Automatic comparison between GitHub and cached versions

3. **Fallback Behavior**: Clear logs showing which source was attempted and why it failed

Example verbose output:
```
[ConfigService] Starting configuration reload...
[GitHub] Reading asset from path: config/app.yaml
[GitHub] Successfully read asset 'config/app.yaml':
[GitHub]   - Size: 1234 bytes
[GitHub]   - SHA: abc123def456...
[GitHub]   - Content preview: database:\n  host: localhost\n  port: 5432\n...
[Database] Registering asset 'app-config' in database
[Database] DIFFERENCE DETECTED: Content from GitHub differs from database cache
[Database]   - Previous length: 1200 bytes
[Database]   - New length: 1234 bytes
[Database] Successfully registered asset 'app-config' in database
[ConfigService] Configuration loaded successfully from github:config/app.yaml
```

This is especially useful for:
- Debugging configuration issues
- Monitoring configuration changes
- Understanding fallback behavior
- Tracking cache updates

## License

MIT