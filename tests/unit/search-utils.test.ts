import { MedusaModule } from '@medusajs/modules-sdk'
import { search } from '@medusajs/utils'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  buildSearchOptions,
  resolveSearchIndexName,
  toHitsEnvelope,
  toStringArray,
  type SearchRequestParams,
} from '../../src/api/utils/search'
import { defineProductSearchIndex, productSearchSchema } from '../../src/indexes/products'
import { createSearchModule } from './support/routes'

function params(overrides: Partial<SearchRequestParams> = {}): SearchRequestParams {
  return { semanticSearch: false, semanticRatio: 0.5, ...overrides }
}

afterEach(() => {
  MedusaModule.clearInstances()
})

describe('resolveSearchIndexName', () => {
  it('prefers the index named by the request', () => {
    const searchModule = createSearchModule({ indexes: ['products', 'products-fr-FR'] })

    assert.equal(
      resolveSearchIndexName({ searchModule, entity: 'product', explicitIndex: 'products-fr-FR' }),
      'products-fr-FR',
    )
  })

  it('matches the locale exactly when one is declared', () => {
    defineProductSearchIndex({ locales: ['en-US', 'fr-FR'] })

    const searchModule = createSearchModule({ indexes: ['products', 'products-fr-FR'] })

    assert.equal(resolveSearchIndexName({ searchModule, entity: 'product', locale: 'fr-FR' }), 'products-fr-FR')
  })

  it('falls back to the language when the region has no index of its own', () => {
    defineProductSearchIndex({ locales: ['en-US', 'fr-FR'] })

    const searchModule = createSearchModule({ indexes: ['products', 'products-fr-FR'] })

    assert.equal(resolveSearchIndexName({ searchModule, entity: 'product', locale: 'fr-CA' }), 'products-fr-FR')
  })

  it('falls back to the non-localized index for an unrelated locale', () => {
    defineProductSearchIndex({ locales: ['en-US', 'fr-FR'] })

    const searchModule = createSearchModule({ indexes: ['products', 'products-fr-FR'] })

    assert.equal(resolveSearchIndexName({ searchModule, entity: 'product', locale: 'de-DE' }), 'products')
  })

  it('reports an entity that has no declaration', () => {
    const searchModule = createSearchModule({ indexes: ['products'] })

    assert.throws(
      () => resolveSearchIndexName({ searchModule, entity: 'product_category' }),
      /No search index is registered for "product_category"/,
    )
  })

  it('ignores declarations the engine does not hold', () => {
    defineProductSearchIndex()

    const searchModule = createSearchModule({ indexes: [] })

    assert.throws(() => resolveSearchIndexName({ searchModule, entity: 'product' }), /No search index is registered/)
  })
})

describe('buildSearchOptions', () => {
  it('stays empty for a plain keyword search', () => {
    assert.deepEqual(buildSearchOptions({ params: params() }), {})
  })

  it('routes raw filter and sort into the provider options', () => {
    assert.deepEqual(
      buildSearchOptions({ params: params({ filter: 'status = published', sort: 'title:asc,id:desc' }) }),
      {
        provider_options: { meilisearch: { filter: 'status = published', sort: ['title:asc', 'id:desc'] } },
      },
    )
  })

  it('leaves semantic search off at ratio zero', () => {
    assert.deepEqual(buildSearchOptions({ params: params({ semanticSearch: true, semanticRatio: 0 }) }), {})
  })

  it('uses a declared vector field over a raw hybrid query', () => {
    const [definition] = defineProductSearchIndex({
      fields: search.define({ ...productSearchSchema(), embedding: search.vector(768) }),
    })

    assert.deepEqual(buildSearchOptions({ definition, params: params({ semanticSearch: true, semanticRatio: 0.7 }) }), {
      vector: { field: 'embedding', semantic_ratio: 0.7 },
    })
  })

  it('names the embedder declared on the index when there is no vector field', () => {
    const [definition] = defineProductSearchIndex({
      settings: { provider_options: { meilisearch: { embedders: { catalog: { source: 'ollama' } } } } },
    })

    assert.deepEqual(buildSearchOptions({ definition, params: params({ semanticSearch: true, semanticRatio: 0.4 }) }), {
      provider_options: { meilisearch: { hybrid: { embedder: 'catalog', semanticRatio: 0.4 } } },
    })
  })

  it('lets the request override the embedder', () => {
    assert.deepEqual(
      buildSearchOptions({ params: params({ semanticSearch: true, semanticRatio: 0.4, embedder: 'openai' }) }),
      { provider_options: { meilisearch: { hybrid: { embedder: 'openai', semanticRatio: 0.4 } } } },
    )
  })
})

describe('toHitsEnvelope', () => {
  it('flattens documents and defaults the window', () => {
    const envelope = toHitsEnvelope(
      {
        hits: [{ id: 'prod_1', document: { id: 'prod_1', title: 'Shirt' }, score: 0.5 }],
        metadata: { count: null, skip: 0, take: 20 },
      },
      params({ query: 'shirt' }),
    )

    assert.deepEqual(envelope.hits, [{ id: 'prod_1', title: 'Shirt', _score: 0.5 }])
    assert.equal(envelope.estimatedTotalHits, 1)
    assert.equal(envelope.processingTimeMs, 0)
    assert.equal(envelope.limit, 20)
    assert.equal(envelope.offset, 0)
  })
})

describe('toStringArray', () => {
  it('splits a comma-separated list and drops the blanks', () => {
    assert.deepEqual(toStringArray('status, categories.name ,'), ['status', 'categories.name'])
    assert.deepEqual(toStringArray(['a', 'b']), ['a', 'b'])
    assert.equal(toStringArray(undefined), undefined)
  })
})
