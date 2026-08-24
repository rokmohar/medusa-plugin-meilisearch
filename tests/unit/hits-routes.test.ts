import '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  AdminSearchProductsSchema,
  POST as adminProductsHits,
} from '../../src/api/admin/meilisearch/products-hits/route'
import {
  StoreSearchCategoriesSchema,
  GET as storeCategoriesHits,
} from '../../src/api/store/meilisearch/categories-hits/route'
import {
  StoreSearchProductsSchema,
  GET as storeProductsHits,
} from '../../src/api/store/meilisearch/products-hits/route'
import type { MedusaRequest } from '@medusajs/framework'
import type { HitsSearchParams, MeiliHitsEnvelope } from '../../src/api/utils/search'
import { createRequest, createResponse, createSearchModule, SEARCH_KEY } from './support/routes'

type StoreHitsRequest = MedusaRequest<unknown, HitsSearchParams>
type AdminHitsRequest = MedusaRequest<HitsSearchParams>

describe('hits route schemas', () => {
  it('applies the documented defaults', () => {
    const params = StoreSearchProductsSchema.parse({ query: 'shirt' })

    assert.equal(params.limit, 10)
    assert.equal(params.offset, 0)
    assert.equal(params.semanticSearch, false)
    assert.equal(params.semanticRatio, 0.5)
  })

  it('coerces the numeric query-string values', () => {
    const params = StoreSearchProductsSchema.parse({ query: 'shirt', limit: '25', offset: '50', semanticRatio: '0.8' })

    assert.equal(params.limit, 25)
    assert.equal(params.offset, 50)
    assert.equal(params.semanticRatio, 0.8)
  })

  it('reads semanticSearch=false as false, not as a truthy string', () => {
    assert.equal(StoreSearchProductsSchema.parse({ query: 'shirt', semanticSearch: 'false' }).semanticSearch, false)
    assert.equal(StoreSearchProductsSchema.parse({ query: 'shirt', semanticSearch: '0' }).semanticSearch, false)
    assert.equal(StoreSearchProductsSchema.parse({ query: 'shirt', semanticSearch: 'true' }).semanticSearch, true)
    assert.equal(StoreSearchProductsSchema.parse({ query: 'shirt', semanticSearch: '1' }).semanticSearch, true)
  })

  it('accepts real booleans from a JSON body', () => {
    assert.equal(AdminSearchProductsSchema.parse({ query: 'shirt', semanticSearch: true }).semanticSearch, true)
    assert.equal(AdminSearchProductsSchema.parse({ query: 'shirt', semanticSearch: false }).semanticSearch, false)
  })

  it('rejects a missing query and an out-of-range ratio', () => {
    assert.equal(StoreSearchProductsSchema.safeParse({}).success, false)
    assert.equal(StoreSearchProductsSchema.safeParse({ query: 'shirt', semanticRatio: '1.5' }).success, false)
  })

  it('is the same schema on every hits route', () => {
    assert.equal(StoreSearchCategoriesSchema, StoreSearchProductsSchema)
    assert.equal(AdminSearchProductsSchema, StoreSearchProductsSchema)
  })
})

describe('GET /store/meilisearch/products-hits', () => {
  it('returns a flat Meilisearch-shaped envelope', async () => {
    const searchModule = createSearchModule({
      hits: [
        { id: 'prod_1', document: { id: 'prod_1', title: 'Shirt' }, score: 0.9 },
        { id: 'prod_2', document: { id: 'prod_2', title: 'Shorts' } },
      ],
      count: 42,
      processingTimeMs: 7,
      facets: { status: { values: [{ value: 'published', count: 2 }] } },
    })
    const req = createRequest<StoreHitsRequest>(
      { validatedQuery: StoreSearchProductsSchema.parse({ query: 'shirt', index: 'products', limit: '2' }) },
      { [SEARCH_KEY]: searchModule },
    )
    const { res, payloads } = createResponse<MeiliHitsEnvelope>()

    await storeProductsHits(req, res)

    assert.deepEqual(payloads[0].hits, [
      { id: 'prod_1', title: 'Shirt', _score: 0.9 },
      { id: 'prod_2', title: 'Shorts' },
    ])
    assert.equal(payloads[0].query, 'shirt')
    assert.equal(payloads[0].estimatedTotalHits, 42)
    assert.equal(payloads[0].processingTimeMs, 7)
    assert.equal(payloads[0].limit, 2)
    assert.equal(payloads[0].offset, 0)
    assert.deepEqual(payloads[0].facets, { status: { values: [{ value: 'published', count: 2 }] } })
    assert.equal(payloads[0].hybridSearch, undefined)
  })

  it('passes raw Meilisearch filter and sort through the provider options', async () => {
    const searchModule = createSearchModule({ hits: [{ id: 'prod_1' }] })
    const req = createRequest<StoreHitsRequest>(
      {
        validatedQuery: StoreSearchProductsSchema.parse({
          query: 'shirt',
          index: 'products',
          filter: 'status = published',
          sort: ['title:asc', 'created_at:desc'],
          facets: 'status,categories.name',
          fields: 'id,title',
        }),
      },
      { [SEARCH_KEY]: searchModule },
    )
    const { res } = createResponse<MeiliHitsEnvelope>()

    await storeProductsHits(req, res)

    assert.deepEqual(searchModule.searchCalls[0].fields, ['id', 'title'])
    assert.deepEqual(searchModule.searchCalls[0].search_options, {
      include_score: true,
      facets: ['status', 'categories.name'],
      provider_options: {
        meilisearch: { filter: 'status = published', sort: ['title:asc', 'created_at:desc'] },
      },
    })
  })

  it('flags a hybrid search in the envelope', async () => {
    const searchModule = createSearchModule({ hits: [{ id: 'prod_1' }] })
    const req = createRequest<StoreHitsRequest>(
      {
        validatedQuery: StoreSearchProductsSchema.parse({
          query: 'warm winter clothing',
          index: 'products',
          semanticSearch: 'true',
          semanticRatio: '0.7',
          embedder: 'openai',
        }),
      },
      { [SEARCH_KEY]: searchModule },
    )
    const { res, payloads } = createResponse<MeiliHitsEnvelope>()

    await storeProductsHits(req, res)

    assert.equal(payloads[0].hybridSearch, true)
    assert.equal(payloads[0].semanticRatio, 0.7)
    assert.deepEqual(searchModule.searchCalls[0].search_options, {
      include_score: true,
      provider_options: { meilisearch: { hybrid: { embedder: 'openai', semanticRatio: 0.7 } } },
    })
  })

  it('reports a missing Search Module with an actionable error', async () => {
    const req = createRequest<StoreHitsRequest>(
      { validatedQuery: StoreSearchProductsSchema.parse({ query: 'shirt' }) },
      {},
    )
    const { res } = createResponse<MeiliHitsEnvelope>()

    await assert.rejects(storeProductsHits(req, res), /Search Module is not registered/)
  })

  it('rejects an index that is not registered', async () => {
    const searchModule = createSearchModule({ indexes: ['products'] })
    const req = createRequest<StoreHitsRequest>(
      { validatedQuery: StoreSearchProductsSchema.parse({ query: 'shirt', index: 'ghost' }) },
      { [SEARCH_KEY]: searchModule },
    )
    const { res } = createResponse<MeiliHitsEnvelope>()

    await assert.rejects(storeProductsHits(req, res), /Unknown search index "ghost"/)
  })
})

describe('categories and admin hits routes', () => {
  it('searches the category index from the store route', async () => {
    const searchModule = createSearchModule({ indexes: ['categories'], hits: [{ id: 'pcat_1' }] })
    const req = createRequest<StoreHitsRequest>(
      { validatedQuery: StoreSearchCategoriesSchema.parse({ query: 'shoes', index: 'categories' }) },
      { [SEARCH_KEY]: searchModule },
    )
    const { res, payloads } = createResponse<MeiliHitsEnvelope>()

    await storeCategoriesHits(req, res)

    assert.equal(searchModule.searchCalls[0].entity, 'categories')
    assert.deepEqual(payloads[0].hits, [{ id: 'pcat_1' }])
  })

  it('reads the admin route parameters from the request body', async () => {
    const searchModule = createSearchModule({ hits: [{ id: 'prod_1' }] })
    const req = createRequest<AdminHitsRequest>(
      {
        validatedBody: AdminSearchProductsSchema.parse({
          query: 'shirt',
          index: 'products',
          limit: 5,
          offset: 10,
        }),
      },
      { [SEARCH_KEY]: searchModule },
    )
    const { res, payloads } = createResponse<MeiliHitsEnvelope>()

    await adminProductsHits(req, res)

    assert.deepEqual(searchModule.searchCalls[0].pagination, { skip: 10, take: 5 })
    assert.equal(payloads[0].limit, 5)
    assert.equal(payloads[0].offset, 10)
  })
})
