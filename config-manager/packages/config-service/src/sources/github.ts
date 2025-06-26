import type { GitHubAssetClient } from '@biks2013/github-asset-client';
import { GitHubSourceOptions } from '../types';

export class GitHubConfigSource {
  private readonly client: GitHubAssetClient;
  private readonly assetKey: string;
  private verbose: boolean = false;

  constructor(options: GitHubSourceOptions) {
    this.client = options.client;
    this.assetKey = options.assetKey;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  async load(): Promise<string> {
    try {
      if (this.verbose) {
        console.log(`\n🌐 [GitHub] Reading asset from path: ${this.assetKey}`);
      }
      
      const asset = await this.client.getAsset(this.assetKey);
      
      if (this.verbose) {
        console.log(`✅ [GitHub] Successfully read asset '${this.assetKey}':`);
        console.log(`   📦 Size: ${asset.size} bytes`);
        console.log(`   🔑 SHA: ${asset.sha}`);
        console.log(`   👁️  Preview: ${asset.content.substring(0, 100)}...`);
      }
      
      return asset.content;
    } catch (error: any) {
      console.warn(`GitHub source failed for ${this.assetKey}: ${error.message}`);
      throw new Error(`Failed to load config from GitHub: ${error}`);
    }
  }

  getName(): string {
    return `github:${this.assetKey}`;
  }
}