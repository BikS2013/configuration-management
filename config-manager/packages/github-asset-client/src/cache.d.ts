import { AssetResponse } from './types';
export declare class AssetCache {
    private cache;
    constructor(ttl?: number);
    get(key: string): AssetResponse | undefined;
    set(key: string, value: AssetResponse): void;
    has(key: string): boolean;
    clear(): void;
    delete(key: string): boolean;
    size(): number;
}
//# sourceMappingURL=cache.d.ts.map