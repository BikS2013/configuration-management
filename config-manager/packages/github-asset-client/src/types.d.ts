export interface GitHubAssetClientOptions {
    repo: string;
    token: string;
    branch?: string;
    cacheEnabled?: boolean;
    cacheTTL?: number;
    retryOptions?: RetryOptions;
}
export interface RetryOptions {
    retries?: number;
    factor?: number;
    minTimeout?: number;
    maxTimeout?: number;
    randomize?: boolean;
}
export interface AssetResponse {
    path: string;
    content: string;
    sha: string;
    size: number;
    encoding?: string;
    cached?: boolean;
}
export interface GitHubDirectoryItem {
    type: 'file' | 'dir';
    name: string;
    path: string;
    sha: string;
    size?: number;
    url: string;
}
export interface SearchResult {
    name: string;
    path: string;
    sha: string;
    url: string;
    repository: {
        name: string;
        full_name: string;
    };
    score: number;
}
export interface GitHubAPIError {
    message: string;
    status?: number;
    documentation_url?: string;
}
//# sourceMappingURL=types.d.ts.map