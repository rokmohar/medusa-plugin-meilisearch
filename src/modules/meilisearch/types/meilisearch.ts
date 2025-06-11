import { SearchTypes } from '@medusajs/types'
import { Config } from 'meilisearch'
import { TransformOptions } from '../utils/transformer'

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
  translatableFields?: string[]
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
      transformer?: (
        document: any,
        defaultTransformer: (document: any) => any,
        options?: TransformOptions,
      ) => Record<string, unknown>
    }
  }

  /**
   * I18n configuration
   */
  i18n?: I18nConfig
}
