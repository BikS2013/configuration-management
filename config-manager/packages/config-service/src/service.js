"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericConfigService = void 0;
exports.createConfigService = createConfigService;
const types_1 = require("./types");
const sources_1 = require("./sources");
class GenericConfigService extends types_1.ConfigService {
    constructor(options, processConfig) {
        super(options);
        this.processConfig = processConfig;
        this.sources = new Map();
        this.initializeSources();
    }
    initializeSources() {
        for (const sourceConfig of this.options.sources) {
            let source;
            switch (sourceConfig.type) {
                case 'github':
                    source = new sources_1.GitHubConfigSource(sourceConfig.options);
                    break;
                case 'database':
                    source = new sources_1.DatabaseConfigSource(sourceConfig.options);
                    break;
                default:
                    throw new Error(`Unknown source type: ${sourceConfig.type}`);
            }
            this.sources.set(`${sourceConfig.type}:${sourceConfig.priority}`, {
                source,
                config: sourceConfig,
            });
        }
    }
    async getConfig(key) {
        await this.ensureInitialized();
        // If no config data loaded, return null
        if (!this.configData) {
            return null;
        }
        if (!key) {
            return Object.fromEntries(this.configs);
        }
        // Handle nested keys (e.g., "database.host")
        const keys = key.split('.');
        let value = this.configs.get(keys[0]);
        for (let i = 1; i < keys.length && value !== undefined; i++) {
            value = value?.[keys[i]];
        }
        return value;
    }
    async getAll() {
        await this.ensureInitialized();
        return new Map(this.configs);
    }
    async reload() {
        console.log('Service: Starting reload...');
        const result = await this.loadConfiguration();
        if (result) {
            console.log('Service: Configuration loaded successfully');
            this.configData = result.data;
            this.processConfiguration(result.data);
            this.initialized = true;
        }
        else {
            console.log('Service: No configuration found in any source');
            this.configData = undefined;
            this.configs.clear();
            this.initialized = true;
        }
    }
    processConfiguration(data) {
        console.log('Service: Processing configuration, data:', JSON.stringify(data));
        this.configs.clear();
        this.processConfig.call(this, data);
        console.log('Service: After processing, configs has', this.configs.size, 'entries');
    }
    async loadConfiguration() {
        // Try sources in priority order
        for (const [key, { source, config }] of this.sources) {
            try {
                console.log(`Attempting to load from ${config.type} source (priority ${config.priority})`);
                const content = await source.load();
                const data = await this.options.parser(content);
                // If we loaded from GitHub, try to cache in database
                if (config.type === 'github') {
                    await this.cacheToDatabase(content);
                }
                console.log(`Successfully loaded from ${config.type} source`);
                this.lastLoadSource = config.type;
                return {
                    data,
                    source: source.getName(),
                    cached: false,
                };
            }
            catch (error) {
                console.log(`Failed to load from ${config.type}: ${error.message}, trying next source...`);
                // Continue to next source silently
                continue;
            }
        }
        // All sources failed - return null instead of throwing
        return null;
    }
    async cacheToDatabase(content) {
        // Find database source if available
        for (const [, { source, config }] of this.sources) {
            if (config.type === 'database' && source.store) {
                try {
                    await source.store(content);
                }
                catch (error) {
                    console.warn(`Failed to cache config to database: ${error}`);
                }
                break;
            }
        }
    }
}
exports.GenericConfigService = GenericConfigService;
function createConfigService(options, processor) {
    let instance = null;
    return () => {
        if (!instance) {
            instance = new GenericConfigService(options, function (data) {
                processor(this, data);
            });
        }
        return instance;
    };
}
