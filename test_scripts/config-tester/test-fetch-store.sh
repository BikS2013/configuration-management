#!/bin/bash

# Script to test fetch and store functionality
curl -X POST http://localhost:3333/api/test \
  -H "Content-Type: application/json" \
  -d '{
    "githubToken": "'${GITHUB_TOKEN:-$(grep GITHUB_TOKEN .env | cut -d= -f2)}'",
    "repoOwner": "'${REPO_OWNER:-$(grep REPO_OWNER .env | cut -d= -f2)}'",
    "repoName": "'${REPO_NAME:-$(grep REPO_NAME .env | cut -d= -f2)}'",
    "branch": "'${BRANCH:-$(grep BRANCH .env | cut -d= -f2)}'",
    "ownerKey": "'${OWNER_KEY:-$(grep OWNER_KEY .env | cut -d= -f2)}'",
    "assetKey": "'${ASSET_KEY:-$(grep ASSET_KEY .env | cut -d= -f2)}'",
    "assetPath": "'${ASSET_PATH:-$(grep ASSET_PATH .env | cut -d= -f2)}'",
    "dbConnectionString": "'${DB_CONNECTION_STRING:-$(grep DB_CONNECTION_STRING .env | cut -d= -f2)}'",
    "useDatabase": true,
    "testMode": "fetchAndStore"
  }' | jq .