# Config Manager Tester

A web-based testing tool for the config-manager library that provides a user-friendly interface to test all library features.

## Features

- Test GitHub asset retrieval with automatic database caching
- Test the complete configuration service with fallback behavior
- Clear error messages with troubleshooting hints
- Support for all configuration parameters
- Two test modes:
  - Config Service: Uses the library with GitHub → Database fallback
  - Direct: Direct GitHub fetch without caching or fallback

## Setup

1. Install dependencies:
```bash
npm install
```

2. Build the config-manager packages (from the config-manager directory):
```bash
cd ../../config-manager
npm run build
```

3. Start the test server:

For development with auto-reload:
```bash
npm run dev
```

For production mode:
```bash
npm start
```

4. Open your browser to http://localhost:3333

## Configuration

Create a `.env` file with your settings:
```bash
GITHUB_TOKEN=your_github_token
REPO_OWNER=your_github_username
REPO_NAME=your_repo_name
BRANCH=main
OWNER_KEY=your_app_name
ASSET_KEY=config_key
ASSET_PATH=path/to/config.json
DB_CONNECTION_STRING=postgresql://user:pass@host:port/db
USE_DATABASE=true
DEFAULT_TEST_MODE=configService
```

## Usage

1. The form will auto-fill from your `.env` file

2. Select a test mode:
   - **Config Service**: Tests the full library with GitHub → Database fallback
   - **Direct**: Tests direct GitHub fetch without the library

3. Click "Run Test" to execute

The interface will display:
- Success: The retrieved asset content and metadata
- Error: Detailed error information with troubleshooting hints
- Notes: Information about caching and fallback behavior

## How It Works

### Config Service Mode (Recommended)
1. Attempts to fetch from GitHub first
2. If successful, automatically caches to database
3. If GitHub fails, falls back to database cache
4. Returns null only if both sources fail

### Direct Mode
- Fetches directly from GitHub API
- No caching or fallback
- Useful for comparison and debugging

## Auto-Reload Features

When running in development mode (`npm run dev`), the server will automatically restart when:

- Any TypeScript file in the project changes
- The `.env` file is modified
- Any source file in the config-manager packages changes

The server includes:
- Graceful shutdown handling (SIGTERM/SIGINT)
- Environment variable hot-reloading
- 1-second delay to batch multiple file changes

## Troubleshooting

- **Database errors**: Ensure PostgreSQL is running and accessible
- **GitHub errors**: Verify token permissions and repository access
- **Network errors**: Check if the server is running on port 3333
- **Auto-reload not working**: Ensure nodemon is installed (`npm install`)