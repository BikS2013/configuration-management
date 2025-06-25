import type { GitHubAssetClient } from '@biks2013/github-asset-client';
import { GitHubSourceOptions } from '../types';

export class GitHubConfigSource {
  private readonly client: GitHubAssetClient;
  private readonly assetKey: string;

  constructor(options: GitHubSourceOptions) {
    this.client = options.client;
    this.assetKey = options.assetKey;
  }

  async load(): Promise<string> {
    try {
      const asset = await this.client.getAsset(this.assetKey);
      return asset.content;
    } catch (error) {
      throw new Error(`Failed to load config from GitHub: ${error}`);
    }
  }

  getName(): string {
    return `github:${this.assetKey}`;
  }
}