import type { AssetDatabaseService } from '@biks2013/asset-database';
import { DatabaseSourceOptions } from '../types';

export class DatabaseConfigSource {
  private readonly service: AssetDatabaseService;
  private readonly assetKey: string;
  private readonly category?: string;
  private verbose: boolean = false;
  private lastLoadedContent?: string;

  constructor(options: DatabaseSourceOptions) {
    this.service = options.service;
    this.assetKey = options.assetKey;
    this.category = options.category;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  async load(): Promise<string> {
    try {
      console.log(`Database source: Attempting to load asset '${this.assetKey}' with category '${this.category}'`);
      const asset = await this.service.getAsset(this.assetKey, this.category);
      
      if (!asset) {
        console.log(`Database source: Asset not found in database: ${this.assetKey}`);
        throw new Error(`Asset not found: ${this.assetKey}`);
      }
      
      console.log(`Database source: Found asset, data structure:`, JSON.stringify(asset.data));
      console.log(`Database source: Asset full structure:`, JSON.stringify(asset, null, 2));
      
      if (!asset.data || !asset.data.content) {
        console.error(`Database source: Invalid asset structure, expected data.content but got:`, asset.data);
        throw new Error(`Invalid asset structure: missing data.content`);
      }
      
      console.log(`Database source: Successfully loaded asset '${this.assetKey}', content length:`, asset.data.content.length);
      
      if (this.verbose) {
        console.log(`[Database] Loaded asset '${this.assetKey}' from database`);
        console.log(`[Database]   - Content length: ${asset.data.content.length} bytes`);
        console.log(`[Database]   - Created at: ${asset.created_at}`);
      }
      
      this.lastLoadedContent = asset.data.content;
      return asset.data.content;
    } catch (error: any) {
      console.error(`Database source: Failed to load '${this.assetKey}':`, error.message);
      throw new Error(`Failed to load config from database: ${error}`);
    }
  }

  async store(content: string): Promise<void> {
    try {
      console.log(`Database source: Storing asset '${this.assetKey}' with category '${this.category || 'config'}'`);
      
      if (this.verbose) {
        console.log(`[Database] Registering asset '${this.assetKey}' in database`);
        
        // Check if content is different from last loaded
        if (this.lastLoadedContent !== undefined && this.lastLoadedContent !== content) {
          console.log('\n' + '='.repeat(80));
          console.log('🔔 [Database] ⚠️  DIFFERENCE DETECTED ⚠️');
          console.log('='.repeat(80));
          console.log('📝 Content from GitHub differs from database cache!');
          console.log(`📏 Previous length: ${this.lastLoadedContent.length} bytes`);
          console.log(`📏 New length: ${content.length} bytes`);
          console.log(`📊 Size difference: ${content.length - this.lastLoadedContent.length} bytes`);
          
          // Show a preview of what changed
          const oldPreview = this.lastLoadedContent.substring(0, 100);
          const newPreview = content.substring(0, 100);
          console.log('\n📋 Content Preview:');
          console.log('OLD:', oldPreview + '...');
          console.log('NEW:', newPreview + '...');
          
          // Calculate similarity percentage
          const maxLen = Math.max(this.lastLoadedContent.length, content.length);
          let matches = 0;
          for (let i = 0; i < Math.min(this.lastLoadedContent.length, content.length); i++) {
            if (this.lastLoadedContent[i] === content[i]) matches++;
          }
          const similarity = ((matches / maxLen) * 100).toFixed(1);
          console.log(`\n📈 Content similarity: ${similarity}%`);
          console.log('='.repeat(80) + '\n');
        } else if (this.lastLoadedContent === content) {
          console.log(`[Database] ✅ Content unchanged from database cache`);
        }
      }
      
      await this.service.storeAsset(
        this.assetKey,
        content,
        this.category || 'config',
        'Configuration data cached from GitHub'
      );
      
      if (this.verbose) {
        console.log(`[Database] Successfully registered asset '${this.assetKey}' in database`);
      }
      
      console.log(`Database source: Successfully stored asset '${this.assetKey}'`);
    } catch (error) {
      throw new Error(`Failed to store config in database: ${error}`);
    }
  }

  getName(): string {
    return `database:${this.assetKey}`;
  }
}