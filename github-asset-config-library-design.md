# GitHub Asset Configuration Library - Design Document

## Overview

This document outlines the design and implementation of a reusable npm/TypeScript library that provides:
1. **GitHub Asset Retrieval** - Fetch configuration assets from GitHub repositories
2. **PostgreSQL Storage** - Store and cache assets in PostgreSQL database
3. **Config Service Pattern** - Implement a robust configuration loading pattern with fallback mechanisms

The library will be designed as a monorepo with three distinct but integrated packages that can be used independently or together.

## Architecture

### Package Structure

```
@your-org/config-manager/
├── packages/
│   ├── github-asset-client/     # GitHub asset retrieval
│   ├── asset-database/          # PostgreSQL storage
│   └── config-service/          # Config service pattern
├── examples/                    # Usage examples
├── docs/                        # Documentation
└── package.json                 # Monorepo root
```

### Core Packages

#### 1. `@your-org/github-asset-client`

**Purpose**: Retrieve assets from GitHub repositories with caching and error handling.

**Features**:
- GitHub API integration with authentication
- In-memory caching with configurable TTL
- Rate limit management
- Directory listing and file retrieval
- Search functionality
- Retry logic with exponential backoff

**Key Classes**:
```typescript
export class GitHubAssetClient {
  constructor(options: GitHubAssetClientOptions);
  async getAsset(path: string): Promise<AssetResponse>;
  async listAssets(directory?: string): Promise<GitHubDirectoryItem[]>;
  async searchAssets(query: string): Promise<SearchResult[]>;
  clearCache(): void;
}

export interface GitHubAssetClientOptions {
  repo: string;
  token: string;
  branch?: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  retryOptions?: RetryOptions;
}
```

#### 2. `@your-org/asset-database`

**Purpose**: Store and retrieve assets in PostgreSQL with version history.

**Features**:
- Asset storage with SHA256 hash tracking
- Version history (audit log)
- Category-based organization
- Connection pooling
- Automatic retry on connection failure
- Support for both Azure and standard PostgreSQL

**Key Classes**:
```typescript
export class AssetDatabaseService {
  constructor(options: AssetDatabaseOptions);
  async getAsset(key: string, category?: string): Promise<AssetRecord | null>;
  async storeAsset(key: string, content: string, category?: string): Promise<void>;
  async listAssets(category?: string): Promise<AssetMetadata[]>;
  async getAssetHistory(key: string): Promise<AssetHistoryRecord[]>;
  async ensureSchema(): Promise<void>;
}

export interface AssetDatabaseOptions {
  connectionString: string;
  ownerCategory: string;
  ownerKey: string;
  ssl?: boolean;
  poolSize?: number;
}
```

**Database Schema**:
```sql
-- Main asset table
CREATE TABLE IF NOT EXISTS public.asset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  owner_category VARCHAR(255) NOT NULL,
  asset_category VARCHAR(255) NOT NULL,
  owner_key VARCHAR(255) NOT NULL,
  asset_key VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  data_hash VARCHAR(64) NOT NULL,
  UNIQUE(owner_key, asset_key)
);

-- Asset history/audit log
CREATE TABLE IF NOT EXISTS public.asset_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.asset(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  owner_category VARCHAR(255) NOT NULL,
  asset_category VARCHAR(255) NOT NULL,
  owner_key VARCHAR(255) NOT NULL,
  asset_key VARCHAR(255) NOT NULL,
  description TEXT,
  data JSONB NOT NULL,
  data_hash VARCHAR(64) NOT NULL
);
```

#### 3. `@your-org/config-service`

**Purpose**: Implement configuration loading pattern with multiple fallback sources.

**Features**:
- Generic configuration service base class
- Multiple source support (GitHub → Database → Local file)
- Lazy initialization
- Singleton pattern support
- Type-safe configuration
- Hot reload capability
- Environment variable override support

**Key Classes**:
```typescript
export abstract class ConfigService<T> {
  constructor(options: ConfigServiceOptions<T>);
  async getConfig(key?: string): Promise<any>;
  async getAll(): Promise<Map<string, any>>;
  async reload(): Promise<void>;
  protected abstract processConfiguration(data: T): void;
}

export interface ConfigServiceOptions<T> {
  sources: ConfigSource[];
  parser: (content: string) => T | Promise<T>;
  environmentPrefix?: string;
  watchForChanges?: boolean;
}

export interface ConfigSource {
  type: 'github' | 'database' | 'file' | 'environment';
  priority: number;
  options: any;
}

// Factory function for creating typed services
export function createConfigService<T>(
  options: ConfigServiceOptions<T>,
  processor: (service: ConfigService<T>, data: T) => void
): () => ConfigService<T>;
```

## Integration Pattern

### Using All Three Packages Together

```typescript
import { GitHubAssetClient } from '@your-org/github-asset-client';
import { AssetDatabaseService } from '@your-org/asset-database';
import { ConfigService, createConfigService } from '@your-org/config-service';

// Create an integrated configuration service
const configService = createConfigService({
  sources: [
    {
      type: 'github',
      priority: 1,
      options: {
        client: new GitHubAssetClient({
          repo: 'org/config-repo',
          token: process.env.GITHUB_TOKEN!,
          branch: 'main'
        }),
        assetKey: 'config/app-config.yaml'
      }
    },
    {
      type: 'database',
      priority: 2,
      options: {
        service: new AssetDatabaseService({
          connectionString: process.env.DATABASE_URL!,
          ownerCategory: 'application',
          ownerKey: 'my-app'
        }),
        assetKey: 'app-config'
      }
    },
    {
      type: 'file',
      priority: 3,
      options: {
        path: './config/local.yaml'
      }
    }
  ],
  parser: async (content) => YAML.parse(content),
  environmentPrefix: 'APP_CONFIG_'
}, (service, data) => {
  // Process parsed configuration
  for (const [key, value] of Object.entries(data)) {
    service.configs.set(key, value);
  }
});

// Use the service
const config = await configService().getConfig('database');
```

## Key Design Patterns

### 1. Fallback Strategy
```
┌─────────────┐     ┌──────────┐     ┌─────────┐     ┌───────────┐
│   Memory    │ --> │  GitHub  │ --> │Database │ --> │Local File │
│   Cache     │     │   Repo   │     │  Cache  │     │ Fallback  │
└─────────────┘     └──────────┘     └─────────┘     └───────────┘
```

### 2. Singleton Pattern with Lazy Initialization
- Services are instantiated once per configuration
- Configuration loaded on first access
- Thread-safe initialization

### 3. Generic Type Safety
- Base classes use TypeScript generics
- Type-safe configuration parsing
- Compile-time type checking

### 4. Environment Override Pattern
```typescript
// Config value: database.host = "prod.db.com"
// Environment: APP_CONFIG_DATABASE_HOST = "dev.db.com"
// Result: "dev.db.com"
```

## Implementation Examples

### Example 1: Agent Configuration Service
```typescript
interface AgentConfig {
  name: string;
  connectionString: string;
  settings: Record<string, any>;
}

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

### Example 2: Prompt Template Service
```typescript
class PromptTemplateService extends ConfigService<string> {
  private templates = new Map<string, string>();

  protected processConfiguration(content: string): void {
    // Parse markdown with frontmatter
    const sections = content.split('---').filter(Boolean);
    for (const section of sections) {
      const lines = section.trim().split('\n');
      const name = lines[0].replace('#', '').trim();
      const template = lines.slice(1).join('\n');
      this.templates.set(name, template);
    }
  }

  async renderTemplate(name: string, vars: Record<string, any>): Promise<string> {
    await this.ensureInitialized();
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template not found: ${name}`);
    
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
  }
}
```

## Error Handling and Resilience

### Retry Logic
```typescript
class RetryableOperation {
  async execute<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries = 3, backoff = 'exponential' } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = backoff === 'exponential' 
          ? Math.pow(2, attempt) * 1000 
          : 1000;
          
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Unreachable');
  }
}
```

### Service Degradation
- If GitHub is unavailable → fall back to database
- If database is unavailable → fall back to local cache
- If all sources fail → use defaults or throw error

## Security Considerations

### 1. Token Management
- Never log tokens
- Use environment variables
- Implement token rotation support
- Mask tokens in error messages

### 2. Access Control
- Repository-level access control via GitHub
- Database row-level security
- API key authentication for service endpoints

### 3. Data Validation
- Validate all configuration data
- Sanitize inputs
- Schema validation for structured configs

## Performance Optimizations

### 1. Caching Strategy
- **Memory Cache**: Sub-second access, configurable TTL
- **Database Cache**: Persistent, survives restarts
- **Cache Invalidation**: Manual and automatic options

### 2. Connection Pooling
- Database connection pooling
- HTTP connection reuse
- Concurrent request limiting

### 3. Lazy Loading
- Load configuration on demand
- Partial loading for large configs
- Stream processing for large files

## Testing Strategy

### Unit Tests
```typescript
describe('GitHubAssetClient', () => {
  it('should retrieve asset from GitHub', async () => {
    const client = new GitHubAssetClient({ 
      repo: 'test/repo',
      token: 'test-token' 
    });
    
    const mockAxios = jest.spyOn(axios, 'get').mockResolvedValue({
      data: { content: Buffer.from('test').toString('base64') }
    });
    
    const result = await client.getAsset('config.json');
    expect(result.content).toBe('test');
  });
});
```

### Integration Tests
- Test fallback mechanisms
- Test database operations
- Test configuration loading

### E2E Tests
- Full configuration lifecycle
- Multi-source integration
- Performance benchmarks

## Package Publishing

### NPM Package Configuration
```json
{
  "name": "@your-org/config-manager",
  "version": "1.0.0",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "publish": "changeset publish"
  }
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Migration Guide

### From Existing Implementation
1. Install packages: `npm install @your-org/config-manager`
2. Replace existing services with library classes
3. Update configuration loading code
4. Test thoroughly with fallback scenarios

### Environment Variables
```bash
# GitHub Configuration
GITHUB_CONFIG_REPO=org/config-repo
GITHUB_CONFIG_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_CONFIG_BRANCH=main

# Database Configuration
ASSET_DB=postgresql://user:pass@host:5432/db
ASSET_OWNER_CLASS=application
ASSET_OWNER_NAME=my-app

# Cache Configuration
ASSET_MEMORY_CACHE_ENABLED=true
ASSET_MEMORY_CACHE_TTL=300
```

## Future Enhancements

### Version 2.0
- **Webhook Support**: Auto-reload on GitHub push
- **Encryption**: At-rest encryption for sensitive configs
- **Multi-Region**: CDN integration for global distribution
- **GraphQL API**: Alternative to REST endpoints

### Version 3.0
- **Config Validation**: JSON Schema validation
- **A/B Testing**: Feature flag integration
- **Monitoring**: Prometheus metrics
- **Admin UI**: Web interface for config management

## Conclusion

This library design provides a robust, scalable, and secure solution for configuration management across TypeScript applications. By separating concerns into three focused packages, teams can adopt the parts they need while maintaining the flexibility to use the full integrated solution when required.

The implementation follows enterprise-grade patterns for reliability, security, and performance while remaining simple enough for small projects to adopt incrementally.