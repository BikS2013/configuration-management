#!/bin/bash

# Script to publish all packages in the correct order
# Run from the config-manager directory

set -e  # Exit on error

echo "🚀 Publishing @biks2013 packages to npm..."
echo "Make sure you're logged in to npm with: npm login"
echo ""

# Build all packages first
echo "📦 Building all packages..."
npm run build

# Publish in dependency order
# 1. First publish packages with no internal dependencies
echo ""
echo "📤 Publishing @biks2013/github-asset-client..."
cd packages/github-asset-client
npm publish --access public
cd ../..

echo ""
echo "📤 Publishing @biks2013/asset-database..."
cd packages/asset-database
npm publish --access public
cd ../..

# 2. Then publish packages that depend on others
echo ""
echo "📤 Publishing @biks2013/config-service..."
cd packages/config-service
npm publish --access public
cd ../..

echo ""
echo "✅ All packages published successfully!"
echo ""
echo "Published versions:"
echo "- @biks2013/github-asset-client@1.0.1"
echo "- @biks2013/asset-database@1.0.1"
echo "- @biks2013/config-service@1.0.1"