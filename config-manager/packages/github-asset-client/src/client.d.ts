import { GitHubAssetClientOptions, AssetResponse, GitHubDirectoryItem, SearchResult } from './types';
export declare class GitHubAssetClient {
    private readonly options;
    private readonly client;
    private readonly cache?;
    private readonly owner;
    private readonly repoName;
    constructor(options: GitHubAssetClientOptions);
    getAsset(path: string): Promise<AssetResponse>;
    listAssets(directory?: string): Promise<GitHubDirectoryItem[]>;
    searchAssets(query: string): Promise<SearchResult[]>;
    clearCache(): void;
    private maskToken;
    private handleError;
}
//# sourceMappingURL=client.d.ts.map