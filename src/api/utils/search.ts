import type { MedusaRequest } from '@medusajs/framework'
import type { SearchTypes } from '@medusajs/types'
import { MedusaError, Modules, ProductStatus } from '@medusajs/utils'
import z from 'zod'
import { readIndexLocales } from '../../indexes/locales'
import { compileFilters } from '../../providers/meilisearch/utils/filters'
import { getRegisteredSearchIndexes } from './medusa'

export interface MeiliHitsEnvelope {
  hits: Record<string, unknown>[]
  query: string
  processingTimeMs: number
  estimatedTotalHits: number
  limit: number
  offset: number
  facets?: Record<string, SearchTypes.SearchFacetResult>
  hybridSearch?: boolean
  semanticRatio?: number
}

export interface SearchRequestParams {
  query?: string
  index?: string
  limit?: number
  offset?: number
  language?: string
  semanticSearch: boolean
  semanticRatio: number
  embedder?: string
  filter?: string
  sort?: string
  facets?: string[]
  fields?: string[]
}

const DEFAULT_EMBEDDER = 'default'
const PRODUCT_ENTITY = 'product'
const DEFAULT_LIMIT = 20

export const HitsSearchSchema = z.object({
  query: z.string(),
  index: z.string().optional(),
  limit: z.coerce.number().default(10),
  offset: z.coerce.number().default(0),
  language: z.string().optional(),
  semanticSearch: z.union([z.boolean(), z.stringbool()]).default(false),
  semanticRatio: z.coerce.number().min(0).max(1).default(0.5),
  embedder: z.string().optional(),
  filter: z.string().optional(),
  sort: z.union([z.string(), z.array(z.string())]).optional(),
  facets: z.union([z.string(), z.array(z.string())]).optional(),
  fields: z.string().optional(),
})

export type HitsSearchParams = z.infer<typeof HitsSearchSchema>

export function toSearchRequestParams(params: HitsSearchParams): SearchRequestParams {
  return {
    query: params.query,
    index: params.index,
    limit: params.limit,
    offset: params.offset,
    language: params.language,
    semanticSearch: params.semanticSearch,
    semanticRatio: params.semanticRatio,
    embedder: params.embedder,
    filter: params.filter,
    sort: Array.isArray(params.sort) ? params.sort.join(',') : params.sort,
    facets: toStringArray(params.facets),
    fields: toStringArray(params.fields),
  }
}

export function resolveSearchModule(req: MedusaRequest): SearchTypes.ISearchModuleService {
  const searchModule = req.scope.resolve<SearchTypes.ISearchModuleService | undefined>(Modules.SEARCH, {
    allowUnregistered: true,
  })

  if (!searchModule) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'The Search Module is not registered. Add it to `modules` in medusa-config with the Meilisearch provider, ' +
        'then declare an index under `src/search`.',
    )
  }

  return searchModule
}

export function toIndexNames(indexes: ReadonlyArray<string | { name: string }>): string[] {
  return indexes.map((index) => {
    return typeof index === 'string' ? index : index.name
  })
}

export type SearchIndexLister = {
  listIndexes(): ReadonlyArray<string | { name: string }> | Promise<ReadonlyArray<string | { name: string }>>
}

export async function resolveSearchIndexName(input: {
  searchModule: SearchIndexLister
  entity: string
  locale?: string
  explicitIndex?: string
}): Promise<string> {
  const registered = toIndexNames(await input.searchModule.listIndexes())

  if (input.explicitIndex) {
    if (!registered.includes(input.explicitIndex)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown search index "${input.explicitIndex}". Registered indexes: ${registered.join(', ') || 'none'}.`,
      )
    }

    return input.explicitIndex
  }

  const candidates = getRegisteredSearchIndexes().filter((definition) => {
    return definition.entity === input.entity && registered.includes(definition.name)
  })

  if (!candidates.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `No search index is registered for "${input.entity}". Declare one under \`src/search\` with the factories from ` +
        `@rokmohar/medusa-plugin-meilisearch/indexes.`,
    )
  }

  const localized = input.locale ? matchLocale(candidates, input.locale) : undefined

  if (localized) {
    return localized.name
  }

  const fallback = candidates.find((definition) => {
    return !readIndexLocales(definition.settings)?.length
  })

  return (fallback ?? candidates[0]).name
}

function matchLocale(
  candidates: SearchTypes.SearchIndexDefinition[],
  locale: string,
): SearchTypes.SearchIndexDefinition | undefined {
  const exact = candidates.find((definition) => {
    return readIndexLocales(definition.settings)?.includes(locale)
  })

  if (exact) {
    return exact
  }

  const language = toLanguage(locale)

  return candidates.find((definition) => {
    return readIndexLocales(definition.settings)?.some((entry) => {
      return toLanguage(entry) === language
    })
  })
}

function toLanguage(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase()
}

export function findSearchIndexDefinition(name: string): SearchTypes.SearchIndexDefinition | undefined {
  return getRegisteredSearchIndexes().find((definition) => {
    return definition.name === name
  })
}

export function buildSearchOptions(input: {
  definition?: SearchTypes.SearchIndexDefinition
  params: SearchRequestParams
  includeScore?: boolean
}): SearchTypes.SearchOptions {
  const { params, definition } = input
  const options: SearchTypes.SearchOptions = {}
  const providerOptions: Record<string, unknown> = {}

  if (input.includeScore) {
    options.include_score = true
  }

  if (params.facets?.length) {
    options.facets = params.facets
  }

  if (params.filter) {
    providerOptions.filter = params.filter
  }

  if (params.sort) {
    providerOptions.sort = params.sort.split(',').map((entry) => {
      return entry.trim()
    })
  }

  if (params.semanticSearch && params.semanticRatio > 0) {
    // A named embedder runs a hybrid search even when the index also holds a vector field.
    const vector = params.embedder ? undefined : findVectorField(definition)

    if (vector) {
      if (!vector.field.embed) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Search index "${definition?.name}" holds pre-computed embeddings in "${vector.path}", so semanticSearch ` +
            'has no vector to compare them with. Search it from code with `search_options.vector.value`.',
        )
      }

      if (!params.query) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `semanticSearch on search index "${definition?.name}" needs a query to embed.`,
        )
      }

      options.vector = { field: vector.path, query: params.query, semantic_ratio: params.semanticRatio }
    } else {
      providerOptions.hybrid = {
        embedder: params.embedder ?? findEmbedderName(definition) ?? DEFAULT_EMBEDDER,
        semanticRatio: params.semanticRatio,
      }
    }
  }

  if (Object.keys(providerOptions).length) {
    options.provider_options = { meilisearch: providerOptions }
  }

  return options
}

export function findVectorField(
  definition: SearchTypes.SearchIndexDefinition | undefined,
): { path: string; field: SearchTypes.SearchFieldDefinition } | undefined {
  if (!definition) {
    return undefined
  }

  const entry = Object.entries(definition.fields).find(([, field]) => {
    return field.type === 'vector'
  })

  return entry ? { path: entry[0], field: entry[1] } : undefined
}

/**
 * Mirrors the scope native `POST /store/search` puts on product indexes: published products in the publishable key's
 * sales channels, for each of the two fields the index declares filterable.
 */
export function productScopeFilters(
  definition: SearchTypes.SearchIndexDefinition | undefined,
  salesChannelIds: string[] | undefined,
): SearchTypes.SearchFilters {
  const filters: SearchTypes.SearchFilters = {}

  if (definition?.entity !== PRODUCT_ENTITY) {
    return filters
  }

  const fields: Partial<Record<string, SearchTypes.SearchFieldDefinition>> = definition.fields

  if (fields.status?.filterable === true) {
    filters.status = ProductStatus.PUBLISHED
  }

  if (salesChannelIds?.length && fields.sales_channel_ids?.filterable === true) {
    filters.sales_channel_ids = salesChannelIds
  }

  return filters
}

export function findEmbedderName(definition: SearchTypes.SearchIndexDefinition | undefined): string | undefined {
  const providerOptions: unknown = definition?.settings?.provider_options?.meilisearch

  if (!isRecord(providerOptions)) {
    return undefined
  }

  const embedders: unknown = providerOptions.embedders

  if (!isRecord(embedders)) {
    return undefined
  }

  return Object.keys(embedders)[0]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function runHitsSearch(
  req: MedusaRequest,
  entity: string,
  params: SearchRequestParams,
): Promise<MeiliHitsEnvelope> {
  const searchModule = resolveSearchModule(req)
  const index = await resolveSearchIndexName({
    searchModule,
    entity,
    locale: params.language ?? req.locale,
    explicitIndex: params.index,
  })
  const definition = findSearchIndexDefinition(index)

  const result = await searchModule.search({
    entity: index,
    fields: params.fields,
    filters: { q: params.query ?? '' },
    pagination: { skip: params.offset ?? 0, take: params.limit ?? DEFAULT_LIMIT },
    search_options: buildSearchOptions({ definition, params, includeScore: true }),
  })

  return toHitsEnvelope(result, params)
}

export function toHitsEnvelope(result: SearchTypes.SearchResult, params: SearchRequestParams): MeiliHitsEnvelope {
  const hybrid = params.semanticSearch && params.semanticRatio > 0

  return {
    hits: result.hits.map((hit) => {
      return hit.score === undefined ? { ...hit.document } : { ...hit.document, _score: hit.score }
    }),
    query: params.query ?? '',
    processingTimeMs: result.metadata.processing_time_ms ?? 0,
    estimatedTotalHits: result.metadata.count ?? result.hits.length,
    limit: params.limit ?? DEFAULT_LIMIT,
    offset: params.offset ?? 0,
    facets: result.facets,
    hybridSearch: hybrid ? true : undefined,
    semanticRatio: hybrid ? params.semanticRatio : undefined,
  }
}

export async function searchDocumentIds(
  req: MedusaRequest,
  entity: string,
  params: SearchRequestParams,
  scope: { salesChannelIds?: string[] } = {},
): Promise<{ ids: string[]; count: number }> {
  const searchModule = resolveSearchModule(req)
  const index = await resolveSearchIndexName({
    searchModule,
    entity,
    locale: params.language ?? req.locale,
    explicitIndex: params.index,
  })
  const definition = findSearchIndexDefinition(index)
  const scopeFilters = productScopeFilters(definition, scope.salesChannelIds)
  // A raw filter replaces the structured ones in the provider, so the scope is ANDed into it as well.
  const scopeFilter = compileFilters(scopeFilters)
  const filter = params.filter && scopeFilter ? `(${params.filter}) AND ${scopeFilter}` : params.filter

  const result = await searchModule.search({
    entity: index,
    fields: ['id'],
    filters: { q: params.query ?? '', ...scopeFilters },
    pagination: { skip: params.offset ?? 0, take: params.limit ?? DEFAULT_LIMIT },
    search_options: buildSearchOptions({ definition, params: { ...params, filter } }),
  })

  return {
    ids: result.hits.map((hit) => {
      return hit.id
    }),
    count: result.metadata.count ?? result.hits.length,
  }
}

export function toStringArray(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined
  }

  const entries = (Array.isArray(value) ? value : value.split(',')).map((entry) => {
    return entry.trim()
  })

  return entries.filter((entry) => {
    return entry.length > 0
  })
}

/**
 * Narrows the engine's ids to an `id` filter already on the request (the products of the allowed sales channels, or ids
 * the caller asked for), keeping the engine's order.
 */
export function restrictIds(ids: string[], existing: unknown): string[] {
  const allowed = toIdSet(existing)

  return allowed
    ? ids.filter((id) => {
        return allowed.has(id)
      })
    : ids
}

function toIdSet(value: unknown): Set<string> | undefined {
  const ids = isRecord(value) && '$in' in value ? value.$in : value

  if (typeof ids === 'string') {
    return new Set([ids])
  }

  if (Array.isArray(ids)) {
    return new Set(
      ids.filter((id): id is string => {
        return typeof id === 'string'
      }),
    )
  }

  return undefined
}
