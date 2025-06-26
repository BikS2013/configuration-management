"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConfigSource = void 0;
class DatabaseConfigSource {
    constructor(options) {
        this.service = options.service;
        this.assetKey = options.assetKey;
        this.category = options.category;
    }
    async load() {
        try {
            console.log(`Database source: Attempting to load asset '${this.assetKey}' with category '${this.category}'`);
            const asset = await this.service.getAsset(this.assetKey, this.category);
            if (!asset) {
                console.log(`Database source: Asset not found in database: ${this.assetKey}`);
                throw new Error(`Asset not found: ${this.assetKey}`);
            }
            console.log(`Database source: Found asset, data structure:`, JSON.stringify(asset.data));
            console.log(`Database source: Asset full structure:`, JSON.stringify(asset, null, 2));
            if (!asset.data || !asset.data.content) {
                console.error(`Database source: Invalid asset structure, expected data.content but got:`, asset.data);
                throw new Error(`Invalid asset structure: missing data.content`);
            }
            console.log(`Database source: Successfully loaded asset '${this.assetKey}', content length:`, asset.data.content.length);
            return asset.data.content;
        }
        catch (error) {
            console.error(`Database source: Failed to load '${this.assetKey}':`, error.message);
            throw new Error(`Failed to load config from database: ${error}`);
        }
    }
    async store(content) {
        try {
            console.log(`Database source: Storing asset '${this.assetKey}' with category '${this.category || 'config'}'`);
            await this.service.storeAsset(this.assetKey, content, this.category || 'config', 'Configuration data cached from GitHub');
            console.log(`Database source: Successfully stored asset '${this.assetKey}'`);
        }
        catch (error) {
            throw new Error(`Failed to store config in database: ${error}`);
        }
    }
    getName() {
        return `database:${this.assetKey}`;
    }
}
exports.DatabaseConfigSource = DatabaseConfigSource;
