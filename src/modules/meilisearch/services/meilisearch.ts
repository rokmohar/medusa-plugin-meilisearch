import { SearchTypes } from '@medusajs/types'
import { SearchUtils } from '@medusajs/utils'
import { MeiliSearch, Settings } from 'meilisearch'
import { meilisearchErrorCodes, MeilisearchPluginOptions } from '../types'
import { transformProduct } from '../utils/transformer'

export class MeiliSearchService extends SearchUtils.AbstractSearchService {
  static identifier = 'index-meilisearch'

  isDefault = false

  protected readonly config_: MeilisearchPluginOptions
  protected readonly client_: MeiliSearch

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
  }

  async getIndexesByType(type: string) {
    return Object.entries(this.config_.settings || {})
      .filter(([, config]) => config.type === type && config.enabled !== false)
      .map(([key]) => key)
  }

  async createIndex(indexKey: string, options: Record<string, unknown> = { primaryKey: 'id' }) {
    return await this.client_.createIndex(indexKey, options)
  }

  getIndex(indexKey: string) {
    return this.client_.index(indexKey)
  }

  async addDocuments(indexKey: string, documents: any, type: string) {
    const transformedDocuments = this.getTransformedDocuments(type, documents)
    return await this.client_.index(indexKey).addDocuments(transformedDocuments, { primaryKey: 'id' })
  }

  async replaceDocuments(indexKey: string, documents: any, type: string) {
    const transformedDocuments = this.getTransformedDocuments(type, documents)
    return await this.client_.index(indexKey).addDocuments(transformedDocuments, { primaryKey: 'id' })
  }

  async deleteDocument(indexKey: string, documentId: string) {
    return await this.client_.index(indexKey).deleteDocument(documentId)
  }

  async deleteDocuments(indexKey: string, documentIds: string[]) {
    return await this.client_.index(indexKey).deleteDocuments(documentIds)
  }

  async deleteAllDocuments(indexKey: string) {
    return await this.client_.index(indexKey).deleteAllDocuments()
  }

  async search(indexKey: string, query: string, options: Record<string, any>) {
    const { paginationOptions, filter, additionalOptions } = options
    return await this.client_.index(indexKey).search(query, { filter, ...paginationOptions, ...additionalOptions })
  }

  async updateSettings(indexKey: string, settings: SearchTypes.IndexSettings & Settings) {
    const indexConfig = this.config_.settings?.[indexKey]
    if (indexConfig?.enabled === false) {
      return
    }
    await this.upsertIndex(indexKey, settings)
    return await this.client_.index(indexKey).updateSettings(settings.indexSettings ?? {})
  }

  async upsertIndex(indexKey: string, settings: SearchTypes.IndexSettings) {
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

  getTransformedDocuments(type: string, documents: any[]) {
    if (!documents?.length) {
      return []
    }

    const indexConfig = Object.entries(this.config_.settings || {}).find(([, config]) => config.type === type)?.[1]
    return !indexConfig || type !== SearchUtils.indexTypes.PRODUCTS ? documents : documents.map(transformProduct)
  }
}
