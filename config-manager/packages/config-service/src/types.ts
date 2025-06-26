import type { GitHubAssetClient } from '@biks2013/github-asset-client';
import type { AssetDatabaseService } from '@biks2013/asset-database';

export interface ConfigServiceOptions<T> {
  sources: ConfigSource[];
  parser: (content: string) => T | Promise<T>;
}

export interface ConfigSource {
  type: 'github' | 'database';
  priority: number;
  options: any;
}

export interface GitHubSourceOptions {
  client: GitHubAssetClient;
  assetKey: string;
}

export interface DatabaseSourceOptions {
  service: AssetDatabaseService;
  assetKey: string;
  category?: string;
}


export interface ConfigLoadResult<T> {
  data: T;
  source: string;
  cached?: boolean;
}

export type ConfigProcessor<T> = (service: ConfigService<T>, data: T) => void;

export abstract class ConfigService<T> {
  protected configs: Map<string, any> = new Map();
  protected configData?: T;
  protected initialized: boolean = false;
  protected readonly options: ConfigServiceOptions<T>;
  protected lastLoadSource?: string;
  private watchers: any[] = [];

  constructor(options: ConfigServiceOptions<T>) {
    this.options = {
      ...options,
      sources: [...options.sources].sort((a, b) => a.priority - b.priority),
    };
  }

  abstract getConfig(key?: string): Promise<any>;
  abstract getAll(): Promise<Map<string, any>>;
  abstract reload(): Promise<void>;
  protected abstract processConfiguration(data: T): void;
  
  getLastLoadSource(): string | undefined {
    console.log('getLastLoadSource called, value is:', this.lastLoadSource);
    return this.lastLoadSource;
  }

  protected async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.reload();
    }
  }

  async destroy(): Promise<void> {
    for (const watcher of this.watchers) {
      if (watcher && typeof watcher.close === 'function') {
        await watcher.close();
      }
    }
    this.watchers = [];
  }
}