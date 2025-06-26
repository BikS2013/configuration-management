"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
class ConfigService {
    constructor(options) {
        this.configs = new Map();
        this.initialized = false;
        this.watchers = [];
        this.options = {
            ...options,
            sources: [...options.sources].sort((a, b) => a.priority - b.priority),
        };
    }
    getLastLoadSource() {
        console.log('getLastLoadSource called, value is:', this.lastLoadSource);
        return this.lastLoadSource;
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.reload();
        }
    }
    async destroy() {
        for (const watcher of this.watchers) {
            if (watcher && typeof watcher.close === 'function') {
                await watcher.close();
            }
        }
        this.watchers = [];
    }
}
exports.ConfigService = ConfigService;
