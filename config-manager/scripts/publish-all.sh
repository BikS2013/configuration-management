#!/bin/bash

# Publish all packages using npm workspaces instead of Lerna
echo "Publishing packages to npm..."

# Ensure we're logged in
npm whoami > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Please login to npm first: npm login"
    exit 1
fi

# Build first
echo "Building packages..."
./scripts/build-all.sh

# Publish in dependency order with explicit registry
echo -e "\nPublishing @biks2013/github-asset-client..."
cd packages/github-asset-client
npm publish --access public --registry https://registry.npmjs.org/
cd ../..

echo -e "\nPublishing @biks2013/asset-database..."
cd packages/asset-database
npm publish --access public --registry https://registry.npmjs.org/
cd ../..

echo -e "\nPublishing @biks2013/config-service..."
cd packages/config-service
npm publish --access public --registry https://registry.npmjs.org/
cd ../..

echo -e "\n✅ All packages published successfully!"