# @biks2013/config-service

Configuration service with multi-source fallback pattern, type safety, and hot reload support.

## Installation

```bash
npm install @biks2013/config-service
```

## Features

- 🔄 Multi-source configuration with priority-based fallback
- 📦 Support for GitHub and Database sources
- 🔒 Type-safe configuration with TypeScript generics
- 💾 Automatic caching from GitHub to Database
- 🏗️ Extensible architecture for custom configuration services
- 🚫 Returns null when configuration not found in any source

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
      priority: 1,
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
      priority: 2,
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
  service.configs.set('database', data.database);
  service.configs.set('features', data.features);
});

// Use the service
const service = configService();

// Get specific config values
const dbHost = await service.getConfig('database.host');
if (dbHost === null) {
  console.log('Configuration not found in GitHub or Database');
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

## Fallback Strategy

Sources are tried in priority order (lowest number = highest priority):

1. Memory cache (if available)
2. GitHub source (priority 1)
3. Database source (priority 2)
4. Returns `null` if not found in any source

When configuration is loaded from GitHub, it's automatically cached to the database source (if available).

## License

MIT