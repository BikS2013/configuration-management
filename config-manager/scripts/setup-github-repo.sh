#!/bin/bash

# Script to set up GitHub repository for the config-manager

echo "Setting up GitHub repository for config-manager..."

# Initialize git if not already initialized
if [ ! -d .git ]; then
    git init
    git add .
    git commit -m "Initial commit: Configuration management library"
fi

# Create GitHub repository using GitHub CLI
echo "Creating GitHub repository..."
gh repo create giorgosmarinos/config-manager \
    --private \
    --description "Reusable configuration management library with GitHub and PostgreSQL integration" \
    --source=. \
    --remote=origin \
    --push

# Tag the initial version
git tag v1.0.0
git push origin v1.0.0

echo ""
echo "Repository created! You can now use this in other projects."
echo ""
echo "To use in other projects:"
echo "1. Via npm (after publishing):"
echo "   npm install @giorgosmarinos/config-manager"
echo ""
echo "2. Via git directly:"
echo "   npm install git+https://github.com/giorgosmarinos/config-manager.git"
echo ""
echo "3. Via specific version:"
echo "   npm install git+https://github.com/giorgosmarinos/config-manager.git#v1.0.0"