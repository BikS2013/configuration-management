import { AssetCache } from '../src/cache';
import { AssetResponse } from '../src/types';

describe('AssetCache', () => {
  let cache: AssetCache;
  const mockAsset: AssetResponse = {
    path: 'test.json',
    content: '{"test": true}',
    sha: 'abc123',
    size: 14,
    encoding: 'utf8',
  };

  beforeEach(() => {
    cache = new AssetCache(5000);
  });

  describe('get/set', () => {
    it('should store and retrieve assets', () => {
      cache.set('key1', mockAsset);
      const retrieved = cache.get('key1');

      expect(retrieved).toEqual({
        ...mockAsset,
        cached: true,
      });
    });

    it('should return undefined for missing keys', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should mark retrieved assets as cached', () => {
      cache.set('key1', mockAsset);
      const retrieved = cache.get('key1');
      
      expect(retrieved?.cached).toBe(true);
    });
  });

  describe('has', () => {
    it('should check if key exists', () => {
      cache.set('key1', mockAsset);
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cached items', () => {
      cache.set('key1', mockAsset);
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.has('key1')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached items', () => {
      cache.set('key1', mockAsset);
      cache.set('key2', mockAsset);
      
      cache.clear();
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return the number of cached items', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', mockAsset);
      expect(cache.size()).toBe(1);
      
      cache.set('key2', mockAsset);
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('TTL behavior', () => {
    it('should expire items after TTL', async () => {
      const shortCache = new AssetCache(100); // 100ms TTL
      
      shortCache.set('key1', mockAsset);
      expect(shortCache.has('key1')).toBe(true);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(shortCache.has('key1')).toBe(false);
      expect(shortCache.get('key1')).toBeUndefined();
    });
  });
});