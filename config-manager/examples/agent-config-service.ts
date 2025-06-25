import { ConfigService, createConfigService } from '@biks2013/config-service';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';

interface AgentConfig {
  name: string;
  connectionString: string;
  settings: Record<string, any>;
}

class AgentConfigService extends ConfigService<AgentConfig[]> {
  private agents = new Map<string, AgentConfig>();

  protected processConfiguration(data: AgentConfig[]): void {
    this.agents.clear();
    for (const agent of data) {
      this.agents.set(agent.name, agent);
    }
    
    // Also store in the base configs map for generic access
    this.configs.set('agents', data);
  }

  async getAgent(name: string): Promise<AgentConfig | undefined> {
    await this.ensureInitialized();
    return this.agents.get(name);
  }

  async getAllAgents(): Promise<AgentConfig[]> {
    await this.ensureInitialized();
    return Array.from(this.agents.values());
  }

  async getConfig(key?: string): Promise<any> {
    await this.ensureInitialized();
    
    // Return null if no agents loaded
    if (this.agents.size === 0) {
      return null;
    }
    
    if (!key) {
      return Array.from(this.agents.values());
    }
    
    // Handle agent-specific queries like "agent.myagent.connectionString"
    if (key.startsWith('agent.')) {
      const parts = key.split('.');
      if (parts.length >= 2) {
        const agentName = parts[1];
        const agent = this.agents.get(agentName);
        
        if (parts.length === 2) {
          return agent;
        } else if (agent && parts.length > 2) {
          const propertyPath = parts.slice(2).join('.');
          return this.getNestedProperty(agent, propertyPath);
        }
      }
    }
    
    return this.configs.get(key);
  }

  async getAll(): Promise<Map<string, any>> {
    await this.ensureInitialized();
    return new Map([
      ['agents', Array.from(this.agents.values())],
      ...Array.from(this.agents.entries()).map(([name, config]) => 
        [`agent.${name}`, config] as [string, any]
      ),
    ]);
  }

  async reload(): Promise<void> {
    // This will be implemented by the parent class
    throw new Error('Use createAgentConfigService factory instead');
  }

  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;
    
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    
    return value;
  }
}

// Factory function for creating the agent config service
export function createAgentConfigService() {
  const serviceFactory = createConfigService<AgentConfig[]>({
    sources: [
      {
        type: 'github',
        priority: 1,
        options: {
          client: new GitHubAssetClient({
            repo: process.env.CONFIG_REPO || 'org/config-repo',
            token: process.env.GITHUB_TOKEN!,
            branch: process.env.CONFIG_BRANCH || 'main',
          }),
          assetKey: 'agents/agent-config.json',
        },
      },
      {
        type: 'database',
        priority: 2,
        options: {
          service: new AssetDatabaseService({
            connectionString: process.env.DATABASE_URL!,
            ownerCategory: 'system',
            ownerKey: 'agent-platform',
          }),
          assetKey: 'agent-config',
          category: 'agents',
        },
      },
    ],
    parser: async (content) => JSON.parse(content),
  }, function(this: AgentConfigService, data: AgentConfig[]) {
    this.processConfiguration(data);
  });

  // Create instance and cast to AgentConfigService
  const instance = serviceFactory() as any;
  
  // Copy methods from AgentConfigService prototype
  Object.setPrototypeOf(instance, AgentConfigService.prototype);
  
  return instance as AgentConfigService;
}

// Usage example
async function exampleUsage() {
  const configService = createAgentConfigService();

  // Get a specific agent configuration
  const agentConfig = await configService.getAgent('data-processor');
  if (agentConfig) {
    console.log('Data Processor Agent:', agentConfig);
    console.log('Connection String:', agentConfig.connectionString);
  }

  // Get all agents
  const allAgents = await configService.getAllAgents();
  console.log('All Agents:', allAgents);

  // Get specific nested property
  const processorSettings = await configService.getConfig('agent.data-processor.settings');
  console.log('Processor Settings:', processorSettings);

  // Clean up
  await configService.destroy();
}

// Example agent configuration file format:
/*
[
  {
    "name": "data-processor",
    "connectionString": "postgresql://user:pass@localhost:5432/processor",
    "settings": {
      "batchSize": 100,
      "timeout": 30000,
      "retryAttempts": 3
    }
  },
  {
    "name": "api-gateway",
    "connectionString": "postgresql://user:pass@localhost:5432/gateway",
    "settings": {
      "port": 3000,
      "cors": true,
      "rateLimit": 1000
    }
  }
]
*/