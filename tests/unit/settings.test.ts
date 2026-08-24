import type { SearchTypes } from '@medusajs/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertIndexSupported,
  buildIndexPlan,
  flattenFields,
  toEngineLocale,
} from '../../src/providers/meilisearch/utils/settings'

function definition(
  overrides: Partial<SearchTypes.ResolvedSearchIndexDefinition> = {},
): SearchTypes.ResolvedSearchIndexDefinition {
  return {
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
      description: { type: 'text', searchable: { weight: 2 } },
      handle: { type: 'keyword', searchable: true },
      blob: { type: 'text', searchable: true, retrievable: false },
      status: { type: 'keyword', facetable: true },
      created_at: { type: 'date', filterable: true, sortable: true },
      variants: {
        type: 'object',
        array: true,
        fields: { sku: { type: 'keyword', searchable: { weight: 4 }, filterable: true } },
      },
    },
    seed: async function* () {},
    ...overrides,
  }
}

describe('buildIndexPlan', () => {
  it('orders searchable attributes by declared weight', () => {
    const plan = buildIndexPlan(definition(), { config: { host: 'http://localhost:7700' } })

    assert.deepEqual(plan.settings.searchableAttributes, ['title', 'variants.sku', 'description', 'handle', 'blob'])
  })

  it('makes facetable fields filterable and routes dates through the shadow attribute', () => {
    const plan = buildIndexPlan(definition(), { config: { host: 'http://localhost:7700' } })

    assert.deepEqual(plan.settings.filterableAttributes, ['id', 'status', 'created_at__ts', 'variants.sku'])
    assert.deepEqual(plan.settings.sortableAttributes, ['title', 'created_at__ts'])
    assert.deepEqual([...plan.dateAttributes], ['created_at'])
  })

  it('displays retrievable leaves but not object containers', () => {
    const plan = buildIndexPlan(definition(), { config: { host: 'http://localhost:7700' } })

    assert.deepEqual(plan.settings.displayedAttributes, [
      'id',
      'title',
      'description',
      'handle',
      'status',
      'created_at',
      'variants.sku',
    ])
  })

  it('maps declared settings onto Meilisearch names', () => {
    const plan = buildIndexPlan(
      definition({
        settings: {
          synonyms: { trousers: ['pants'] },
          stop_words: ['the'],
          typo_tolerance: { enabled: true, min_word_size_for_one_typo: 4 },
          faceting: { max_values_per_facet: 50, sort_by: 'alpha' },
          pagination: { max_total_hits: 5000 },
          distinct_attribute: 'handle',
          locales: ['fr-FR'],
        },
      }),
      { config: { host: 'http://localhost:7700' } },
    )

    assert.deepEqual(plan.settings.synonyms, { trousers: ['pants'] })
    assert.deepEqual(plan.settings.stopWords, ['the'])
    assert.deepEqual(plan.settings.typoTolerance, { enabled: true, minWordSizeForTypos: { oneTypo: 4 } })
    assert.deepEqual(plan.settings.faceting, { maxValuesPerFacet: 50, sortFacetValuesBy: { '*': 'alpha' } })
    assert.deepEqual(plan.settings.pagination, { maxTotalHits: 5000 })
    assert.equal(plan.settings.distinctAttribute, 'handle')
    assert.deepEqual(plan.settings.localizedAttributes, [{ attributePatterns: ['*'], locales: ['fr'] }])
  })

  it('lets per-index provider options win over derived settings', () => {
    const plan = buildIndexPlan(
      definition({
        settings: {
          provider_options: { meilisearch: { searchableAttributes: ['title'], rankingRules: ['words'] } },
        },
      }),
      { config: { host: 'http://localhost:7700' }, settings: { rankingRules: ['typo'] } },
    )

    assert.deepEqual(plan.settings.searchableAttributes, ['title'])
    assert.deepEqual(plan.settings.rankingRules, ['words'])
  })

  it('merges provider embedders with vector fields and index embedders', () => {
    const plan = buildIndexPlan(
      definition({
        fields: {
          id: { type: 'keyword', filterable: true },
          embedding: { type: 'vector', dimensions: 384 },
        },
        settings: {
          provider_options: { meilisearch: { embedders: { custom: { source: 'ollama' } } } },
        },
      }),
      { config: { host: 'http://localhost:7700' }, embedders: { default: { source: 'openAi' } } },
    )

    assert.deepEqual(Object.keys(plan.settings.embedders ?? {}), ['default', 'embedding', 'custom'])
    assert.deepEqual(plan.settings.embedders?.embedding, { source: 'userProvided', dimensions: 384 })
  })
})

describe('assertIndexSupported', () => {
  it('accepts a plain definition', () => {
    assert.doesNotThrow(() => {
      return assertIndexSupported(definition())
    })
  })

  it('rejects correlated fields, misplaced geo and dimensionless vectors', () => {
    assert.throws(() => {
      return assertIndexSupported(
        definition({
          fields: { variants: { type: 'object', array: true, correlated: true, fields: {} } },
        }),
      )
    }, /correlated/)

    assert.throws(() => {
      return assertIndexSupported(definition({ fields: { location: { type: 'geo' } } }))
    }, /_geo/)

    assert.throws(() => {
      return assertIndexSupported(definition({ fields: { embedding: { type: 'vector' } } }))
    }, /dimensions/)
  })
})

describe('flattenFields', () => {
  it('produces dotted paths for nested objects', () => {
    const paths = flattenFields({
      variants: { type: 'object', fields: { sku: { type: 'keyword' } } },
    }).map((attribute) => {
      return attribute.path
    })

    assert.deepEqual(paths, ['variants', 'variants.sku'])
  })
})

describe('toEngineLocale', () => {
  it('reduces a BCP-47 tag to its language subtag', () => {
    assert.equal(toEngineLocale('fr-FR'), 'fr')
    assert.equal(toEngineLocale('en'), 'en')
  })
})
