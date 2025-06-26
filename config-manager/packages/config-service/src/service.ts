import {
  ConfigService,
  ConfigServiceOptions,
  ConfigSource,
  ConfigLoadResult,
} from './types';
import {
  GitHubConfigSource,
  DatabaseConfigSource,
} from './sources';

export class GenericConfigService<T> extends ConfigService<T> {
  private sources: Map<string, any> = new Map();

  constructor(
    options: ConfigServiceOptions<T>,
    private processConfig: (data: T) => void
  ) {
    super(options);
    this.initializeSources();
  }

  private initializeSources(): void {
    for (const sourceConfig of this.options.sources) {
      let source: any;

      switch (sourceConfig.type) {
        case 'github':
          source = new GitHubConfigSource(sourceConfig.options);
          break;
        case 'database':
          source = new DatabaseConfigSource(sourceConfig.options);
          break;
        default:
          throw new Error(`Unknown source type: ${sourceConfig.type}`);
      }

      // Set verbose mode if enabled
      if (this.options.verbose && source.setVerbose) {
        source.setVerbose(true);
      }

      this.sources.set(`${sourceConfig.type}:${sourceConfig.priority}`, {
        source,
        config: sourceConfig,
      });
    }
  }


  async getConfig(key?: string): Promise<any> {
    await this.ensureInitialized();

    // If no config data loaded, return null
    if (!this.configData) {
      return null;
    }

    if (!key) {
      return Object.fromEntries(this.configs);
    }

    // Handle nested keys (e.g., "database.host")
    const keys = key.split('.');
    let value: any = this.configs.get(keys[0]);

    for (let i = 1; i < keys.length && value !== undefined; i++) {
      value = value?.[keys[i]];
    }

    return value;
  }

  async getAll(): Promise<Map<string, any>> {
    await this.ensureInitialized();
    return new Map(this.configs);
  }

  async reload(): Promise<void> {
    this.log('🔄 Starting configuration reload...');
    console.log('Service: Starting reload...');
    const result = await this.loadConfiguration();
    if (result) {
      console.log('Service: Configuration loaded successfully');
      this.log(`✅ Configuration loaded successfully from ${result.source}`);
      this.configData = result.data;
      this.processConfiguration(result.data);
      this.initialized = true;
    } else {
      console.log('Service: No configuration found in any source');
      this.log('❌ No configuration found in any source');
      this.configData = undefined;
      this.configs.clear();
      this.initialized = true;
    }
  }

  protected processConfiguration(data: T): void {
    console.log('Service: Processing configuration, data:', JSON.stringify(data));
    this.configs.clear();
    this.processConfig.call(this, data);
    console.log('Service: After processing, configs has', this.configs.size, 'entries');
  }

  private async loadConfiguration(): Promise<ConfigLoadResult<T> | null> {
    // Try sources in priority order
    for (const [key, { source, config }] of this.sources) {
      try {
        this.log(`🔍 Attempting to load from ${config.type} source (priority ${config.priority})`);
        console.log(`Attempting to load from ${config.type} source (priority ${config.priority})`);
        const content = await source.load();
        const data = await this.options.parser(content);

        // If we loaded from GitHub, try to cache in database
        if (config.type === 'github') {
          // First, try to load from database to compare
          let dbContent: string | null = null;
          for (const [, { source: dbSource, config: dbConfig }] of this.sources) {
            if (dbConfig.type === 'database') {
              try {
                dbContent = await dbSource.load();
              } catch {
                // Database doesn't have it yet, that's OK
              }
              break;
            }
          }
          
          await this.cacheToDatabase(content);
        }

        console.log(`Successfully loaded from ${config.type} source`);
        this.log(`✅ Successfully loaded from ${config.type} source`);
        this.lastLoadSource = config.type;
        return {
          data,
          source: source.getName(),
          cached: false,
        };
      } catch (error: any) {
        console.log(`Failed to load from ${config.type}: ${error.message}, trying next source...`);
        this.log(`⚠️  Failed to load from ${config.type}: ${error.message}`);
        // Continue to next source silently
        continue;
      }
    }

    // All sources failed - return null instead of throwing
    return null;
  }

  private async cacheToDatabase(content: string): Promise<void> {
    // Find database source if available
    for (const [, { source, config }] of this.sources) {
      if (config.type === 'database' && source.store) {
        try {
          await source.store(content);
        } catch (error) {
          console.warn(`Failed to cache config to database: ${error}`);
        }
        break;
      }
    }
  }
}

export function createConfigService<T>(
  options: ConfigServiceOptions<T>,
  processor: (service: ConfigService<T>, data: T) => void
): () => ConfigService<T> {
  let instance: ConfigService<T> | null = null;

  return () => {
    if (!instance) {
      instance = new GenericConfigService(options, function(this: ConfigService<T>, data: T) {
        processor(this, data);
      });
    }
    return instance;
  };
}