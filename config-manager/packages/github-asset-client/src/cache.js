"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetCache = void 0;
const lru_cache_1 = require("lru-cache");
class AssetCache {
    constructor(ttl = 300000) {
        this.cache = new lru_cache_1.LRUCache({
            max: 500,
            ttl,
            updateAgeOnGet: true,
            updateAgeOnHas: false,
        });
    }
    get(key) {
        const value = this.cache.get(key);
        if (value) {
            return { ...value, cached: true };
        }
        return undefined;
    }
    set(key, value) {
        this.cache.set(key, value);
    }
    has(key) {
        return this.cache.has(key);
    }
    clear() {
        this.cache.clear();
    }
    delete(key) {
        return this.cache.delete(key);
    }
    size() {
        return this.cache.size;
    }
}
exports.AssetCache = AssetCache;
