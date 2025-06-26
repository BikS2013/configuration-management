"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubConfigSource = void 0;
class GitHubConfigSource {
    constructor(options) {
        this.client = options.client;
        this.assetKey = options.assetKey;
    }
    async load() {
        try {
            const asset = await this.client.getAsset(this.assetKey);
            return asset.content;
        }
        catch (error) {
            console.warn(`GitHub source failed for ${this.assetKey}: ${error.message}`);
            throw new Error(`Failed to load config from GitHub: ${error}`);
        }
    }
    getName() {
        return `github:${this.assetKey}`;
    }
}
exports.GitHubConfigSource = GitHubConfigSource;
