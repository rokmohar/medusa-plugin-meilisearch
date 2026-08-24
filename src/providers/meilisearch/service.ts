import type { Logger, SearchTypes } from '@medusajs/types'
import { AbstractSearchProviderService, MedusaError } from '@medusajs/utils'
import {
  MeiliSearch,
  MeiliSearchApiError,
  type Index,
  type MultiSearchParams,
  type MultiSearchQuery,
  type SearchForFacetValuesResponse,
} from 'meilisearch'
import {
  MEILISEARCH_PROVIDER_IDENTIFIER,
  type MeilisearchProviderDependencies,
  type MeilisearchProviderOptions,
} from './types'
import { encodeDocument } from './utils/documents'
import { compileFilters, extractPrimaryKeyIds } from './utils/filters'
import { planSearch, type MeiliHit, type MeiliResult, type QueryPlan } from './utils/query'
import { assertIndexSupported, buildIndexPlan } from './utils/settings'
import { fromEnqueuedTask, fromSettledTask } from './utils/tasks'

const INDEX_NOT_FOUND = 'index_not_found'
const DEFAULT_TASK_TIMEOUT_MS = 120_000
const DEFAULT_TASK_POLLING_INTERVAL_MS = 500

export class MeilisearchSearchProviderService extends AbstractSearchProviderService {
  static override identifier = MEILISEARCH_PROVIDER_IDENTIFIER

  protected readonly logger_?: Logger
  protected readonly options_: MeilisearchProviderOptions
  protected readonly client_: MeiliSearch
  protected readonly primaryKeys_ = new Map<string, string>()

  constructor({ logger }: MeilisearchProviderDependencies, options: MeilisearchProviderOptions) {
    super()

    assertProviderOptions(options)

    this.logger_ = logger
    this.options_ = options
    this.client_ = new MeiliSearch(options.config)
  }

  override async upsertIndex({
    index,
  }: {
    index: SearchTypes.ResolvedSearchIndexDefinition
  }): Promise<SearchTypes.SearchTask> {
    assertIndexSupported(index)

    const plan = buildIndexPlan(index, this.options_)

    await this.ensureIndex(plan.name, plan.primaryKey)

    return fromEnqueuedTask(await this.client_.index(plan.name).updateSettings(plan.settings))
  }

  override async deleteIndex({ index }: { index: string }): Promise<SearchTypes.SearchTask> {
    this.primaryKeys_.delete(index)

    return fromEnqueuedTask(await this.client_.deleteIndex(index))
  }

  override async listIndexes(): Promise<SearchTypes.SearchIndexInfo[]> {
    const [stats, indexes] = await Promise.all([this.client_.getStats(), this.client_.getRawIndexes({ limit: 1000 })])

    return indexes.results.map((index) => {
      return {
        name: index.uid,
        provider: MEILISEARCH_PROVIDER_IDENTIFIER,
        document_count: Object.hasOwn(stats.indexes, index.uid) ? stats.indexes[index.uid].numberOfDocuments : 0,
        created_at: new Date(index.createdAt),
        updated_at: new Date(index.updatedAt),
      }
    })
  }

  async swapIndex({ alias, index }: { alias: string; index: string }): Promise<SearchTypes.SearchTask> {
    await this.ensureIndex(alias, await this.primaryKeyOf(this.client_.index(index)))

    const swap = await this.client_.swapIndexes([{ indexes: [alias, index], rename: false }])
    const settled = await this.waitForTask(fromEnqueuedTask(swap))

    if (settled.status === 'succeeded') {
      await this.deleteIndex({ index })
    }

    return settled
  }

  override async upsertDocuments({
    index,
    documents,
  }: {
    index: string
    documents: SearchTypes.SearchDocument[]
  }): Promise<SearchTypes.SearchTask> {
    return fromEnqueuedTask(await this.client_.index(index).addDocuments(documents.map(encodeDocument)))
  }

  override async deleteDocuments({
    index,
    filters,
  }: SearchTypes.SearchDeleteDocumentsInput): Promise<SearchTypes.SearchTask> {
    const target = this.client_.index(index)
    const ids = extractPrimaryKeyIds(filters, await this.primaryKeyOf(target))

    if (ids) {
      return fromEnqueuedTask(await target.deleteDocuments(ids))
    }

    const filter = compileFilters(filters)

    if (!filter) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Deleting from Meilisearch index "${index}" requires filters that select something.`,
      )
    }

    return fromEnqueuedTask(await target.deleteDocuments({ filter }))
  }

  override async clearIndex({ index }: { index: string }): Promise<SearchTypes.SearchTask> {
    return fromEnqueuedTask(await this.client_.index(index).deleteAllDocuments())
  }

  override async search(input: SearchTypes.ProviderSearchQuery): Promise<SearchTypes.SearchResult> {
    const [result] = await this.searchMany([input])

    return result
  }

  async searchMany(inputs: SearchTypes.ProviderSearchQuery[]): Promise<SearchTypes.SearchResult[]> {
    if (!inputs.length) {
      return []
    }

    const plans = inputs.map((input) => {
      return planSearch(input, buildIndexPlan(input.index, this.options_))
    })

    const queries: MultiSearchQuery[] = plans.flatMap((plan) => {
      return plan.queries
    })

    const [results, facetResults] = await Promise.all([
      this.runQueries(queries),
      Promise.all(
        plans.flatMap((plan) => {
          return plan.facetSearches.map(async (request) => {
            return this.client_.index(plan.index).searchForFacetValues(request.params)
          })
        }),
      ),
    ])

    let queryOffset = 0
    let facetOffset = 0

    return plans.map((plan) => {
      const slice = results.slice(queryOffset, queryOffset + plan.queries.length)
      const facetSlice = facetResults.slice(facetOffset, facetOffset + plan.facetSearches.length)

      queryOffset += plan.queries.length
      facetOffset += plan.facetSearches.length

      return plan.assemble(slice, facetSlice)
    })
  }

  async waitForTask(task: SearchTypes.SearchTask, options?: { timeout_ms?: number }): Promise<SearchTypes.SearchTask> {
    if (task.id === undefined) {
      return task
    }

    const settled = await this.client_.tasks.waitForTask(Number(task.id), {
      timeout: options?.timeout_ms ?? this.options_.task_timeout_ms ?? DEFAULT_TASK_TIMEOUT_MS,
      interval: this.options_.task_polling_interval_ms ?? DEFAULT_TASK_POLLING_INTERVAL_MS,
    })

    return fromSettledTask(settled)
  }

  protected async runQueries(queries: MultiSearchQuery[]): Promise<MeiliResult[]> {
    const { results } = await this.client_.multiSearch<MultiSearchParams, MeiliHit>({ queries })

    return results
  }

  protected async ensureIndex(index: string, primaryKey: string): Promise<void> {
    const existing = await this.retrieveIndex(index)

    this.primaryKeys_.set(index, primaryKey)

    if (existing && existing.primaryKey !== primaryKey) {
      await this.client_.tasks.waitForTask(await this.client_.deleteIndex(index))
    } else if (existing) {
      return
    }

    await this.client_.tasks.waitForTask(await this.client_.createIndex(index, { primaryKey }))
  }

  protected async retrieveIndex(index: string): Promise<{ primaryKey?: string } | undefined> {
    try {
      return await this.client_.getRawIndex(index)
    } catch (error) {
      if (error instanceof MeiliSearchApiError && error.cause?.code === INDEX_NOT_FOUND) {
        return undefined
      }

      throw error
    }
  }

  protected async primaryKeyOf(index: Index): Promise<string> {
    const cached = this.primaryKeys_.get(index.uid)

    if (cached !== undefined) {
      return cached
    }

    const primaryKey = (await index.fetchPrimaryKey()) ?? 'id'

    this.primaryKeys_.set(index.uid, primaryKey)

    return primaryKey
  }
}

function assertProviderOptions(options: unknown): asserts options is MeilisearchProviderOptions {
  const config = isRecord(options) ? options.config : undefined

  if (!isRecord(config) || typeof config.host !== 'string' || !config.host) {
    throw new MedusaError(
      MedusaError.Types.INVALID_ARGUMENT,
      'The Meilisearch search provider requires a "config.host" option.',
    )
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type { QueryPlan, SearchForFacetValuesResponse }

export default MeilisearchSearchProviderService
