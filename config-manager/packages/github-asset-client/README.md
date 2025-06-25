# @biks2013/github-asset-client

GitHub asset retrieval client with caching and retry logic for configuration management.

## Installation

```bash
npm install @biks2013/github-asset-client
```

## Features

- 🔐 GitHub API authentication
- 💾 In-memory caching with configurable TTL
- 🔁 Automatic retry with exponential backoff
- 📁 Directory listing and file retrieval
- 🔍 Repository search functionality
- ⚡ Rate limit management

## Usage

```typescript
import { GitHubAssetClient } from '@biks2013/github-asset-client';

const client = new GitHubAssetClient({
  repo: 'myorg/config-repo',
  token: process.env.GITHUB_TOKEN!,
  branch: 'main',
  cacheEnabled: true,
  cacheTTL: 300000, // 5 minutes
  retryOptions: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 60000,
  },
});

// Get a single file
const asset = await client.getAsset('config/app.yaml');
console.log(asset.content);

// List directory contents
const files = await client.listAssets('config');

// Search for files
const results = await client.searchAssets('database config');

// Clear cache
client.clearCache();
```

## API

### Constructor Options

```typescript
interface GitHubAssetClientOptions {
  repo: string;              // Repository in 'owner/repo' format
  token: string;             // GitHub personal access token
  branch?: string;           // Branch name (default: 'main')
  cacheEnabled?: boolean;    // Enable caching (default: true)
  cacheTTL?: number;         // Cache TTL in ms (default: 300000)
  retryOptions?: {           // Retry configuration
    retries?: number;        // Max retry attempts (default: 3)
    factor?: number;         // Exponential factor (default: 2)
    minTimeout?: number;     // Min delay in ms (default: 1000)
    maxTimeout?: number;     // Max delay in ms (default: 60000)
    randomize?: boolean;     // Randomize delays (default: true)
  };
}
```

### Methods

#### `getAsset(path: string): Promise<AssetResponse>`

Retrieves a single file from the repository.

#### `listAssets(directory?: string): Promise<GitHubDirectoryItem[]>`

Lists all files and directories in the specified path.

#### `searchAssets(query: string): Promise<SearchResult[]>`

Searches for files matching the query string.

#### `clearCache(): void`

Clears the in-memory cache.

## Error Handling

The client provides detailed error messages for common scenarios:

- **404 Not Found**: File or directory doesn't exist
- **401 Unauthorized**: Invalid authentication token
- **403 Forbidden**: Rate limit exceeded or insufficient permissions
- **Network errors**: Connection timeouts or failures

## License

MIT