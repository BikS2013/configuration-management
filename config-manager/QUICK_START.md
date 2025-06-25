# Quick Start Guide - Using Config Manager in Your Projects

## Installation Options

### 1. Via npm (After Publishing)

```bash
# Install all packages
npm install @biks2013/config-manager

# Or install individual packages
npm install @biks2013/github-asset-client
npm install @biks2013/asset-database
npm install @biks2013/config-service
```

### 2. Via GitHub (Direct from Repository)

```bash
# Install from GitHub
npm install git+https://github.com/giorgosmarinos/config-manager.git

# Install specific version
npm install git+https://github.com/giorgosmarinos/config-manager.git#v1.0.0
```

### 3. Via Local Link (For Development)

```bash
# In the config-manager directory
./scripts/link-local.sh

# In your project directory
npm link @biks2013/github-asset-client @biks2013/asset-database @biks2013/config-service
```

## Basic Setup in Your Project

### 1. Create Configuration Structure

```typescript
// src/config/index.ts
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';
import { createConfigService } from '@biks2013/config-service';

interface AppConfig {
  // Your configuration structure
  api: {
    port: number;
    host: string;
  };
  database: {
    connectionString: string;
  };
}

export const configService = createConfigService<AppConfig>({
  sources: [
    {
      type: 'github',
      priority: 1,
      options: {
        client: new GitHubAssetClient({
          repo: process.env.CONFIG_REPO!,
          token: process.env.GITHUB_TOKEN!,
        }),
        assetKey: 'config/app.json',
      },
    },
    {
      type: 'database',
      priority: 2,
      options: {
        service: new AssetDatabaseService({
          connectionString: process.env.DATABASE_URL!,
          ownerCategory: 'app',
          ownerKey: process.env.APP_NAME!,
        }),
        assetKey: 'config',
      },
    },
  ],
  parser: async (content) => JSON.parse(content),
}, (service, data) => {
  service.configs.set('api', data.api);
  service.configs.set('database', data.database);
});
```

### 2. Set Environment Variables

```bash
# .env
CONFIG_REPO=myorg/config-repo
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
APP_NAME=my-app
```

### 3. Use in Your Application

```typescript
// src/app.ts
import { configService } from './config';

async function startApp() {
  const service = configService();
  
  // Get configuration
  const apiConfig = await service.getConfig('api');
  if (!apiConfig) {
    console.error('Configuration not found!');
    process.exit(1);
  }
  
  // Use the configuration
  const port = apiConfig.port;
  const host = apiConfig.host;
  
  // Start your application
  app.listen(port, host, () => {
    console.log(`Server running on ${host}:${port}`);
  });
}

startApp();
```

## Advanced Usage

### Custom Configuration Service

```typescript
// Copy from templates/project-setup.ts and customize for your needs
import { config } from './config/project-setup';

// Use type-safe config access
const dbConfig = await config.get('database');
if (dbConfig) {
  connectToDatabase(dbConfig.connectionString);
}
```

### Multiple Environments

```typescript
// Use different config files per environment
assetKey: `config/${process.env.NODE_ENV}.json`,

// GitHub repo structure:
// config/
//   ├── development.json
//   ├── staging.json
//   └── production.json
```

### Automatic Database Schema Setup

```typescript
// Run once to set up database tables
const dbService = new AssetDatabaseService({
  connectionString: process.env.DATABASE_URL!,
  ownerCategory: 'system',
  ownerKey: 'setup',
});

await dbService.ensureSchema();
```

## Publishing Your Own Version

### 1. Fork and Customize

```bash
# Fork the repository
gh repo fork giorgosmarinos/config-manager --clone

# Make your changes
cd config-manager
# ... make changes ...

# Update package names
find . -name "package.json" -exec sed -i '' 's/@biks2013/@yourscope/g' {} \;
```

### 2. Publish to npm

```bash
# Build
npm run build

# Publish all packages
npm login
npm run publish:all

# Alternative: Publish manually
cd packages/github-asset-client && npm publish --access public
cd ../asset-database && npm publish --access public
cd ../config-service && npm publish --access public
```

### 3. Use in Projects

```bash
npm install @yourscope/config-manager
```

## Best Practices

1. **Store Sensitive Config in GitHub Private Repos**
   - Use a dedicated private repository for configuration
   - Implement proper access controls

2. **Use Database as Cache**
   - Database acts as a fallback when GitHub is unavailable
   - Automatically caches GitHub content

3. **Handle Null Cases**
   ```typescript
   const config = await service.getConfig('key');
   if (!config) {
     // Handle missing configuration
     throw new Error('Required configuration not found');
   }
   ```

4. **Environment-Specific Configs**
   - Use different config files for different environments
   - Structure: `config/{environment}.json`

5. **Version Your Configurations**
   - Tag configuration changes in GitHub
   - Track configuration history in database

## Troubleshooting

### Configuration Not Found

1. Check GitHub token has access to the repository
2. Verify the asset path exists in the repository
3. Check database connection string
4. Ensure database schema is created

### Type Errors

1. Ensure your configuration interface matches the actual data
2. Use proper TypeScript types
3. Handle null returns appropriately

### Performance Issues

1. Adjust cache TTL for GitHub client
2. Use database connection pooling
3. Consider configuration size and structure