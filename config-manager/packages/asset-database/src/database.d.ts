import { AssetDatabaseOptions, AssetRecord, AssetHistoryRecord, AssetMetadata } from './types';
export declare class AssetDatabaseService {
    private pool;
    private readonly options;
    private initialized;
    constructor(options: AssetDatabaseOptions);
    private createPool;
    private parseConnectionString;
    ensureSchema(): Promise<void>;
    getAsset(key: string, category?: string): Promise<AssetRecord | null>;
    storeAsset(key: string, content: string, category?: string, description?: string): Promise<void>;
    listAssets(category?: string): Promise<AssetMetadata[]>;
    getAssetHistory(key: string): Promise<AssetHistoryRecord[]>;
    deleteAsset(key: string): Promise<boolean>;
    close(): Promise<void>;
    private calculateHash;
}
//# sourceMappingURL=database.d.ts.map