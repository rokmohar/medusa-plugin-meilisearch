import type { SearchTypes } from '@medusajs/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { planSearch } from '../../src/providers/meilisearch/utils/query'
import { buildIndexPlan } from '../../src/providers/meilisearch/utils/settings'

const definition: SearchTypes.ResolvedSearchIndexDefinition = {
  name: 'products',
  entity: 'product',
  primary_key: 'id',
  provider: 'meilisearch',
  physical_name: 'products',
  definition_hash: 'hash',
  settings: {},
  fields: {
    id: { type: 'keyword', filterable: true },
    title: { type: 'text', searchable: { weight: 5 }, sortable: true },
    status: { type: 'keyword', filterable: true, facetable: true },
    price: { type: 'float', filterable: true, facetable: { types: ['range', 'stats'] } },
    created_at: { type: 'date', filterable: true, sortable: true },
  },
  seed: async function* () {},
}

const indexPlan = buildIndexPlan(definition, { config: { host: 'http://localhost:7700' } })

function query(overrides: Partial<SearchTypes.ProviderSearchQuery> = {}): SearchTypes.ProviderSearchQuery {
  return {
    index: definition,
    attributes_to_retrieve: ['title'],
    q: 'shirt',
    ...overrides,
  }
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    indexUid: 'products',
    hits: [{ id: 'prod_1', title: 'Shirt', created_at__ts: 1, _rankingScore: 0.9 }],
    processingTimeMs: 3,
    query: 'shirt',
    estimatedTotalHits: 7,
    ...overrides,
  }
}

describe('planSearch', () => {
  it('builds one query carrying pagination, filter and retrieved attributes', () => {
    const plan = planSearch(query({ filters: { status: 'published' }, pagination: { skip: 10, take: 5 } }), indexPlan)

    assert.equal(plan.queries.length, 1)
    assert.deepEqual(plan.queries[0], {
      indexUid: 'products',
      q: 'shirt',
      offset: 10,
      limit: 5,
      attributesToRetrieve: ['id', 'title'],
      filter: 'status = "published"',
    })
  })

  it('drops _score DESC from the sort and rewrites dates', () => {
    const plan = planSearch(query({ pagination: { order: { _score: 'DESC', created_at: 'ASC' } } }), indexPlan)

    assert.deepEqual(plan.queries[0].sort, ['created_at__ts:asc'])
  })

  it('adds an extra exhaustive query for an exact count', () => {
    const plan = planSearch(query({ search_options: { count: 'exact' } }), indexPlan)

    assert.equal(plan.queries.length, 2)
    assert.equal(plan.queries[1].hitsPerPage, 1)
    assert.equal(plan.queries[1].page, 1)

    const assembled = plan.assemble([result(), result({ totalHits: 42 })], [])

    assert.equal(assembled.metadata.count, 42)
  })

  it('reports a null count when none was asked for', () => {
    const plan = planSearch(query({ search_options: { count: 'none' } }), indexPlan)

    assert.equal(plan.assemble([result()], []).metadata.count, null)
  })

  it('turns range facets into one bounded query per bucket', () => {
    const plan = planSearch(
      query({
        search_options: {
          facets: [
            {
              field: 'price',
              type: 'range',
              ranges: [
                { key: 'cheap', to: 10 },
                { key: 'rest', from: 10 },
              ],
            },
          ],
        },
      }),
      indexPlan,
    )

    assert.equal(plan.queries.length, 3)
    assert.equal(plan.queries[1].filter, 'price < 10')
    assert.equal(plan.queries[2].filter, 'price >= 10')

    const facets = plan.assemble([result(), result({ totalHits: 2 }), result({ totalHits: 5 })], []).facets

    assert.deepEqual(facets?.price, {
      type: 'range',
      ranges: [
        { key: 'cheap', from: undefined, to: 10, count: 2 },
        { key: 'rest', from: 10, to: undefined, count: 5 },
      ],
    })
  })

  it('reads value facets from the distribution, sorted by count', () => {
    const plan = planSearch(query({ search_options: { facets: ['status'] } }), indexPlan)

    assert.deepEqual(plan.queries[0].facets, ['status'])

    const facets = plan.assemble([result({ facetDistribution: { status: { draft: 2, published: 9 } } })], []).facets

    assert.deepEqual(facets?.status, {
      type: 'value',
      values: [
        { value: 'published', count: 9 },
        { value: 'draft', count: 2 },
      ],
      other_count: undefined,
    })
  })

  it('facets date fields on their shadow and reports the values as dates', () => {
    const iso = '2026-01-02T03:04:05.000Z'
    const epoch = Date.parse(iso)
    const plan = planSearch(
      query({ search_options: { facets: ['created_at', { field: 'created_at', type: 'stats' }] } }),
      indexPlan,
    )

    assert.deepEqual(plan.queries[0].facets, ['created_at__ts'])
    assert.equal(plan.queries[1].filter, '(created_at__ts EXISTS AND created_at__ts IS NOT NULL)')

    const facets = plan.assemble(
      [
        result({
          facetDistribution: { created_at__ts: { [epoch]: 3 } },
          facetStats: { created_at__ts: { min: epoch, max: epoch } },
        }),
        result({ totalHits: 3 }),
      ],
      [],
    ).facets

    assert.deepEqual(facets?.created_at, { type: 'stats', min: epoch, max: epoch, count: 3 })

    const valuePlan = planSearch(query({ search_options: { facets: ['created_at'] } }), indexPlan)
    const values = valuePlan.assemble([result({ facetDistribution: { created_at__ts: { [epoch]: 3 } } })], []).facets

    assert.deepEqual(values?.created_at, { type: 'value', values: [{ value: iso, count: 3 }], other_count: undefined })
  })

  it('retrieves requested vector fields through _vectors', () => {
    const vectorDefinition = {
      ...definition,
      fields: { ...definition.fields, embedding: { type: 'vector' as const, dimensions: 3, retrievable: true } },
    }
    const plan = planSearch(
      query({ index: vectorDefinition, attributes_to_retrieve: ['title', 'embedding'] }),
      buildIndexPlan(vectorDefinition, { config: { host: 'http://localhost:7700' } }),
    )

    assert.equal(plan.queries[0].retrieveVectors, true)
    assert.deepEqual(plan.queries[0].attributesToRetrieve, ['id', 'title'])

    const hit = plan.assemble(
      [
        result({
          hits: [
            { id: 'prod_1', title: 'Shirt', _vectors: { embedding: { embeddings: [[1, 2, 3]], regenerate: false } } },
          ],
        }),
      ],
      [],
    ).hits[0]

    assert.deepEqual(hit.document, { title: 'Shirt', embedding: [1, 2, 3] })
  })

  it('requests facet values through a facet search when the facet is queried', () => {
    const plan = planSearch(query({ search_options: { facets: [{ field: 'status', query: 'pub' }] } }), indexPlan)

    assert.deepEqual(plan.facetSearches, [
      { field: 'status', params: { facetName: 'status', facetQuery: 'pub', q: 'shirt', filter: undefined } },
    ])

    const facets = plan.assemble(
      [result()],
      [{ facetHits: [{ value: 'published', count: 9 }], processingTimeMs: 1, facetQuery: 'pub' }],
    ).facets

    assert.deepEqual(facets?.status, { type: 'value', values: [{ value: 'published', count: 9 }] })
  })

  it('maps hybrid search onto the embedder', () => {
    const plan = planSearch(query({ search_options: { vector: { field: 'default', semantic_ratio: 0.3 } } }), indexPlan)

    assert.deepEqual(plan.queries[0].hybrid, { embedder: 'default', semanticRatio: 0.3 })
  })

  it('sends the declared locales Meilisearch tokenizes', () => {
    const declared = { ...definition, settings: { provider_options: { meilisearch: { locales: ['pl-PL'] } } } }
    const requested = query({ search_options: { locales: ['fr-FR'] } })

    assert.deepEqual(planSearch(query({ index: declared }), indexPlan).queries[0].locales, ['pl'])
    assert.deepEqual(planSearch(requested, indexPlan).queries[0].locales, ['fr'])
  })

  it('leaves out a locale Meilisearch does not tokenize, so it detects the language itself', () => {
    const declared = { ...definition, settings: { provider_options: { meilisearch: { locales: ['is-IS'] } } } }

    assert.equal(planSearch(query({ index: declared }), indexPlan).queries[0].locales, undefined)
    assert.equal(planSearch(query({ search_options: { locales: ['is-IS'] } }), indexPlan).queries[0].locales, undefined)
  })

  it('spreads raw provider options last', () => {
    const plan = planSearch(
      query({
        filters: { status: 'published' },
        search_options: { provider_options: { meilisearch: { filter: 'status = draft', sort: ['title:asc'] } } },
      }),
      indexPlan,
    )

    assert.equal(plan.queries[0].filter, 'status = draft')
    assert.deepEqual(plan.queries[0].sort, ['title:asc'])
  })

  it('assembles hits, scores and highlights', () => {
    const plan = planSearch(
      query({ search_options: { include_score: true, highlight: { fields: ['title'] } } }),
      indexPlan,
    )

    const assembled = plan.assemble(
      [
        result({
          hits: [
            {
              id: 'prod_1',
              title: 'Shirt',
              created_at__ts: 1,
              _rankingScore: 0.9,
              _formatted: { title: 'A <mark>Shirt</mark>' },
            },
          ],
        }),
      ],
      [],
    )

    assert.deepEqual(assembled.hits, [
      {
        id: 'prod_1',
        score: 0.9,
        document: { title: 'Shirt' },
        highlights: { title: ['A <mark>Shirt</mark>'] },
      },
    ])
    assert.deepEqual(assembled.metadata, { skip: 0, take: 20, count: 7, query: 'shirt', processing_time_ms: 3 })
  })

  it('highlights every searchable attribute when highlight is true', () => {
    const plan = planSearch(query({ search_options: { highlight: true } }), indexPlan)

    assert.deepEqual(plan.queries[0].attributesToHighlight, indexPlan.searchableAttributes)
    assert.equal(plan.queries[0].highlightPreTag, '<mark>')
  })

  it('narrows highlight: true to the attributes the query searches on', () => {
    const plan = planSearch(
      query({ search_options: { highlight: true, attributes_to_search_on: ['title'] } }),
      indexPlan,
    )

    assert.deepEqual(plan.queries[0].attributesToHighlight, ['title'])
  })

  it('ignores highlight without a text query', () => {
    const plan = planSearch(query({ q: undefined, search_options: { highlight: true } }), indexPlan)

    assert.equal(plan.queries[0].attributesToHighlight, undefined)
  })

  it('rejects what Meilisearch cannot express', () => {
    assert.throws(() => {
      return planSearch(query({ pagination: { cursor: 'abc' } }), indexPlan)
    }, /cursor/)

    assert.throws(() => {
      return planSearch(query({ search_options: { typo_tolerance: false } }), indexPlan)
    }, /typo tolerance/)

    assert.throws(() => {
      return planSearch(query({ search_options: { match_strategy: 'any' } }), indexPlan)
    }, /"any"/)

    assert.throws(() => {
      return planSearch(query({ pagination: { order: { _score: 'ASC' } } }), indexPlan)
    }, /descending relevance/)

    assert.throws(() => {
      return planSearch(query({ search_options: { attributes_to_search_on: ['status'] } }), indexPlan)
    }, /not searchable/)
  })
})
