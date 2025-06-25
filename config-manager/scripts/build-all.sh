#!/bin/bash

# Build all packages in dependency order
echo "Building @biks2013/github-asset-client..."
cd packages/github-asset-client && npm run build
echo "✓ Built github-asset-client"

echo "Building @biks2013/asset-database..."
cd ../asset-database && npm run build
echo "✓ Built asset-database"

echo "Building @biks2013/config-service..."
cd ../config-service && npm run build
echo "✓ Built config-service"

echo "✅ All packages built successfully!"