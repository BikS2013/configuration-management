import { Pool } from 'pg';
import { AssetDatabaseService } from '../src/database';
import { SCHEMA_SQL } from '../src/schema';

jest.mock('pg');

describe('AssetDatabaseService', () => {
  let service: AssetDatabaseService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
    } as any;

    (Pool as jest.MockedClass<typeof Pool>).mockImplementation(() => mockPool);

    service = new AssetDatabaseService({
      connectionString: 'postgresql://user:pass@localhost:5432/testdb',
      ownerCategory: 'test-category',
      ownerKey: 'test-owner',
      ssl: false,
      poolSize: 10,
    });
  });

  describe('constructor', () => {
    it('should parse connection string correctly', () => {
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          user: 'user',
          password: 'pass',
          max: 10,
        })
      );
    });

    it('should enable SSL for Azure PostgreSQL', () => {
      (Pool as jest.MockedClass<typeof Pool>).mockClear();
      
      new AssetDatabaseService({
        connectionString: 'postgresql://user:pass@myserver.postgres.database.azure.com:5432/db',
        ownerCategory: 'test',
        ownerKey: 'test',
      });

      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({
          ssl: { rejectUnauthorized: false },
        })
      );
    });
  });

  describe('ensureSchema', () => {
    it('should create schema on first call', async () => {
      await service.ensureSchema();

      expect(mockClient.query).toHaveBeenCalledWith(SCHEMA_SQL);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should not recreate schema on subsequent calls', async () => {
      await service.ensureSchema();
      await service.ensureSchema();

      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should handle errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Connection failed'));

      await expect(service.ensureSchema()).rejects.toThrowError(
        'Failed to ensure database schema: Error: Connection failed'
      );
    });
  });

  describe('getAsset', () => {
    const mockAssetRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      created_at: new Date(),
      owner_category: 'test-category',
      asset_category: 'config',
      owner_key: 'test-owner',
      asset_key: 'my-config',
      description: 'Test config',
      data: { content: '{"test": true}' },
      data_hash: 'abc123',
    };

    it('should retrieve asset by key', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: [mockAssetRow] });

      const result = await service.getAsset('my-config');

      expect(result).toEqual(mockAssetRow);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM public.asset'),
        ['test-owner', 'my-config']
      );
    });

    it('should filter by category when provided', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: [mockAssetRow] });

      await service.getAsset('my-config', 'config');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND asset_category = $3'),
        ['test-owner', 'my-config', 'config']
      );
    });

    it('should return null for non-existent asset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getAsset('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('storeAsset', () => {
    it('should insert new asset', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Check existing
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      await service.storeAsset('my-config', '{"test": true}', 'config', 'Test config');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.asset'),
        expect.arrayContaining(['test-category', 'config', 'test-owner', 'my-config'])
      );
    });

    it('should update existing asset if content changed', async () => {
      const existingAsset = {
        id: '123',
        data_hash: 'old-hash',
      };

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [existingAsset] }); // Check existing
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT history
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      await service.storeAsset('my-config', '{"test": true}');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO public.asset_log'),
        ['123']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.asset'),
        expect.any(Array)
      );
    });

    it('should rollback on error', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(service.storeAsset('my-config', '{"test": true}')).rejects.toThrowError(
        'Failed to store asset: Error: Insert failed'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('listAssets', () => {
    const mockAssets = [
      {
        id: '123',
        asset_key: 'config1',
        asset_category: 'config',
        created_at: new Date(),
        data_hash: 'hash1',
        description: 'Config 1',
      },
      {
        id: '456',
        asset_key: 'config2',
        asset_category: 'config',
        created_at: new Date(),
        data_hash: 'hash2',
        description: 'Config 2',
      },
    ];

    it('should list all assets for owner', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: mockAssets });

      const result = await service.listAssets();

      expect(result).toEqual(mockAssets);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.asset'),
        ['test-owner']
      );
    });

    it('should filter by category', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: mockAssets });

      await service.listAssets('config');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND asset_category = $2'),
        ['test-owner', 'config']
      );
    });
  });

  describe('getAssetHistory', () => {
    const mockHistory = [
      {
        id: '789',
        asset_id: '123',
        created_at: new Date(),
        data: { content: '{"test": true}' },
        data_hash: 'hash1',
      },
    ];

    it('should retrieve asset history', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await service.getAssetHistory('my-config');

      expect(result).toEqual(mockHistory);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM public.asset_log'),
        ['test-owner', 'my-config']
      );
    });
  });

  describe('deleteAsset', () => {
    it('should delete asset and history', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 2 }); // DELETE history
      mockClient.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE asset
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.deleteAsset('my-config');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.asset_log'),
        ['test-owner', 'my-config']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM public.asset'),
        ['test-owner', 'my-config']
      );
    });

    it('should return false if asset not found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ensureSchema
      mockClient.query.mockResolvedValueOnce(undefined); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // DELETE history
      mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); // DELETE asset
      mockClient.query.mockResolvedValueOnce(undefined); // COMMIT

      const result = await service.deleteAsset('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('close', () => {
    it('should close the pool', async () => {
      await service.close();

      expect(mockPool.end).toHaveBeenCalled();
    });
  });
});