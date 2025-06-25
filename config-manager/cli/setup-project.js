#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Config Manager Project Setup\n');

// Get project name from command line or use current directory
const projectPath = process.argv[2] || '.';
const projectName = path.basename(path.resolve(projectPath));

console.log(`Setting up config-manager in: ${projectPath}\n`);

// Create project directory if it doesn't exist
if (!fs.existsSync(projectPath)) {
  fs.mkdirSync(projectPath, { recursive: true });
}

// Create config directory
const configDir = path.join(projectPath, 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Copy template files
const templatesDir = path.join(__dirname, '..', 'templates');

// Copy project setup
fs.copyFileSync(
  path.join(templatesDir, 'project-setup.ts'),
  path.join(configDir, 'index.ts')
);

// Copy environment example
fs.copyFileSync(
  path.join(templatesDir, '.env.example'),
  path.join(projectPath, '.env.example')
);

// Create package.json if it doesn't exist
const packageJsonPath = path.join(projectPath, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  const packageJson = {
    name: projectName,
    version: '1.0.0',
    description: 'Project with config-manager',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      dev: 'nodemon index.js',
    },
    dependencies: {},
    devDependencies: {
      nodemon: '^3.0.0',
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  };
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// Create a sample index.ts
const indexContent = `import { config } from './config';

async function main() {
  try {
    // Initialize and test configuration
    const appConfig = await config.get('app');
    
    if (!appConfig) {
      console.error('❌ Configuration not found in GitHub or Database');
      console.log('\\nPlease ensure:');
      console.log('1. Your GitHub token is set in .env');
      console.log('2. Your config repository exists and is accessible');
      console.log('3. Your database is running and accessible');
      process.exit(1);
    }
    
    console.log('✅ Configuration loaded successfully!');
    console.log('App name:', appConfig.name);
    console.log('Environment:', appConfig.environment);
    
    // Your application code here
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
`;

fs.writeFileSync(path.join(projectPath, 'index.ts'), indexContent);

// Create sample GitHub config structure
const githubConfigExample = {
  app: {
    name: projectName,
    version: '1.0.0',
    environment: 'development',
  },
  database: {
    host: 'localhost',
    port: 5432,
    name: `${projectName}_db`,
  },
};

fs.writeFileSync(
  path.join(configDir, 'sample-config.json'),
  JSON.stringify(githubConfigExample, null, 2)
);

// Create README
const readmeContent = `# ${projectName}

## Configuration Setup

This project uses config-manager for configuration management.

### 1. Set up environment variables

Copy \`.env.example\` to \`.env\` and fill in your values:

\`\`\`bash
cp .env.example .env
\`\`\`

### 2. Set up your GitHub configuration repository

1. Create a private GitHub repository for your configuration
2. Add the sample configuration from \`config/sample-config.json\`
3. Update the \`CONFIG_REPO\` in your \`.env\` file

### 3. Set up PostgreSQL database

Using Docker:
\`\`\`bash
docker run -d \\
  --name ${projectName}-config-db \\
  -e POSTGRES_PASSWORD=postgres \\
  -e POSTGRES_DB=config_db \\
  -p 5432:5432 \\
  postgres:15-alpine
\`\`\`

### 4. Install dependencies

\`\`\`bash
npm install
npm install @giorgosmarinos/config-manager
\`\`\`

### 5. Run the application

\`\`\`bash
npm start
\`\`\`
`;

fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent);

console.log('✅ Project setup complete!\n');
console.log('Next steps:');
console.log('1. cd', projectPath);
console.log('2. Copy .env.example to .env and configure');
console.log('3. Set up your GitHub configuration repository');
console.log('4. Install dependencies: npm install');
console.log('5. Install config-manager: npm install @giorgosmarinos/config-manager');
console.log('6. Run: npm start\n');
console.log('📚 See README.md for detailed instructions');