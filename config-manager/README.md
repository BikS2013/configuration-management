# Configuration Manager

A robust, enterprise-grade configuration management library for TypeScript/Node.js applications with GitHub asset retrieval, PostgreSQL storage, and multi-source fallback patterns.

## Overview

This monorepo contains three integrated packages that work together to provide a complete configuration management solution:

- **`@biks2013/github-asset-client`** - GitHub API integration for retrieving configuration assets
- **`@biks2013/asset-database`** - PostgreSQL storage with version history and audit logging
- **`@biks2013/config-service`** - Configuration service with multi-source fallback pattern

## Features

- 🔄 **GitHub-first with database fallback** - Always fetches latest from GitHub, falls back to cached version if unavailable
- 💾 **Automatic caching** - Configurations fetched from GitHub are automatically cached to database
- 📝 **Version history** - Full audit trail of configuration changes
- 🔒 **Type safety** - Full TypeScript support with generics
- 🔁 **Retry logic** - Exponential backoff for transient failures
- 🛡️ **Resilient operation** - Continues working even when GitHub is down

## Installation

```bash
npm install @biks2013/config-manager
```

Or install individual packages:

```bash
npm install @biks2013/github-asset-client
npm install @biks2013/asset-database
npm install @biks2013/config-service
```

## Quick Start

```typescript
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import { createConfigService } from '@biks2013/config-service';
import * as YAML from 'yaml';

// Define your configuration interface
interface AppConfig {
  database: {
    host: string;
    port: number;
  };
  api: {
    timeout: number;
  };
}

// Create the service
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
  // Process configuration - handled internally
});

// Use the service
const service = configService();
const dbHost = await service.getConfig('database.host');

// Handle null case when config not found
if (dbHost === null) {
  console.log('Configuration not found - GitHub unavailable and no cached version');
}
```

## Architecture

### Configuration Loading Strategy

```
┌──────────────┐
│   Request    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     Success      ┌─────────────────┐
│    GitHub    │ ───────────────> │  Auto-cache to  │
│   (Primary)  │                  │    Database     │
└──────┬───────┘                  └─────────────────┘
       │
       │ Failure
       ▼
┌──────────────┐
│   Database   │ ───────────────> Returns cached config
│  (Fallback)  │
└──────┬───────┘
       │
       │ Not found
       ▼
  Returns null
```

**Key Points:**
- GitHub is always tried first for latest configuration
- Database is only used when GitHub is unavailable
- Successful GitHub fetches are automatically cached
- Provides resilience during GitHub outages

### Database Schema

The asset database uses two tables:

- `asset` - Current configuration values
- `asset_log` - Complete history of all changes

## Advanced Usage

### Custom Configuration Service

```typescript
class AgentConfigService extends ConfigService<AgentConfig[]> {
  private agents = new Map<string, AgentConfig>();

  protected processConfiguration(data: AgentConfig[]): void {
    this.agents.clear();
    for (const agent of data) {
      this.agents.set(agent.name, agent);
    }
  }

  async getAgent(name: string): Promise<AgentConfig | undefined> {
    await this.ensureInitialized();
    return this.agents.get(name);
  }
}
```

### Prompt Template Service

See `examples/prompt-template-service.ts` for a complete implementation of a markdown-based prompt template service.

## API Reference

### GitHubAssetClient

```typescript
class GitHubAssetClient {
  constructor(options: GitHubAssetClientOptions);
  
  // Retrieve a single asset
  async getAsset(path: string): Promise<AssetResponse>;
  
  // List directory contents
  async listAssets(directory?: string): Promise<GitHubDirectoryItem[]>;
  
  // Search for assets
  async searchAssets(query: string): Promise<SearchResult[]>;
  
  // Clear the cache
  clearCache(): void;
}
```

### AssetDatabaseService

```typescript
class AssetDatabaseService {
  constructor(options: AssetDatabaseOptions);
  
  // Get an asset by key
  async getAsset(key: string, category?: string): Promise<AssetRecord | null>;
  
  // Store an asset
  async storeAsset(key: string, content: string, category?: string): Promise<void>;
  
  // List all assets
  async listAssets(category?: string): Promise<AssetMetadata[]>;
  
  // Get asset history
  async getAssetHistory(key: string): Promise<AssetHistoryRecord[]>;
  
  // Ensure database schema exists
  async ensureSchema(): Promise<void>;
}
```

### ConfigService

```typescript
interface ConfigServiceOptions<T> {
  sources: ConfigSource[];
  parser: (content: string) => T | Promise<T>;
  environmentPrefix?: string;
  watchForChanges?: boolean;
}

function createConfigService<T>(
  options: ConfigServiceOptions<T>,
  processor: (service: ConfigService<T>, data: T) => void
): () => ConfigService<T>;
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test

# Run linting
npm run lint

# Type checking
npm run typecheck

# Clean build artifacts
npm run clean

# Publish all packages to npm
npm run publish:all
```

### Project Structure

```
config-manager/
├── packages/
│   ├── github-asset-client/
│   ├── asset-database/
│   └── config-service/
├── examples/
├── docs/
└── package.json
```

## Security Considerations

- Never log or expose tokens
- Use environment variables for sensitive data
- Enable SSL for database connections
- Validate all configuration data
- Implement proper access controls

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request