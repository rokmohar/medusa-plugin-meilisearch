import { MedusaModule } from '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { AdminIndexesResponse, GET as indexesRoute } from '../../src/api/admin/meilisearch/indexes/route'
import { AdminSyncResponse, POST as syncRoute } from '../../src/api/admin/meilisearch/sync/route'
import {
  AdminVectorStatusResponse,
  GET as vectorStatusRoute,
} from '../../src/api/admin/meilisearch/vector-status/route'
import { defineProductSearchIndex } from '../../src/indexes/products'
import {
  createLogger,
  createRequest,
  createResponse,
  createSearchModule,
  FakeSearchModule,
  LOGGER_KEY,
  SEARCH_KEY,
} from './support/routes'

function syncHarness(body: unknown, searchModule: FakeSearchModule = createSearchModule()) {
  const logger = createLogger()
  const req = createRequest({ body }, { [SEARCH_KEY]: searchModule, [LOGGER_KEY]: logger })
  const { res, payloads } = createResponse<AdminSyncResponse>()

  return { req, res, payloads, logger, searchModule }
}

afterEach(() => {
  MedusaModule.clearInstances()
})

describe('POST /admin/meilisearch/sync', () => {
  it('reindexes every registered index when no body is sent', () => {
    const searchModule = createSearchModule({ indexes: ['products', 'categories'] })
    const { req, res, payloads } = syncHarness(undefined, searchModule)

    syncRoute(req, res)

    assert.deepEqual(payloads[0], {
      message: 'Reindex started for 2 index(es)',
      indexes: ['products', 'categories'],
    })
    assert.deepEqual(searchModule.reindexCalls, [{ index: undefined, strategy: undefined }])
  })

  it('accepts a single index name and a strategy', () => {
    const { req, res, payloads, searchModule } = syncHarness({ index: 'products', strategy: 'swap' })

    syncRoute(req, res)

    assert.deepEqual(payloads[0].indexes, ['products'])
    assert.deepEqual(searchModule.reindexCalls, [{ index: 'products', strategy: 'swap' }])
  })

  it('accepts a list of index names', () => {
    const { req, res, payloads, searchModule } = syncHarness({ index: ['products', 'categories'] })

    syncRoute(req, res)

    assert.deepEqual(payloads[0].indexes, ['products', 'categories'])
    assert.deepEqual(searchModule.reindexCalls[0].index, ['products', 'categories'])
  })

  it('rejects an unknown strategy', () => {
    const { req, res } = syncHarness({ strategy: 'sideways' })

    assert.throws(() => syncRoute(req, res), /strategy/i)
  })

  it('answers before the reindex finishes and logs its outcome', async () => {
    let release: (() => void) | undefined
    const pending = new Promise<{ indexes: string[]; job_id: string }>((resolve) => {
      release = () => {
        resolve({ indexes: ['products'], job_id: 'job_7' })
      }
    })
    const searchModule = createSearchModule({ reindex: () => pending })
    const { req, res, payloads, logger } = syncHarness({}, searchModule)

    syncRoute(req, res)

    assert.equal(payloads.length, 1)
    assert.deepEqual(logger.infos, [])

    release?.()
    await pending
    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(logger.infos, ['Meilisearch reindex finished for products (job job_7)'])
    assert.deepEqual(logger.errors, [])
  })

  it('logs a failed reindex instead of crashing the request', async () => {
    const searchModule = createSearchModule({
      reindex: () => Promise.reject(new Error('meilisearch unreachable')),
    })
    const { req, res, payloads, logger } = syncHarness({}, searchModule)

    syncRoute(req, res)

    assert.equal(payloads.length, 1)

    await new Promise((resolve) => setImmediate(resolve))

    assert.deepEqual(logger.errors, ['Meilisearch reindex failed: meilisearch unreachable'])
  })
})

describe('GET /admin/meilisearch/indexes', () => {
  it('reports the registered declarations that the engine actually holds', () => {
    defineProductSearchIndex({ locales: ['en-US', 'fr-FR'] })

    const searchModule = createSearchModule({
      indexes: ['products', 'products-fr-FR'],
      retrievableFields: ['id', 'title', 'handle'],
    })
    const req = createRequest({}, { [SEARCH_KEY]: searchModule })
    const { res, payloads } = createResponse<AdminIndexesResponse>()

    indexesRoute(req, res)

    assert.deepEqual(payloads[0].indexes, [
      { name: 'products', entity: 'product', locales: ['en-US'], retrievable_fields: ['id', 'title', 'handle'] },
      {
        name: 'products-fr-FR',
        entity: 'product',
        locales: ['fr-FR'],
        retrievable_fields: ['id', 'title', 'handle'],
      },
    ])
  })

  it('omits declarations the engine does not know about', () => {
    defineProductSearchIndex()

    const req = createRequest({}, { [SEARCH_KEY]: createSearchModule({ indexes: [] }) })
    const { res, payloads } = createResponse<AdminIndexesResponse>()

    indexesRoute(req, res)

    assert.deepEqual(payloads[0].indexes, [])
  })
})

describe('GET /admin/meilisearch/vector-status', () => {
  it('reports disabled when no declaration mentions vectors', () => {
    defineProductSearchIndex()

    const req = createRequest({}, {})
    const { res, payloads } = createResponse<AdminVectorStatusResponse>()

    vectorStatusRoute(req, res)

    assert.deepEqual(payloads[0], { enabled: false, embeddingFields: [], semanticRatio: 0.5 })
  })

  it('reads the embedder declared on the index', () => {
    defineProductSearchIndex({
      settings: {
        provider_options: {
          meilisearch: {
            embedders: {
              default: {
                source: 'openAi',
                model: 'text-embedding-3-small',
                dimensions: 1536,
                documentTemplate: '{{doc.title}} {{ doc.description }}',
              },
            },
          },
        },
      },
    })

    const req = createRequest({}, {})
    const { res, payloads } = createResponse<AdminVectorStatusResponse>()

    vectorStatusRoute(req, res)

    assert.deepEqual(payloads[0], {
      enabled: true,
      provider: 'openAi',
      model: 'text-embedding-3-small',
      dimensions: 1536,
      embeddingFields: ['title', 'description'],
      semanticRatio: 0.5,
    })
  })
})
