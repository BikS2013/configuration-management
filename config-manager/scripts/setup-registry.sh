#!/bin/bash

# Script to set up private registry publishing

echo "Setting up private registry configuration..."

# Update all package.json files with your scope and registry
SCOPE="@giorgosmarinos"
REGISTRY="https://npm.pkg.github.com"

# Function to update package.json
update_package_json() {
    local file=$1
    echo "Updating $file..."
    
    # Add publishConfig if it doesn't exist
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$file', 'utf8'));
    
    // Update package name
    if (pkg.name && pkg.name.startsWith('@biks2013/')) {
        pkg.name = pkg.name.replace('@biks2013/', '$SCOPE/');
    }
    
    // Add or update publishConfig
    pkg.publishConfig = {
        registry: '$REGISTRY',
        access: 'restricted'
    };
    
    fs.writeFileSync('$file', JSON.stringify(pkg, null, 2) + '\n');
    "
}

# Update root package.json
update_package_json "package.json"

# Update all package package.json files
for pkg in packages/*/package.json; do
    update_package_json "$pkg"
done

echo "Registry configuration complete!"
echo ""
echo "Next steps:"
echo "1. Set your NPM_TOKEN environment variable:"
echo "   export NPM_TOKEN=your_github_personal_access_token"
echo ""
echo "2. Build the packages:"
echo "   npm run build"
echo ""
echo "3. Publish to private registry:"
echo "   npx lerna publish"