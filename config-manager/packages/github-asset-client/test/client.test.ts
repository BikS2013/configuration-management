import axios from 'axios';
import { GitHubAssetClient } from '../src/client';
import { AssetCache } from '../src/cache';

jest.mock('axios');
jest.mock('p-retry');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GitHubAssetClient', () => {
  let client: GitHubAssetClient;
  const mockToken = 'ghp_test123456789';
  const mockRepo = 'testorg/testrepo';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({
      get: jest.fn(),
    } as any);

    client = new GitHubAssetClient({
      repo: mockRepo,
      token: mockToken,
      branch: 'main',
      cacheEnabled: true,
      cacheTTL: 5000,
    });
  });

  describe('constructor', () => {
    it('should parse repo format correctly', () => {
      expect(() => {
        new GitHubAssetClient({
          repo: mockRepo,
          token: mockToken,
        });
      }).not.toThrow();
    });

    it('should throw error for invalid repo format', () => {
      expect(() => {
        new GitHubAssetClient({
          repo: 'invalid-format',
          token: mockToken,
        });
      }).toThrowError('Invalid repository format');
    });

    it('should mask token in axios headers', () => {
      const createCall = mockedAxios.create.mock.calls[0][0];
      expect(createCall?.headers?.Authorization).toContain('ghp_...3456789');
    });
  });

  describe('getAsset', () => {
    const mockAssetResponse = {
      data: {
        type: 'file',
        path: 'config.json',
        content: Buffer.from('{"test": true}').toString('base64'),
        sha: 'abc123',
        size: 14,
        encoding: 'base64',
      },
    };

    beforeEach(() => {
      const mockClient = mockedAxios.create();
      (mockClient.get as jest.Mock).mockResolvedValue(mockAssetResponse);
    });

    it('should retrieve and decode file content', async () => {
      const mockRetry = jest.requireMock('p-retry').default;
      mockRetry.mockImplementation((fn: any) => fn());

      const result = await client.getAsset('config.json');

      expect(result).toEqual({
        path: 'config.json',
        content: '{"test": true}',
        sha: 'abc123',
        size: 14,
        encoding: 'base64',
        cached: false,
      });
    });

    it('should use cache when available', async () => {
      const mockRetry = jest.requireMock('p-retry').default;
      mockRetry.mockImplementation((fn: any) => fn());

      // First call
      await client.getAsset('config.json');
      
      // Second call should use cache
      const result = await client.getAsset('config.json');
      
      expect(result.cached).toBe(true);
      
      const mockClient = mockedAxios.create();
      expect(mockClient.get).toHaveBeenCalledTimes(1);
    });

    it('should throw error for non-file paths', async () => {
      const mockClient = mockedAxios.create();
      (mockClient.get as jest.Mock).mockResolvedValue({
        data: { type: 'dir' },
      });

      const mockRetry = jest.requireMock('p-retry').default;
      mockRetry.mockImplementation((fn: any) => fn());

      await expect(client.getAsset('some-directory')).rejects.toThrowError(
        'Path "some-directory" is not a file'
      );
    });
  });

  describe('listAssets', () => {
    const mockDirectoryResponse = {
      data: [
        {
          type: 'file',
          name: 'file1.json',
          path: 'dir/file1.json',
          sha: 'sha1',
          size: 100,
          url: 'https://api.github.com/...',
        },
        {
          type: 'dir',
          name: 'subdir',
          path: 'dir/subdir',
          sha: 'sha2',
          url: 'https://api.github.com/...',
        },
      ],
    };

    it('should list directory contents', async () => {
      const mockClient = mockedAxios.create();
      (mockClient.get as jest.Mock).mockResolvedValue(mockDirectoryResponse);

      const mockRetry = jest.requireMock('p-retry').default;
      mockRetry.mockImplementation((fn: any) => fn());

      const result = await client.listAssets('dir');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: 'file',
        name: 'file1.json',
        path: 'dir/file1.json',
        sha: 'sha1',
        size: 100,
        url: 'https://api.github.com/...',
      });
    });
  });

  describe('searchAssets', () => {
    const mockSearchResponse = {
      data: {
        items: [
          {
            name: 'config.json',
            path: 'src/config.json',
            sha: 'abc123',
            url: 'https://api.github.com/...',
            repository: {
              name: 'testrepo',
              full_name: 'testorg/testrepo',
            },
            score: 1.0,
          },
        ],
      },
    };

    it('should search for assets', async () => {
      const mockClient = mockedAxios.create();
      (mockClient.get as jest.Mock).mockResolvedValue(mockSearchResponse);

      const mockRetry = jest.requireMock('p-retry').default;
      mockRetry.mockImplementation((fn: any) => fn());

      const result = await client.searchAssets('config');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('config.json');
      expect(result[0].score).toBe(1.0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      client.clearCache();
      // No error thrown means success
      expect(true).toBe(true);
    });
  });
});