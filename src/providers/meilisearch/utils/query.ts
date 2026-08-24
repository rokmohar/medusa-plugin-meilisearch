import type { SearchTypes } from '@medusajs/types'
import { MedusaError } from '@medusajs/utils'
import type {
  MultiSearchQuery,
  MultiSearchResult,
  SearchForFacetValuesParams,
  SearchForFacetValuesResponse,
} from 'meilisearch'
import { shadowAttribute, stripShadowAttributes } from './documents'
import { compileFilters } from './filters'
import type { IndexPlan } from './settings'

export type MeiliHit = Record<string, unknown> & { _formatted?: Record<string, unknown>; _rankingScore?: number }
export type MeiliResult = MultiSearchResult<MeiliHit>

export interface FacetSearchRequest {
  field: string
  params: SearchForFacetValuesParams
}

export interface QueryPlan {
  index: string
  queries: MultiSearchQuery[]
  facetSearches: FacetSearchRequest[]
  assemble(results: MeiliResult[], facetResults: SearchForFacetValuesResponse[]): SearchTypes.SearchResult
}

const DEFAULT_TAKE = 20
const DEFAULT_SEMANTIC_RATIO = 0.5

export function planSearch(input: SearchTypes.ProviderSearchQuery, plan: IndexPlan): QueryPlan {
  const options = input.search_options ?? {}
  const pagination = input.pagination ?? {}

  if (pagination.cursor !== undefined) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Meilisearch paginates by offset, not by cursor. Use `pagination.skip` and `pagination.take`.',
    )
  }

  if (options.typo_tolerance !== undefined) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Meilisearch configures typo tolerance per index, not per query. Declare it as `settings.typo_tolerance` on the index definition.',
    )
  }

  if (options.match_strategy === 'any') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Meilisearch has no "any" matching strategy. Use "all" or "last".',
    )
  }

  if (input.q && !plan.searchableAttributes.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Index "${input.index.name}" declares no searchable fields, so it cannot answer a text query.`,
    )
  }

  const isDateAttribute = (path: string): boolean => {
    return plan.dateAttributes.has(path)
  }

  const skip = pagination.skip ?? 0
  const take = pagination.take ?? DEFAULT_TAKE
  const filter = compileFilters(input.filters, isDateAttribute)
  const facets = normalizeFacets(options.facets)
  const valueFacets = facets.filter(isValueFacet)
  const rangeFacets = facets.filter(isRangeFacet)
  const statsFacets = facets.filter(isStatsFacet)
  const countStrategy = options.count ?? 'estimated'
  const requestedAttributes = input.attributes_to_retrieve
  const attributesToRetrieve = withPrimaryKey(requestedAttributes, plan.primaryKey)

  const base: MultiSearchQuery = {
    indexUid: plan.name,
    q: input.q ?? '',
    offset: skip,
    limit: take,
    attributesToRetrieve,
  }

  if (filter) {
    base.filter = filter
  }

  const sort = buildSort(pagination.order, isDateAttribute)

  if (sort.length) {
    base.sort = sort
  }

  const distributionFields = [
    ...valueFacets.map((facet) => {
      return facet.field
    }),
    ...statsFacets.map((facet) => {
      return facet.field
    }),
  ]

  if (distributionFields.length) {
    base.facets = [...new Set(distributionFields)]
  }

  if (options.attributes_to_search_on) {
    for (const attribute of options.attributes_to_search_on) {
      if (!plan.searchableAttributes.includes(attribute)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `"${attribute}" is not searchable on index "${input.index.name}".`,
        )
      }
    }

    base.attributesToSearchOn = options.attributes_to_search_on
  }

  if (options.match_strategy) {
    base.matchingStrategy = options.match_strategy === 'last' ? 'last' : 'all'
  }

  if (options.distinct !== undefined) {
    base.distinct = options.distinct
  }

  if (options.min_score !== undefined) {
    base.rankingScoreThreshold = options.min_score
  }

  if (options.include_score) {
    base.showRankingScore = true
  }

  const locales = options.locales ?? input.index.settings.locales

  if (locales?.length) {
    base.locales = locales.map(toEngineLocaleTag)
  }

  const highlight = options.highlight

  if (highlight?.fields.length) {
    base.attributesToHighlight = highlight.fields
    base.highlightPreTag = highlight.pre_tag ?? '<mark>'
    base.highlightPostTag = highlight.post_tag ?? '</mark>'

    if (highlight.snippet) {
      base.attributesToCrop = highlight.fields

      if (typeof highlight.snippet === 'object') {
        base.cropLength = highlight.snippet.length
      }
    }
  }

  if (options.vector) {
    applyVector(base, options.vector, input.q)
  }

  Object.assign(base, readProviderOverrides(options.provider_options))

  const queries: MultiSearchQuery[] = [base]
  const rangeSlots: { field: string; key: string; from?: number | string; to?: number | string; slot: number }[] = []
  const statsSlots: { field: string; slot: number }[] = []
  let countSlot: number | undefined

  if (countStrategy === 'exact') {
    countSlot = queries.length
    queries.push(countQuery(base))
  }

  for (const facet of rangeFacets) {
    for (const range of facet.ranges) {
      rangeSlots.push({
        field: facet.field,
        key: range.key ?? `${range.from ?? '*'}-${range.to ?? '*'}`,
        from: range.from,
        to: range.to,
        slot: queries.length,
      })
      queries.push(rangeQuery(base, facet.field, range, filter, isDateAttribute(facet.field)))
    }
  }

  for (const facet of statsFacets) {
    statsSlots.push({ field: facet.field, slot: queries.length })
    queries.push(existsQuery(base, facet.field, filter, isDateAttribute(facet.field)))
  }

  const facetSearches: FacetSearchRequest[] = valueFacets
    .filter((facet) => {
      return facet.query !== undefined
    })
    .map((facet) => {
      return {
        field: facet.field,
        params: {
          facetName: facet.field,
          facetQuery: facet.query,
          q: input.q ?? '',
          filter,
        },
      }
    })

  const assemble = (results: MeiliResult[], facetResults: SearchForFacetValuesResponse[]): SearchTypes.SearchResult => {
    const primary = results.at(0)

    if (!primary) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, 'Meilisearch returned no result for the query.')
    }

    const facetOutput: Record<string, SearchTypes.SearchFacetResult> = {}
    let searchedFacets = 0

    for (const facet of valueFacets) {
      if (facet.query !== undefined) {
        const searched = facetResults.at(searchedFacets++)

        facetOutput[facet.field] = {
          type: 'value',
          values: (searched?.facetHits ?? []).slice(0, facet.limit).map((hit) => {
            return { value: hit.value, count: hit.count }
          }),
        }

        continue
      }

      facetOutput[facet.field] = buildValueFacet(primary.facetDistribution?.[facet.field], facet)
    }

    for (const facet of rangeFacets) {
      facetOutput[facet.field] = {
        type: 'range',
        ranges: rangeSlots
          .filter((slot) => {
            return slot.field === facet.field
          })
          .map((slot) => {
            return {
              key: slot.key,
              from: slot.from,
              to: slot.to,
              count: exhaustiveCount(results[slot.slot]) ?? 0,
            }
          }),
      }
    }

    for (const { field, slot } of statsSlots) {
      const stats = primary.facetStats?.[field]

      facetOutput[field] = {
        type: 'stats',
        min: stats?.min ?? 0,
        max: stats?.max ?? 0,
        count: exhaustiveCount(results[slot]) ?? 0,
      }
    }

    const count =
      countStrategy === 'none'
        ? null
        : countStrategy === 'exact' && countSlot !== undefined
          ? (exhaustiveCount(results[countSlot]) ?? null)
          : (primary.estimatedTotalHits ?? primary.totalHits ?? null)

    return {
      hits: primary.hits.map((hit) => {
        return toSearchHit(hit, plan.primaryKey, requestedAttributes, highlight)
      }),
      facets: Object.keys(facetOutput).length ? facetOutput : undefined,
      metadata: {
        skip,
        take,
        count,
        query: input.q,
        processing_time_ms: primary.processingTimeMs,
      },
    }
  }

  return { index: plan.name, queries, facetSearches, assemble }
}

function toSearchHit(
  hit: MeiliHit,
  primaryKey: string,
  requestedAttributes: string[],
  highlight: SearchTypes.SearchHighlightOptions | undefined,
): SearchTypes.SearchHit {
  const { _formatted, _rankingScore, ...rest } = hit
  const document = stripShadowAttributes(rest)

  if (!requestedAttributes.includes(primaryKey)) {
    delete document[primaryKey]
  }

  return {
    id: String(hit[primaryKey]),
    score: _rankingScore,
    document,
    highlights: buildHighlights(_formatted, highlight),
  }
}

function buildHighlights(
  formatted: Record<string, unknown> | undefined,
  highlight: SearchTypes.SearchHighlightOptions | undefined,
): Record<string, string[]> | undefined {
  if (!formatted || !highlight?.fields.length) {
    return undefined
  }

  const preTag = highlight.pre_tag ?? '<mark>'
  const highlights: Record<string, string[]> = {}

  for (const field of highlight.fields) {
    const value = readPath(formatted, field)
    const fragments = (Array.isArray(value) ? value : [value]).filter((entry): entry is string => {
      return typeof entry === 'string' && entry.includes(preTag)
    })

    if (fragments.length) {
      highlights[field] = fragments
    }
  }

  return Object.keys(highlights).length ? highlights : undefined
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  let current: unknown = source

  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      current = current.map((entry) => {
        return isRecord(entry) ? entry[segment] : undefined
      })

      continue
    }

    if (!isRecord(current)) {
      return undefined
    }

    current = current[segment]
  }

  return current
}

function buildValueFacet(
  distribution: Record<string, number> | undefined,
  facet: ValueFacet,
): SearchTypes.SearchFacetResult {
  const entries = Object.entries(distribution ?? {}).map(([value, count]) => {
    return { value, count }
  })

  entries.sort((a, b) => {
    return facet.sort === 'alpha' ? a.value.localeCompare(b.value) : b.count - a.count || a.value.localeCompare(b.value)
  })

  const values = facet.limit === undefined ? entries : entries.slice(0, facet.limit)
  const otherCount = entries.slice(values.length).reduce((total, entry) => {
    return total + entry.count
  }, 0)

  return { type: 'value', values, other_count: otherCount ? otherCount : undefined }
}

function countQuery(base: MultiSearchQuery): MultiSearchQuery {
  const { offset: _offset, limit: _limit, facets: _facets, ...rest } = base

  return { ...rest, page: 1, hitsPerPage: 1 }
}

function rangeQuery(
  base: MultiSearchQuery,
  field: string,
  range: { from?: number | string; to?: number | string },
  filter: string | undefined,
  isDate: boolean,
): MultiSearchQuery {
  const target = isDate ? shadowAttribute(field) : field
  const bounds: string[] = []

  if (range.from !== undefined) {
    bounds.push(`${target} >= ${rangeLiteral(range.from, isDate)}`)
  }

  if (range.to !== undefined) {
    bounds.push(`${target} < ${rangeLiteral(range.to, isDate)}`)
  }

  return withFilter(countQuery(base), [filter, ...bounds])
}

function existsQuery(
  base: MultiSearchQuery,
  field: string,
  filter: string | undefined,
  isDate: boolean,
): MultiSearchQuery {
  const target = isDate ? shadowAttribute(field) : field

  return withFilter(countQuery(base), [filter, `${target} EXISTS`])
}

function withFilter(query: MultiSearchQuery, clauses: (string | undefined)[]): MultiSearchQuery {
  const present = clauses.filter((clause): clause is string => {
    return Boolean(clause)
  })

  if (!present.length) {
    return query
  }

  return { ...query, filter: present.length === 1 ? present[0] : `(${present.join(' AND ')})` }
}

function rangeLiteral(value: number | string, isDate: boolean): string {
  if (typeof value === 'number') {
    return String(value)
  }

  if (isDate) {
    const parsed = Date.parse(value)

    if (!Number.isNaN(parsed)) {
      return String(parsed)
    }
  }

  return `"${value.replace(/"/g, '\\"')}"`
}

function applyVector(base: MultiSearchQuery, vector: SearchTypes.SearchVectorOptions, q: string | undefined): void {
  if (vector.query !== undefined && q !== undefined && vector.query !== q) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'Meilisearch embeds the search query itself, so `search_options.vector.query` must match the text query.',
    )
  }

  if (vector.query !== undefined) {
    base.q = vector.query
  }

  if (vector.value) {
    base.vector = vector.value
  }

  base.hybrid = { embedder: vector.field, semanticRatio: vector.semantic_ratio ?? DEFAULT_SEMANTIC_RATIO }
}

function buildSort(
  order: Record<string, SearchTypes.SearchOrderBy> | undefined,
  isDateAttribute: (path: string) => boolean,
): string[] {
  if (!order) {
    return []
  }

  const sort: string[] = []

  for (const [field, direction] of Object.entries(order)) {
    if (field === '_score') {
      if (direction === 'ASC') {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          'Meilisearch ranks by descending relevance and cannot invert it.',
        )
      }

      continue
    }

    sort.push(`${isDateAttribute(field) ? shadowAttribute(field) : field}:${direction.toLowerCase()}`)
  }

  return sort
}

function withPrimaryKey(attributes: string[], primaryKey: string): string[] {
  return attributes.includes(primaryKey) ? attributes : [primaryKey, ...attributes]
}

function exhaustiveCount(result: MeiliResult | undefined): number | undefined {
  return result?.totalHits
}

function toEngineLocaleTag(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase()
}

function readProviderOverrides(
  providerOptions: Record<string, Record<string, unknown>> | undefined,
): Record<string, unknown> {
  const overrides = providerOptions?.meilisearch

  return isRecord(overrides) ? overrides : {}
}

interface ValueFacet {
  field: string
  type: 'value'
  limit?: number
  sort?: 'count' | 'alpha'
  query?: string
}

interface RangeFacet {
  field: string
  type: 'range'
  ranges: { key?: string; from?: number | string; to?: number | string }[]
}

interface StatsFacet {
  field: string
  type: 'stats'
}

function normalizeFacets(
  facets: (string | SearchTypes.SearchFacetRequest)[] | undefined,
): (ValueFacet | RangeFacet | StatsFacet)[] {
  if (!facets) {
    return []
  }

  return facets.map((facet) => {
    if (typeof facet === 'string') {
      return { field: facet, type: 'value' }
    }

    if (facet.type === 'range') {
      return { field: facet.field, type: 'range', ranges: facet.ranges }
    }

    if (facet.type === 'stats') {
      return { field: facet.field, type: 'stats' }
    }

    return { field: facet.field, type: 'value', limit: facet.limit, sort: facet.sort, query: facet.query }
  })
}

function isValueFacet(facet: ValueFacet | RangeFacet | StatsFacet): facet is ValueFacet {
  return facet.type === 'value'
}

function isRangeFacet(facet: ValueFacet | RangeFacet | StatsFacet): facet is RangeFacet {
  return facet.type === 'range'
}

function isStatsFacet(facet: ValueFacet | RangeFacet | StatsFacet): facet is StatsFacet {
  return facet.type === 'stats'
}

function isRecord(value: unknown): value is Record<string, never> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
