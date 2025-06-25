import { createConfigService } from '../src/service';
import { ConfigService } from '../src/types';

// Mock the source modules
jest.mock('../src/sources/github');
jest.mock('../src/sources/database');

describe('ConfigService', () => {
  let configService: ConfigService<any>;
  let mockGitHubSource: any;
  let mockDatabaseSource: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockGitHubSource = {
      load: jest.fn(),
      getName: jest.fn().mockReturnValue('github:test.yaml'),
    };

    mockDatabaseSource = {
      load: jest.fn(),
      store: jest.fn(),
      getName: jest.fn().mockReturnValue('database:test-config'),
    };

    // Mock constructors
    const { GitHubConfigSource } = jest.requireMock('../src/sources/github');
    const { DatabaseConfigSource } = jest.requireMock('../src/sources/database');

    GitHubConfigSource.mockImplementation(() => mockGitHubSource);
    DatabaseConfigSource.mockImplementation(() => mockDatabaseSource);
  });

  describe('createConfigService', () => {
    it('should create a singleton service instance', () => {
      const serviceFactory = createConfigService({
        sources: [{
          type: 'github',
          priority: 1,
          options: { client: {}, assetKey: 'test.yaml' },
        }],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {
        service.configs.set('test', data);
      });

      const instance1 = serviceFactory();
      const instance2 = serviceFactory();

      expect(instance1).toBe(instance2);
    });
  });

  describe('configuration loading', () => {
    beforeEach(() => {
      const testConfig = {
        database: { host: 'localhost', port: 5432 },
        api: { timeout: 5000 },
      };

      mockGitHubSource.load.mockResolvedValue(JSON.stringify(testConfig));

      const serviceFactory = createConfigService({
        sources: [
          {
            type: 'github',
            priority: 1,
            options: { client: {}, assetKey: 'test.yaml' },
          },
          {
            type: 'database',
            priority: 2,
            options: { service: {}, assetKey: 'test-config' },
          },
        ],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {
        for (const [key, value] of Object.entries(data)) {
          service.configs.set(key, value);
        }
      });

      configService = serviceFactory();
    });

    it('should load configuration from the first available source', async () => {
      mockGitHubSource.load.mockResolvedValue('{"source": "github"}');

      const config = await configService.getConfig();

      expect(mockGitHubSource.load).toHaveBeenCalled();
      expect(mockDatabaseSource.load).not.toHaveBeenCalled();
    });

    it('should fallback to next source on failure', async () => {
      mockGitHubSource.load.mockRejectedValue(new Error('GitHub unavailable'));
      mockDatabaseSource.load.mockResolvedValue('{"source": "database"}');

      const config = await configService.getConfig();

      expect(mockGitHubSource.load).toHaveBeenCalled();
      expect(mockDatabaseSource.load).toHaveBeenCalled();
      expect(config).toEqual({ source: 'database' });
    });

    it('should cache GitHub content to database', async () => {
      const gitHubContent = '{"source": "github", "cached": false}';
      mockGitHubSource.load.mockResolvedValue(gitHubContent);

      await configService.getConfig();

      expect(mockDatabaseSource.store).toHaveBeenCalledWith(gitHubContent);
    });

    it('should return null when all sources fail', async () => {
      mockGitHubSource.load.mockRejectedValue(new Error('GitHub error'));
      mockDatabaseSource.load.mockRejectedValue(new Error('Database error'));

      const config = await configService.getConfig();
      
      expect(config).toBeNull();
    });
  });

  describe('getConfig', () => {
    beforeEach(async () => {
      const testConfig = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            user: 'admin',
            password: 'secret',
          },
        },
        features: {
          cache: true,
          timeout: 5000,
        },
      };

      mockGitHubSource.load.mockResolvedValue(JSON.stringify(testConfig));

      const serviceFactory = createConfigService({
        sources: [{
          type: 'github',
          priority: 1,
          options: { client: {}, assetKey: 'test.yaml' },
        }],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {
        for (const [key, value] of Object.entries(data)) {
          service.configs.set(key, value);
        }
      });

      configService = serviceFactory();
      await configService.reload();
    });

    it('should get all config when no key provided', async () => {
      const config = await configService.getConfig();

      expect(config).toEqual({
        database: expect.objectContaining({ host: 'localhost' }),
        features: expect.objectContaining({ cache: true }),
      });
    });

    it('should get specific config by key', async () => {
      const dbConfig = await configService.getConfig('database');

      expect(dbConfig).toEqual({
        host: 'localhost',
        port: 5432,
        credentials: { user: 'admin', password: 'secret' },
      });
    });

    it('should handle nested keys', async () => {
      const host = await configService.getConfig('database.host');
      const user = await configService.getConfig('database.credentials.user');

      expect(host).toBe('localhost');
      expect(user).toBe('admin');
    });

    it('should return undefined for non-existent keys', async () => {
      const result = await configService.getConfig('nonexistent.key');

      expect(result).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all configuration as a Map', async () => {
      const testConfig = { key1: 'value1', key2: 'value2' };
      mockGitHubSource.load.mockResolvedValue(JSON.stringify(testConfig));

      const serviceFactory = createConfigService({
        sources: [{
          type: 'github',
          priority: 1,
          options: { client: {}, assetKey: 'test.yaml' },
        }],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {
        for (const [key, value] of Object.entries(data)) {
          service.configs.set(key, value);
        }
      });

      configService = serviceFactory();
      const allConfig = await configService.getAll();

      expect(allConfig).toBeInstanceOf(Map);
      expect(allConfig.get('key1')).toBe('value1');
      expect(allConfig.get('key2')).toBe('value2');
    });
  });

  describe('reload', () => {
    it('should reload configuration', async () => {
      const initialConfig = { version: 1 };
      const updatedConfig = { version: 2 };

      mockGitHubSource.load
        .mockResolvedValueOnce(JSON.stringify(initialConfig))
        .mockResolvedValueOnce(JSON.stringify(updatedConfig));

      const serviceFactory = createConfigService({
        sources: [{
          type: 'github',
          priority: 1,
          options: { client: {}, assetKey: 'test.yaml' },
        }],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {
        service.configs.set('version', data.version);
      });

      configService = serviceFactory();

      // Initial load
      let version = await configService.getConfig('version');
      expect(version).toBe(1);

      // Reload
      await configService.reload();
      version = await configService.getConfig('version');
      expect(version).toBe(2);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', async () => {
      const serviceFactory = createConfigService({
        sources: [{
          type: 'github',
          priority: 1,
          options: { client: {}, assetKey: 'test.yaml' },
        }],
        parser: (content) => JSON.parse(content),
      }, (service, data) => {});

      configService = serviceFactory();
      await configService.destroy();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});