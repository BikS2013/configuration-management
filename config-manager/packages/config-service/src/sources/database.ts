import type { AssetDatabaseService } from '@biks2013/asset-database';
import { DatabaseSourceOptions } from '../types';

export class DatabaseConfigSource {
  private readonly service: AssetDatabaseService;
  private readonly assetKey: string;
  private readonly category?: string;

  constructor(options: DatabaseSourceOptions) {
    this.service = options.service;
    this.assetKey = options.assetKey;
    this.category = options.category;
  }

  async load(): Promise<string> {
    try {
      const asset = await this.service.getAsset(this.assetKey, this.category);
      if (!asset) {
        throw new Error(`Asset not found: ${this.assetKey}`);
      }
      return asset.data.content;
    } catch (error) {
      throw new Error(`Failed to load config from database: ${error}`);
    }
  }

  async store(content: string): Promise<void> {
    try {
      await this.service.storeAsset(
        this.assetKey,
        content,
        this.category || 'config',
        'Configuration data'
      );
    } catch (error) {
      throw new Error(`Failed to store config in database: ${error}`);
    }
  }

  getName(): string {
    return `database:${this.assetKey}`;
  }
}