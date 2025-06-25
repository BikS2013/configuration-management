#!/bin/bash

# Script to link packages locally for development

echo "Setting up local development links..."

# Build all packages first
echo "Building packages..."
npm run build

# Link packages globally
echo "Creating global links..."
cd packages/github-asset-client && npm link && cd ../..
cd packages/asset-database && npm link && cd ../..
cd packages/config-service && npm link && cd ../..

echo ""
echo "Local links created!"
echo ""
echo "To use in your projects, run these commands in your project directory:"
echo ""
echo "npm link @biks2013/github-asset-client"
echo "npm link @biks2013/asset-database"
echo "npm link @biks2013/config-service"
echo ""
echo "Or link all at once:"
echo "npm link @biks2013/github-asset-client @biks2013/asset-database @biks2013/config-service"