import { ConfigService, createConfigService } from '@biks2013/config-service';
import { GitHubAssetClient } from '@biks2013/github-asset-client';
import { AssetDatabaseService } from '@biks2013/asset-database';

interface PromptTemplate {
  name: string;
  content: string;
  variables?: string[];
  metadata?: Record<string, any>;
}

class PromptTemplateService extends ConfigService<string> {
  private templates = new Map<string, PromptTemplate>();

  protected processConfiguration(content: string): void {
    this.templates.clear();
    
    // Parse markdown with frontmatter format
    const sections = content.split(/^---$/m).filter(Boolean);
    
    for (let i = 0; i < sections.length; i += 2) {
      if (i + 1 >= sections.length) break;
      
      const frontmatter = sections[i].trim();
      const templateContent = sections[i + 1].trim();
      
      // Parse frontmatter
      const metadata = this.parseFrontmatter(frontmatter);
      const name = metadata.name || `template-${i / 2}`;
      
      // Extract variables from template
      const variables = this.extractVariables(templateContent);
      
      this.templates.set(name, {
        name,
        content: templateContent,
        variables,
        metadata,
      });
    }
    
    // Store in base configs for generic access
    this.configs.set('templates', Array.from(this.templates.values()));
  }

  private parseFrontmatter(frontmatter: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    const lines = frontmatter.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key] = value.trim();
      }
    }
    
    return metadata;
  }

  private extractVariables(template: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    
    let match;
    while ((match = variablePattern.exec(template)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables);
  }

  async getTemplate(name: string): Promise<PromptTemplate | undefined> {
    await this.ensureInitialized();
    return this.templates.get(name);
  }

  async getAllTemplates(): Promise<PromptTemplate[]> {
    await this.ensureInitialized();
    return Array.from(this.templates.values());
  }

  async renderTemplate(
    name: string,
    variables: Record<string, any>
  ): Promise<string> {
    await this.ensureInitialized();
    
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }
    
    let rendered = template.content;
    
    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(pattern, String(value));
    }
    
    // Check for missing variables
    const missingVars = this.extractVariables(rendered);
    if (missingVars.length > 0) {
      console.warn(`Missing variables in template ${name}:`, missingVars);
    }
    
    return rendered;
  }

  async validateTemplate(name: string, variables: Record<string, any>): Promise<{
    valid: boolean;
    missing: string[];
    extra: string[];
  }> {
    const template = await this.getTemplate(name);
    if (!template) {
      return { valid: false, missing: [], extra: [] };
    }
    
    const providedKeys = Object.keys(variables);
    const requiredKeys = template.variables || [];
    
    const missing = requiredKeys.filter(key => !providedKeys.includes(key));
    const extra = providedKeys.filter(key => !requiredKeys.includes(key));
    
    return {
      valid: missing.length === 0,
      missing,
      extra,
    };
  }

  async getConfig(key?: string): Promise<any> {
    await this.ensureInitialized();
    
    // Return null if no templates loaded
    if (this.templates.size === 0) {
      return null;
    }
    
    if (!key) {
      return Object.fromEntries(
        Array.from(this.templates.entries()).map(([name, template]) => 
          [name, template.content]
        )
      );
    }
    
    const template = this.templates.get(key);
    return template?.content;
  }

  async getAll(): Promise<Map<string, any>> {
    await this.ensureInitialized();
    return new Map(
      Array.from(this.templates.entries()).map(([name, template]) => 
        [name, template.content]
      )
    );
  }

  async reload(): Promise<void> {
    throw new Error('Use createPromptTemplateService factory instead');
  }
}

// Factory function for creating the prompt template service
export function createPromptTemplateService() {
  const serviceFactory = createConfigService<string>({
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
          assetKey: 'prompts/templates.md',
        },
      },
      {
        type: 'database',
        priority: 2,
        options: {
          service: new AssetDatabaseService({
            connectionString: process.env.DATABASE_URL!,
            ownerCategory: 'system',
            ownerKey: 'prompt-service',
          }),
          assetKey: 'prompt-templates',
          category: 'prompts',
        },
      },
    ],
    parser: async (content) => content,
  }, function(this: PromptTemplateService, data: string) {
    this.processConfiguration(data);
  });

  const instance = serviceFactory() as any;
  Object.setPrototypeOf(instance, PromptTemplateService.prototype);
  
  return instance as PromptTemplateService;
}

// Usage example
async function exampleUsage() {
  const templateService = createPromptTemplateService();

  // Get a specific template
  const template = await templateService.getTemplate('code-review');
  if (template) {
    console.log('Template:', template.name);
    console.log('Variables:', template.variables);
  }

  // Render a template
  const rendered = await templateService.renderTemplate('code-review', {
    language: 'TypeScript',
    fileName: 'service.ts',
    purpose: 'configuration management',
  });
  console.log('Rendered Template:', rendered);

  // Validate template variables
  const validation = await templateService.validateTemplate('code-review', {
    language: 'TypeScript',
    fileName: 'service.ts',
  });
  console.log('Validation:', validation);

  // Get all templates
  const allTemplates = await templateService.getAllTemplates();
  console.log('All Templates:', allTemplates.map(t => t.name));

  await templateService.destroy();
}

// Example template file format (prompts.md):
/*
---
name: code-review
category: development
description: Template for code review requests
---
Please review the following {{language}} code in {{fileName}}.

The purpose of this code is: {{purpose}}

Key areas to focus on:
- Code quality and best practices
- Performance considerations
- Security implications
- Test coverage

{{additionalContext}}

---
name: bug-report
category: support
description: Template for bug reports
---
## Bug Report

**Environment:** {{environment}}
**Version:** {{version}}

**Description:**
{{description}}

**Steps to Reproduce:**
{{steps}}

**Expected Behavior:**
{{expected}}

**Actual Behavior:**
{{actual}}

**Additional Information:**
{{additionalInfo}}
*/