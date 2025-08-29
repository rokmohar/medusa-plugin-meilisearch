import { MeiliSearch, type Embedders } from 'meilisearch'
import { MeilisearchPluginOptions } from '../types'

/**
 * MeiliSearch Embedder Service for AI-powered semantic search
 * Handles vector search configuration and embedding management
 */
export class MeiliSearchEmbedderService {
  protected readonly config_: MeilisearchPluginOptions
  protected readonly client_: MeiliSearch

  constructor(config: MeilisearchPluginOptions, client: MeiliSearch) {
    this.config_ = config
    this.client_ = client
  }

  /**
   * Check if vector search is enabled and properly configured
   */
  isVectorSearchEnabled(): boolean {
    return !!(
      this.config_.vectorSearch?.enabled &&
      this.config_.vectorSearch.embedding
    )
  }

  /**
   * Configure embedders for an index based on vectorSearch configuration
   */
  async configureEmbedders(indexKey: string): Promise<void> {
    const { vectorSearch } = this.config_
    if (!vectorSearch?.enabled || !vectorSearch.embedding) {
      return
    }

    try {
      const embedderConfig = this.createEmbedderConfig(vectorSearch.embedding)
      const embedders: Embedders = {
        default: embedderConfig,
      }

      await this.client_.index(indexKey).updateEmbedders(embedders)
      // Successfully configured embedders
    } catch (error) {
      // Failed to configure embedders - continue without vector search
      // Don't throw - let the system continue without vector search
    }
  }

  /**
   * Create embedder configuration based on provider settings
   */
  private createEmbedderConfig(embeddingConfig: any): any {
    const baseConfig = {
      dimensions: embeddingConfig.dimensions || this.getDefaultDimensions(embeddingConfig.model),
      distribution: {
        mean: 0.7,
        sigma: 0.3,
      },
      binaryQuantized: false,
    }

    switch (embeddingConfig.provider) {
      case 'ollama':
        return {
          source: 'ollama',
          url: embeddingConfig.ngrokUrl 
            ? `${embeddingConfig.ngrokUrl}/api/embeddings`
            : `${embeddingConfig.baseUrl}/api/embeddings`,
          model: embeddingConfig.model,
          documentTemplate: this.createDocumentTemplate(),
          ...baseConfig,
        }

      case 'openai':
        return {
          source: 'openAi',
          apiKey: embeddingConfig.apiKey,
          model: embeddingConfig.model,
          url: embeddingConfig.baseUrl 
            ? `${embeddingConfig.baseUrl}/embeddings`
            : 'https://api.openai.com/v1/embeddings',
          documentTemplate: this.createDocumentTemplate(),
          documentTemplateMaxBytes: 500,
          ...baseConfig,
        }

      default:
        throw new Error(`Unsupported embedding provider: ${embeddingConfig.provider}`)
    }
  }

  /**
   * Get default dimensions for common embedding models
   */
  private getDefaultDimensions(model: string): number {
    const modelDimensions: Record<string, number> = {
      'nomic-embed-text': 768,
      'text-embedding-3-small': 1536,
    }
    return modelDimensions[model] || 768
  }

  /**
   * Create document template for embedding generation
   */
  private createDocumentTemplate(): string {
    const { embeddingFields = ['title', 'description'] } = this.config_.vectorSearch || {}
    
    // Create a template that combines the specified fields
    const fieldTemplates = embeddingFields.map(field => `{{doc.${field}}}`)
    return fieldTemplates.join(' ')
  }

  /**
   * Enhance search options with vector search parameters
   */
  enhanceSearchOptions(searchOptions: any, semanticSearch: boolean, semanticRatio: number): any {
    if (!semanticSearch || !this.isVectorSearchEnabled()) {
      return searchOptions
    }

    if (semanticRatio >= 1.0) {
      // Pure semantic search
      return {
        ...searchOptions,
        hybrid: {
          embedder: 'default',
          semanticRatio: 1.0,
        }
      }
    } else if (semanticRatio > 0.0) {
      // Hybrid search
      return {
        ...searchOptions,
        hybrid: {
          embedder: 'default',
          semanticRatio,
        }
      }
    }

    // semanticRatio = 0.0 means pure keyword search (no hybrid options)
    return searchOptions
  }

  /**
   * Add vector search metadata to search results
   */
  enhanceSearchResults(result: any, semanticSearch: boolean, semanticRatio: number): any {
    if (!semanticSearch || !this.isVectorSearchEnabled()) {
      return result
    }

    return {
      ...result,
      hybridSearch: true,
      semanticRatio,
    }
  }

  /**
   * Get embedder configuration status for admin panel
   */
  getVectorSearchStatus() {
    const { vectorSearch } = this.config_
    
    if (!vectorSearch?.enabled) {
      return {
        enabled: false,
        embeddingFields: [],
        semanticRatio: 0.5,
      }
    }

    return {
      enabled: true,
      provider: vectorSearch.embedding.provider,
      model: vectorSearch.embedding.model,
      dimensions: vectorSearch.dimensions || this.getDefaultDimensions(vectorSearch.embedding.model),
      embeddingFields: vectorSearch.embeddingFields || ['title', 'description'],
      semanticRatio: vectorSearch.semanticRatio || 0.5,
    }
  }

  /**
   * Reset embedders for an index
   */
  async resetEmbedders(indexKey: string): Promise<void> {
    try {
      await this.client_.index(indexKey).resetEmbedders()
    } catch (error) {
      // Silently fail if embedders couldn't be reset
    }
  }

  /**
   * Get current embedders configuration for an index
   */
  async getEmbedders(indexKey: string): Promise<Embedders> {
    try {
      return await this.client_.index(indexKey).getEmbedders()
    } catch (error) {
      return {}
    }
  }
}
