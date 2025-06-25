import { LRUCache } from 'lru-cache';
import { AssetResponse } from './types';

export class AssetCache {
  private cache: LRUCache<string, AssetResponse>;

  constructor(ttl: number = 300000) { // 5 minutes default
    this.cache = new LRUCache<string, AssetResponse>({
      max: 500,
      ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  get(key: string): AssetResponse | undefined {
    const value = this.cache.get(key);
    if (value) {
      return { ...value, cached: true };
    }
    return undefined;
  }

  set(key: string, value: AssetResponse): void {
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}