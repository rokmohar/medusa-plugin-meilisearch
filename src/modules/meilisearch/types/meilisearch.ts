import { ProductDTO, SearchTypes } from '@medusajs/types'
import { Config, Settings } from 'meilisearch'
import { TransformOptions } from '../utils/transformer'
import { TranslatableField } from './translation'

export const meilisearchErrorCodes = {
  INDEX_NOT_FOUND: 'index_not_found',
}

export type I18nStrategy = 'separate-index' | 'field-suffix'

export interface I18nConfig {
  /**
   * The i18n strategy to use
   * - separate-index: Creates separate indexes for each language
   * - field-suffix: Adds language suffix to translatable fields
   */
  strategy: I18nStrategy

  /**
   * List of supported languages (e.g. ['en', 'fr', 'de'])
   */
  languages: string[]

  /**
   * Default language to use when no language is specified
   */
  defaultLanguage: string

  /**
   * Fields that should be translated
   * Only used when the strategy is 'field-suffix'
   */
  translatableFields?: (string | TranslatableField)[]
}

export type TransformedProduct = Record<string, any>

export type DefaultProductTransformer<Result extends TransformedProduct = TransformedProduct> = (
  document: ProductDTO,
  options?: TransformOptions,
) => Result

export type ProductTransformer<Result extends TransformedProduct = TransformedProduct> = (
  document: ProductDTO,
  defaultTransformer: DefaultProductTransformer,
  options?: TransformOptions,
) => Promise<Result>

/**
 * Vector search embedding provider types
 */
export type EmbeddingProvider = 'ollama' | 'openai'

export interface OllamaEmbeddingConfig {
  provider: 'ollama'
  /**
   * Ollama server URL (e.g., 'http://localhost:11434')
   */
  baseUrl: string
  /**
   * Embedding model name (e.g., 'nomic-embed-text')
   */
  model: string
  /**
   * Optional Ngrok URL for tunneling local Ollama to simulate live version
   */
  ngrokUrl?: string
}

export interface OpenAIEmbeddingConfig {
  provider: 'openai'
  /**
   * OpenAI API key
   */
  apiKey: string
  /**
   * OpenAI embedding model (e.g., 'text-embedding-3-small')
   */
  model: string
  /**
   * Optional OpenAI API base URL
   */
  baseUrl?: string
}

export type EmbeddingConfig = OllamaEmbeddingConfig | OpenAIEmbeddingConfig

/**
 * Vector search configuration
 */
export interface VectorSearchConfig {
  /**
   * Whether vector search is enabled
   */
  enabled: boolean
  
  /**
   * Embedding provider configuration
   */
  embedding: EmbeddingConfig
  
  /**
   * Fields to generate embeddings for
   */
  embeddingFields?: string[]
  
  /**
   * Semantic search ratio (0.0 = pure keyword, 1.0 = pure semantic)
   * Default: 0.5 for hybrid search
   */
  semanticRatio?: number
  
  /**
   * Vector dimensions (depends on the embedding model)
   * - nomic-embed-text: 768
   * - text-embedding-3-small: 1536
   */
  dimensions?: number
}

export interface MeilisearchPluginOptions {
  /**
   * Meilisearch client configuration
   */
  config: Config

  /**
   * Index settings
   */
  settings?: {
    [key: string]: Omit<SearchTypes.IndexSettings, 'transformer'> & {
      type: string
      enabled?: boolean
      fields?: string[]
      indexSettings: Settings
      transformer?: ProductTransformer<Record<string, any>>
    }
  }

  /**
   * I18n configuration
   */
  i18n?: I18nConfig

  /**
   * Vector search configuration for AI-powered semantic search
   */
  vectorSearch?: VectorSearchConfig
}
