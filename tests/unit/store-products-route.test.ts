import '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MedusaStoreRequest } from '@medusajs/framework'
import { GET, ProductsResponse } from '../../src/api/store/meilisearch/products/route'
import type { MeiliParams } from '../../src/api/types'
import { createQuery, createRequest, createResponse, createSearchModule, QUERY_KEY, SEARCH_KEY } from './support/routes'

const PRICE_FIELDS = ['id', 'title', 'variants.calculated_price.calculated_amount']

function harness(options: {
  pricingContext?: Record<string, unknown>
  meiliParams?: MeiliParams
  hits?: string[]
  products?: Record<string, unknown>[]
  fields?: string[]
  pagination?: { skip: number; take: number }
}) {
  const query = createQuery(options.products ?? [{ id: 'prod_1' }])
  const searchModule = createSearchModule({
    hits: (options.hits ?? []).map((id) => ({ id })),
  })
  const req = createRequest<MedusaStoreRequest>(
    {
      queryConfig: {
        fields: options.fields ?? PRICE_FIELDS,
        pagination: options.pagination ?? { skip: 0, take: 20 },
      },
      pricingContext: options.pricingContext,
      meiliParams: options.meiliParams,
      publishable_key_context: { key: 'pk_test', sales_channel_ids: ['sc_1'] },
      validatedQuery: {},
    },
    { [QUERY_KEY]: query, [SEARCH_KEY]: searchModule },
  )
  const { res, payloads } = createResponse<ProductsResponse>()

  return { req, res, payloads, query, searchModule }
}

describe('GET /store/meilisearch/products', () => {
  it('forwards the customer groups resolved from the session into query.graph', async () => {
    const { req, res, query, searchModule } = harness({
      pricingContext: {
        region_id: 'reg_1',
        currency_code: 'usd',
        customer: { groups: [{ id: 'cg_1' }, { id: 'cg_2' }] },
      },
    })

    await GET(req, res)

    assert.equal(query.calls.length, 1)
    assert.deepEqual(query.calls[0].context, {
      variants: {
        calculated_price: {
          __type: 'QueryContext',
          region_id: 'reg_1',
          currency_code: 'usd',
          customer: { groups: [{ id: 'cg_1' }, { id: 'cg_2' }] },
        },
      },
    })
    assert.deepEqual(query.calls[0].pagination, { skip: 0, take: 20 })
    assert.deepEqual(query.calls[0].filters, {})
    assert.equal(searchModule.searchCalls.length, 0)
  })

  it('keeps the customer groups when Meilisearch drives the result set', async () => {
    const { req, res, payloads, query, searchModule } = harness({
      pricingContext: {
        region_id: 'reg_1',
        currency_code: 'usd',
        customer: { groups: [{ id: 'cg_1' }] },
      },
      meiliParams: { query: 'shirt', index: 'products', semanticSearch: false, semanticRatio: 0.5 },
      hits: ['prod_2', 'prod_1'],
      products: [{ id: 'prod_1' }, { id: 'prod_2' }],
      pagination: { skip: 20, take: 20 },
    })

    await GET(req, res)

    assert.equal(searchModule.searchCalls.length, 1)
    assert.deepEqual(searchModule.searchCalls[0].pagination, { skip: 20, take: 20 })
    assert.deepEqual(searchModule.searchCalls[0].fields, ['id'])

    assert.deepEqual(query.calls[0].context, {
      variants: {
        calculated_price: {
          __type: 'QueryContext',
          region_id: 'reg_1',
          currency_code: 'usd',
          customer: { groups: [{ id: 'cg_1' }] },
        },
      },
    })
    assert.deepEqual(query.calls[0].filters, { id: { $in: ['prod_2', 'prod_1'] } })
    assert.deepEqual(query.calls[0].pagination, { skip: 0, take: 2 })

    assert.deepEqual(
      payloads[0].products.map((product) => product.id),
      ['prod_2', 'prod_1'],
    )
    assert.equal(payloads[0].count, 2)
    assert.equal(payloads[0].offset, 20)
    assert.equal(payloads[0].limit, 20)
  })

  it('passes no pricing context for unauthenticated requests without price fields', async () => {
    const { req, res, query } = harness({ fields: ['id', 'title'] })

    await GET(req, res)

    assert.deepEqual(query.calls[0].context, {})
  })

  it('strips the virtual inventory field from the graph query', async () => {
    const { req, res, query } = harness({
      fields: ['id', 'title', 'variants.inventory_quantity'],
      products: [{ id: 'prod_1', variants: [] }],
    })

    await GET(req, res)

    assert.deepEqual(query.calls[0].fields, ['id', 'title'])
  })

  it('answers with an empty page without hitting the database when nothing matched', async () => {
    const { req, res, payloads, query } = harness({
      meiliParams: { query: 'nothing', index: 'products', semanticSearch: false, semanticRatio: 0.5 },
      hits: [],
      pagination: { skip: 40, take: 20 },
    })

    await GET(req, res)

    assert.equal(query.calls.length, 0)
    assert.deepEqual(payloads[0], { products: [], count: 0, limit: 20, offset: 40 })
  })

  it('searches on semanticSearch alone, without a text query', async () => {
    const { req, res, searchModule } = harness({
      meiliParams: { index: 'products', semanticSearch: true, semanticRatio: 0.8 },
      hits: ['prod_1'],
    })

    await GET(req, res)

    assert.equal(searchModule.searchCalls.length, 1)
    assert.deepEqual(searchModule.searchCalls[0].filters, { q: '' })
    assert.deepEqual(searchModule.searchCalls[0].search_options, {
      provider_options: { meilisearch: { hybrid: { embedder: 'default', semanticRatio: 0.8 } } },
    })
  })

  it('reports the database count and window when no search runs', async () => {
    const { req, res, payloads } = harness({
      products: [{ id: 'prod_1' }, { id: 'prod_2' }],
      pagination: { skip: 10, take: 5 },
    })

    await GET(req, res)

    assert.equal(payloads[0].count, 2)
    assert.equal(payloads[0].offset, 10)
    assert.equal(payloads[0].limit, 5)
  })
})
