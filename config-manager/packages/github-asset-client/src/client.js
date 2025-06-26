"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubAssetClient = void 0;
const axios_1 = __importDefault(require("axios"));
const p_retry_1 = __importDefault(require("p-retry"));
const cache_1 = require("./cache");
class GitHubAssetClient {
    constructor(options) {
        // Parse repo format: owner/repo
        const [owner, repo] = options.repo.split('/');
        if (!owner || !repo) {
            throw new Error('Invalid repository format. Expected: owner/repo');
        }
        this.owner = owner;
        this.repoName = repo;
        this.options = {
            repo: options.repo,
            token: options.token,
            branch: options.branch || 'main',
            cacheEnabled: options.cacheEnabled !== false,
            cacheTTL: options.cacheTTL || 300000, // 5 minutes
            timeout: options.timeout || 30000, // 30 seconds default
            retryOptions: {
                retries: 3,
                factor: 2,
                minTimeout: 1000,
                maxTimeout: 60000,
                randomize: true,
                ...options.retryOptions,
            },
        };
        this.client = axios_1.default.create({
            baseURL: 'https://api.github.com',
            headers: {
                Authorization: `Bearer ${this.maskToken(this.options.token)}`,
                Accept: 'application/vnd.github.v3+json',
            },
            timeout: this.options.timeout,
        });
        if (this.options.cacheEnabled) {
            this.cache = new cache_1.AssetCache(this.options.cacheTTL);
        }
    }
    async getAsset(path) {
        const cacheKey = `${this.options.repo}:${this.options.branch}:${path}`;
        // Check cache first
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }
        try {
            const response = await (0, p_retry_1.default)(async () => {
                const res = await this.client.get(`/repos/${this.owner}/${this.repoName}/contents/${path}`, {
                    params: {
                        ref: this.options.branch,
                    },
                    headers: {
                        Authorization: `Bearer ${this.options.token}`,
                    },
                });
                return res;
            }, this.options.retryOptions);
            const data = response.data;
            if (data.type !== 'file') {
                throw new Error(`Path "${path}" is not a file`);
            }
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const asset = {
                path: data.path,
                content,
                sha: data.sha,
                size: data.size,
                encoding: data.encoding,
                cached: false,
            };
            // Cache the result
            if (this.cache) {
                this.cache.set(cacheKey, asset);
            }
            return asset;
        }
        catch (error) {
            throw this.handleError(error, `Failed to get asset: ${path}`);
        }
    }
    async listAssets(directory = '') {
        const cacheKey = `list:${this.options.repo}:${this.options.branch}:${directory}`;
        // Check cache
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached.content);
            }
        }
        try {
            const response = await (0, p_retry_1.default)(async () => {
                const res = await this.client.get(`/repos/${this.owner}/${this.repoName}/contents/${directory}`, {
                    params: {
                        ref: this.options.branch,
                    },
                    headers: {
                        Authorization: `Bearer ${this.options.token}`,
                    },
                });
                return res;
            }, this.options.retryOptions);
            const items = Array.isArray(response.data)
                ? response.data.map((item) => ({
                    type: item.type,
                    name: item.name,
                    path: item.path,
                    sha: item.sha,
                    size: item.size,
                    url: item.url,
                }))
                : [];
            // Cache the result
            if (this.cache) {
                this.cache.set(cacheKey, {
                    path: directory,
                    content: JSON.stringify(items),
                    sha: '',
                    size: 0,
                    cached: false,
                });
            }
            return items;
        }
        catch (error) {
            throw this.handleError(error, `Failed to list assets in: ${directory}`);
        }
    }
    async searchAssets(query) {
        const cacheKey = `search:${this.options.repo}:${query}`;
        // Check cache
        if (this.cache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached.content);
            }
        }
        try {
            const response = await (0, p_retry_1.default)(async () => {
                const res = await this.client.get('/search/code', {
                    params: {
                        q: `${query} repo:${this.owner}/${this.repoName}`,
                        per_page: 100,
                    },
                    headers: {
                        Authorization: `Bearer ${this.options.token}`,
                    },
                });
                return res;
            }, this.options.retryOptions);
            const results = response.data.items.map((item) => ({
                name: item.name,
                path: item.path,
                sha: item.sha,
                url: item.url,
                repository: {
                    name: item.repository.name,
                    full_name: item.repository.full_name,
                },
                score: item.score,
            }));
            // Cache the result
            if (this.cache) {
                this.cache.set(cacheKey, {
                    path: query,
                    content: JSON.stringify(results),
                    sha: '',
                    size: 0,
                    cached: false,
                });
            }
            return results;
        }
        catch (error) {
            throw this.handleError(error, `Failed to search assets: ${query}`);
        }
    }
    clearCache() {
        if (this.cache) {
            this.cache.clear();
        }
    }
    maskToken(token) {
        if (token.length < 8) {
            return '***';
        }
        return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
    }
    handleError(error, message) {
        if (axios_1.default.isAxiosError(error)) {
            const axiosError = error;
            if (axiosError.response) {
                const status = axiosError.response.status;
                const data = axiosError.response.data;
                if (status === 404) {
                    return new Error(`${message}: Not found`);
                }
                else if (status === 401) {
                    return new Error(`${message}: Invalid authentication token`);
                }
                else if (status === 403) {
                    return new Error(`${message}: Rate limit exceeded or insufficient permissions`);
                }
                return new Error(`${message}: ${data.message || 'Unknown error'}`);
            }
        }
        return new Error(`${message}: ${error.message}`);
    }
}
exports.GitHubAssetClient = GitHubAssetClient;
