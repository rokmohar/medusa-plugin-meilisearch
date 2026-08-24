import '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CategoriesResponse, GET } from '../../src/api/store/meilisearch/categories/route'
import type { MeiliParams } from '../../src/api/types'
import { createQuery, createRequest, createResponse, createSearchModule, QUERY_KEY, SEARCH_KEY } from './support/routes'

function harness(options: {
  meiliParams?: MeiliParams
  hits?: string[]
  categories?: Record<string, unknown>[]
  pagination?: { skip: number; take: number }
  locale?: string
}) {
  const query = createQuery(options.categories ?? [{ id: 'pcat_1' }])
  const searchModule = createSearchModule({
    indexes: ['categories'],
    hits: (options.hits ?? []).map((id) => ({ id })),
  })
  const req = createRequest(
    {
      queryConfig: {
        fields: ['id', 'name', 'handle'],
        pagination: options.pagination ?? { skip: 0, take: 20 },
      },
      meiliParams: options.meiliParams,
      locale: options.locale,
    },
    { [QUERY_KEY]: query, [SEARCH_KEY]: searchModule },
  )
  const { res, payloads } = createResponse<CategoriesResponse>()

  return { req, res, payloads, query, searchModule }
}

describe('GET /store/meilisearch/categories', () => {
  it('passes the native query straight through when nothing is searched', async () => {
    const { req, res, payloads, query, searchModule } = harness({
      categories: [{ id: 'pcat_1' }, { id: 'pcat_2' }],
      pagination: { skip: 5, take: 10 },
    })

    await GET(req, res)

    assert.equal(searchModule.searchCalls.length, 0)
    assert.equal(query.calls[0].entity, 'product_category')
    assert.deepEqual(query.calls[0].fields, ['id', 'name', 'handle'])
    assert.deepEqual(query.calls[0].pagination, { skip: 5, take: 10 })
    assert.equal(payloads[0].count, 2)
    assert.equal(payloads[0].offset, 5)
    assert.equal(payloads[0].limit, 10)
  })

  it('intersects the searched ids and restores relevance order', async () => {
    const { req, res, payloads, query } = harness({
      meiliParams: { query: 'shoes', index: 'categories', semanticSearch: false, semanticRatio: 0.5 },
      hits: ['pcat_2', 'pcat_1'],
      categories: [{ id: 'pcat_1' }, { id: 'pcat_2' }],
      pagination: { skip: 20, take: 20 },
    })

    await GET(req, res)

    assert.deepEqual(query.calls[0].filters, { id: { $in: ['pcat_2', 'pcat_1'] } })
    assert.deepEqual(query.calls[0].pagination, { skip: 0, take: 2 })
    assert.deepEqual(
      payloads[0].categories.map((category) => category.id),
      ['pcat_2', 'pcat_1'],
    )
    assert.equal(payloads[0].count, 2)
    assert.equal(payloads[0].offset, 20)
    assert.equal(payloads[0].limit, 20)
  })

  it('short-circuits an empty result set', async () => {
    const { req, res, payloads, query } = harness({
      meiliParams: { query: 'nothing', index: 'categories', semanticSearch: false, semanticRatio: 0.5 },
      hits: [],
      pagination: { skip: 0, take: 20 },
    })

    await GET(req, res)

    assert.equal(query.calls.length, 0)
    assert.deepEqual(payloads[0], { categories: [], count: 0, limit: 20, offset: 0 })
  })

  it('searches the category entity, not products', async () => {
    const { req, res, searchModule } = harness({
      meiliParams: { query: 'shoes', index: 'categories', semanticSearch: false, semanticRatio: 0.5 },
      hits: ['pcat_1'],
    })

    await GET(req, res)

    assert.equal(searchModule.searchCalls[0].entity, 'categories')
    assert.deepEqual(searchModule.searchCalls[0].fields, ['id'])
  })
})
