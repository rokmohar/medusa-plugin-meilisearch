import { DocumentsDeletionQuery, DocumentsIds, MeiliSearch } from 'meilisearch'
import { SearchTypes } from '@medusajs/types'
import { SearchUtils } from '@medusajs/utils'
import { meilisearchErrorCodes, MeilisearchPluginOptions } from '../types'
import { MeiliSearchEmbedder } from '../utils/embedder'
import { transformProduct, transformCategory, TransformOptions } from '../utils/transformer'

export class MeiliSearchService extends SearchUtils.AbstractSearchService {
  public static identifier = 'index-meilisearch'

  public isDefault = false

  protected readonly config_: MeilisearchPluginOptions
  protected readonly client_: MeiliSearch
  protected readonly embedder_: MeiliSearchEmbedder

  constructor(container: any, options: MeilisearchPluginOptions) {
    super(container, options)

    this.config_ = options

    if (!options.config?.apiKey) {
      throw Error(
        'Meilisearch API key is missing in plugin config. See https://github.com/rokmohar/medusa-plugin-meilisearch',
      )
    }

    if (!options.config?.host) {
      throw Error(
        'Meilisearch host is missing in plugin config. See https://github.com/rokmohar/medusa-plugin-meilisearch',
      )
    }

    this.client_ = new MeiliSearch(options.config)
    this.embedder_ = new MeiliSearchEmbedder(options, this.client_)
  }

  protected getLanguageIndexKey(baseKey: string, language?: string): string {
    const { i18n } = this.config_

    if (!i18n || i18n.strategy !== 'separate-index' || !language) {
      return baseKey
    }

    return `${baseKey}_${language}`
  }

  async getFieldsForType(type: string) {
    const fields = new Set<string>()

    Object.values(this.config_.settings || {})
      .filter((config) => config.type === type && config.enabled !== false)
      .forEach((config) => {
        if (Array.isArray(config.fields)) {
          config.fields.forEach((field) => fields.add(field))
        }
      })

    if (!fields.size) {
      fields.add('*')
    }

    return Array.from(fields)
  }

  async getIndexesByType(type: string) {
    const { i18n } = this.config_
    const baseIndexes = Object.entries(this.config_.settings || {})
      .filter(([, config]) => config.type === type && config.enabled !== false)
      .map(([key]) => key)

    if (i18n?.strategy === 'separate-index') {
      const { languages } = i18n
      return baseIndexes.flatMap((baseIndex) => languages.map((lang) => this.getLanguageIndexKey(baseIndex, lang)))
    }

    return baseIndexes
  }

  async createIndex(indexKey: string, options: Record<string, any> = { primaryKey: 'id' }) {
    return this.client_.createIndex(indexKey, options)
  }

  getIndex(indexKey: string) {
    return this.client_.index(indexKey)
  }

  async addDocuments(indexKey: string, documents: any[], language?: string) {
    const { i18n } = this.config_
    const i18nOptions = {
      i18n,
      language,
    }

    if (i18n?.strategy === 'separate-index') {
      const langIndexKey = this.getLanguageIndexKey(indexKey, language || i18n.defaultLanguage)
      const transformedDocuments = await this.getTransformedDocuments(indexKey, documents, i18nOptions)
      return this.client_.index(langIndexKey).addDocuments(transformedDocuments, { primaryKey: 'id' })
    } else {
      const transformedDocuments = await this.getTransformedDocuments(indexKey, documents, i18nOptions)
      return this.client_.index(indexKey).addDocuments(transformedDocuments, { primaryKey: 'id' })
    }
  }

  async replaceDocuments(indexKey: string, documents: any[], language?: string) {
    return this.addDocuments(indexKey, documents, language)
  }

  async deleteDocument(indexKey: string, documentId: string | number, language?: string) {
    const actualIndexKey = this.getLanguageIndexKey(indexKey, language)
    return this.client_.index(actualIndexKey).deleteDocument(documentId)
  }

  async deleteDocuments(indexKey: string, documents: DocumentsDeletionQuery | DocumentsIds, language?: string) {
    const actualIndexKey = this.getLanguageIndexKey(indexKey, language)
    return this.client_.index(actualIndexKey).deleteDocuments(documents)
  }

  async deleteAllDocuments(indexKey: string, language?: string) {
    const actualIndexKey = this.getLanguageIndexKey(indexKey, language)
    return this.client_.index(actualIndexKey).deleteAllDocuments()
  }

  async search(
    indexKey: string,
    query: string,
    options: Record<string, any> & { language?: string; semanticSearch?: boolean; semanticRatio?: number },
  ) {
    const {
      language,
      paginationOptions,
      filter,
      additionalOptions,
      semanticSearch = false,
      semanticRatio = 0.5,
    } = options
    const actualIndexKey = this.getLanguageIndexKey(indexKey, language)

    // Build base search options
    let searchOptions = {
      filter,
      ...paginationOptions,
      ...additionalOptions,
    }

    // Enhance with vector search if needed
    searchOptions = this.embedder_.enhanceSearchOptions(searchOptions, semanticSearch, semanticRatio)

    // Perform search
    return this.client_.index(actualIndexKey).search(query, searchOptions)
  }

  async updateSettings(indexKey: string, settings: Pick<SearchTypes.IndexSettings, 'indexSettings' | 'primaryKey'>) {
    const indexConfig = this.config_.settings?.[indexKey]
    if (indexConfig?.enabled === false) {
      return
    }

    const { i18n } = this.config_

    if (i18n?.strategy === 'separate-index') {
      const { languages } = i18n
      return Promise.all(
        languages.map(async (lang) => {
          const langIndexKey = this.getLanguageIndexKey(indexKey, lang)
          await this.upsertIndex(langIndexKey, settings)
          await this.updateIndexSettings(langIndexKey, settings.indexSettings ?? {})
          // Configure embedders for vector search
          if (this.embedder_.isVectorSearchEnabled()) {
            await this.embedder_.configureEmbedders(langIndexKey)
          }
        }),
      )
    } else {
      await this.upsertIndex(indexKey, settings)
      await this.updateIndexSettings(indexKey, settings.indexSettings ?? {})
      // Configure embedders for vector search
      if (this.embedder_.isVectorSearchEnabled()) {
        await this.embedder_.configureEmbedders(indexKey)
      }
      return
    }
  }

  private async updateIndexSettings(indexKey: string, indexSettings: Record<string, any>) {
    return this.client_.index(indexKey).updateSettings(indexSettings)
  }

  async upsertIndex(indexKey: string, settings: Pick<SearchTypes.IndexSettings, 'primaryKey'>) {
    const indexConfig = this.config_.settings?.[indexKey]
    if (indexConfig?.enabled === false) {
      return
    }
    try {
      await this.client_.getIndex(indexKey)
    } catch (error) {
      if (error.code === meilisearchErrorCodes.INDEX_NOT_FOUND) {
        await this.createIndex(indexKey, {
          primaryKey: settings.primaryKey ?? 'id',
        })
      }
    }
  }

  private async getTransformedDocuments(indexKey: string, documents: any[], options?: TransformOptions) {
    if (!documents?.length) {
      return []
    }

    const indexConfig = (this.config_.settings || {})[indexKey]

    switch (indexConfig?.type) {
      case SearchUtils.indexTypes.PRODUCTS:
        return Promise.all(
          documents.map(
            (doc) => indexConfig.transformer?.(doc, transformProduct, { ...options }) ?? transformProduct(doc, options),
          ),
        )

      case 'categories':
        return Promise.all(
          documents.map(
            (doc) =>
              indexConfig.transformer?.(doc, transformCategory, { ...options }) ?? transformCategory(doc, options),
          ),
        )

      default:
        return documents
    }
  }

  /**
   * Get embedder configuration status for admin panel
   * Delegates to the embedder service
   */
  async getVectorSearchStatus() {
    return this.embedder_.getVectorSearchStatus()
  }
}
