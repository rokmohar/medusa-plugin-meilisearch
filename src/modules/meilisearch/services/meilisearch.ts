import { DocumentsDeletionQuery, DocumentsIds, Meilisearch } from 'meilisearch'
import { SearchTypes } from '@medusajs/types'
import { SearchUtils } from '@medusajs/utils'
import { AddDocumentsOptions, meilisearchErrorCodes, MeilisearchPluginOptions } from '../types'
import { MeiliSearchEmbedder } from '../utils/embedder'
import { transformProduct, transformCategory, TransformOptions } from '../utils/transformer'

export class MeiliSearchService extends SearchUtils.AbstractSearchService {
  public static identifier = 'index-meilisearch'

  public isDefault = false

  protected readonly config_: MeilisearchPluginOptions
  protected readonly client_: Meilisearch
  protected readonly embedder_: MeiliSearchEmbedder

  // First arg is the awilix cradle for this module's local container, not a MedusaContainer.
  // Calls like `.resolve()` on it fail. Callers must supply the real container via AddDocumentsOptions.
  constructor(cradle: unknown, options: MeilisearchPluginOptions) {
    super(cradle, options)

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

    this.client_ = new Meilisearch(options.config)
    this.embedder_ = new MeiliSearchEmbedder(options, this.client_)
  }

  protected getLanguageIndexName(baseKey: string, language?: string): string {
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
      return baseIndexes.flatMap((baseIndex) => languages.map((lang) => this.getLanguageIndexName(baseIndex, lang)))
    }

    return baseIndexes
  }

  async createIndex(indexName: string, options: Record<string, any> = { primaryKey: 'id' }) {
    return this.client_.createIndex(indexName, options)
  }

  getIndex(indexName: string) {
    return this.client_.index(indexName)
  }

  async addDocuments(indexName: string, documents: any[], _type: string, options?: AddDocumentsOptions) {
    const { language, container } = options ?? {}
    const { i18n } = this.config_
    const i18nOptions: TransformOptions = {
      i18n,
      language,
      container,
    }

    if (i18n?.strategy === 'separate-index') {
      const langIndexName = this.getLanguageIndexName(indexName, language || i18n.defaultLanguage)
      const transformedDocuments = await this.getTransformedDocuments(indexName, documents, i18nOptions)
      return this.client_.index(langIndexName).addDocuments(transformedDocuments, { primaryKey: 'id' })
    } else {
      const transformedDocuments = await this.getTransformedDocuments(indexName, documents, i18nOptions)
      return this.client_.index(indexName).addDocuments(transformedDocuments, { primaryKey: 'id' })
    }
  }

  async replaceDocuments(indexName: string, documents: any[], type: string, options?: AddDocumentsOptions) {
    return this.addDocuments(indexName, documents, type, options)
  }

  async deleteDocument(indexName: string, documentId: string | number, language?: string) {
    const actualIndexName = this.getLanguageIndexName(indexName, language)
    return this.client_.index(actualIndexName).deleteDocument(documentId)
  }

  async deleteDocuments(indexName: string, documents: DocumentsDeletionQuery | DocumentsIds, language?: string) {
    const actualIndexName = this.getLanguageIndexName(indexName, language)
    return this.client_.index(actualIndexName).deleteDocuments(documents)
  }

  async deleteAllDocuments(indexName: string, language?: string) {
    const actualIndexName = this.getLanguageIndexName(indexName, language)
    return this.client_.index(actualIndexName).deleteAllDocuments()
  }

  async search(
    indexName: string,
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
    const actualIndexName = this.getLanguageIndexName(indexName, language)

    // Build base search options
    let searchOptions = {
      filter,
      ...paginationOptions,
      ...additionalOptions,
    }

    // Enhance with vector search if needed
    searchOptions = this.embedder_.enhanceSearchOptions(searchOptions, semanticSearch, semanticRatio)

    // Perform search
    return this.client_.index(actualIndexName).search(query, searchOptions)
  }

  async updateSettings(indexName: string, settings: Pick<SearchTypes.IndexSettings, 'indexSettings' | 'primaryKey'>) {
    const indexConfig = this.config_.settings?.[indexName]
    if (indexConfig?.enabled === false) {
      return
    }

    const { i18n } = this.config_

    if (i18n?.strategy === 'separate-index') {
      const { languages } = i18n
      return Promise.all(
        languages.map(async (lang) => {
          const langIndexName = this.getLanguageIndexName(indexName, lang)
          await this.upsertIndex(langIndexName, settings)
          await this.updateIndexSettings(langIndexName, settings.indexSettings ?? {})
          // Configure embedders for vector search
          if (this.embedder_.isVectorSearchEnabled()) {
            await this.embedder_.configureEmbedders(langIndexName)
          }
        }),
      )
    } else {
      await this.upsertIndex(indexName, settings)
      await this.updateIndexSettings(indexName, settings.indexSettings ?? {})
      // Configure embedders for vector search
      if (this.embedder_.isVectorSearchEnabled()) {
        await this.embedder_.configureEmbedders(indexName)
      }
      return
    }
  }

  private async updateIndexSettings(indexName: string, indexSettings: Record<string, any>) {
    return this.client_.index(indexName).updateSettings(indexSettings)
  }

  async upsertIndex(indexName: string, settings: Pick<SearchTypes.IndexSettings, 'primaryKey'>) {
    const indexConfig = this.config_.settings?.[indexName]
    if (indexConfig?.enabled === false) {
      return
    }
    try {
      await this.client_.getIndex(indexName)
    } catch (error) {
      if (error.code === meilisearchErrorCodes.INDEX_NOT_FOUND) {
        await this.createIndex(indexName, {
          primaryKey: settings.primaryKey ?? 'id',
        })
      }
    }
  }

  private async getTransformedDocuments(indexName: string, documents: any[], options?: TransformOptions) {
    if (!documents?.length) {
      return []
    }

    const indexConfig = (this.config_.settings || {})[indexName]

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
