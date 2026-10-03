import '@medusajs/modules-sdk'
import type { SearchTypes } from '@medusajs/types'
import { search } from '@medusajs/utils'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defineCategorySearchIndex } from '../../src/indexes/categories'
import {
  buildPathTree,
  projectPaths,
  createDefaultTransform,
  createSeed,
  parseEventName,
  resolveEventIds,
} from '../../src/indexes/graph'
import { expandLocales, localeIndexName, readIndexLocales, resolveLocaleIndexName } from '../../src/indexes/locales'
import { defineProductSearchIndex, PRODUCT_GRAPH_FIELDS } from '../../src/indexes/products'
import type { ResolvedFactoryOptions } from '../../src/indexes/types'

describe('defineProductSearchIndex', () => {
  it('declares one index bound to the product entity', () => {
    const [definition] = defineProductSearchIndex()

    assert.equal(definition.name, 'products')
    assert.equal(definition.entity, 'product')
    assert.equal(definition.primary_key, 'id')
    assert.equal(typeof definition.seed, 'function')
    assert.equal(typeof definition.consume, 'function')
  })

  it('compiles the field DSL into plain definitions', () => {
    const [definition] = defineProductSearchIndex()

    assert.deepEqual(definition.fields.id, { type: 'keyword', filterable: true })
    assert.deepEqual(definition.fields.title, {
      type: 'text',
      searchable: { weight: 5 },
      sortable: true,
    })
    assert.equal(definition.fields.variants.type, 'object')
    assert.equal(definition.fields.variants.array, true)
    assert.equal(definition.fields.variants.fields?.sku.searchable && true, true)
  })

  it('subscribes to both the workflow and module event names', () => {
    const [definition] = defineProductSearchIndex()

    assert.ok(definition.events?.includes('product.updated'))
    assert.ok(definition.events?.includes('product.product.updated'))
    assert.ok(definition.events?.includes('product.product-variant.deleted'))
  })

  it('declares sales channel ids so the native store route can scope by publishable key', () => {
    const [definition] = defineProductSearchIndex()

    assert.deepEqual(definition.fields.sales_channel_ids, { type: 'keyword', array: true, filterable: true })
    assert.ok(PRODUCT_GRAPH_FIELDS.includes('sales_channels.id'))
  })

  it('flattens sales channels into sales_channel_ids, also behind a custom transform', async () => {
    const row = { id: 'p1', title: 'One', sales_channels: [{ id: 'sc_1' }, { id: 'sc_2' }] }
    const custom = defineProductSearchIndex({
      transform: (entity) => {
        return { id: String(entity.id), title: String(entity.title) }
      },
    })

    for (const [definition] of [defineProductSearchIndex(), custom]) {
      const { container } = fakeContainer([[row]])
      const [[mutation]] = await collect(definition.seed!({ container, index: {} as never }))

      assert.equal(mutation.action, 'upsert')
      assert.deepEqual(mutation.action === 'upsert' && mutation.documents[0].sales_channel_ids, ['sc_1', 'sc_2'])
      assert.equal(mutation.action === 'upsert' && 'sales_channels' in mutation.documents[0], false)
    }
  })

  it('defaults to published products only', () => {
    const [definition] = defineProductSearchIndex()
    const [custom] = defineProductSearchIndex({ name: 'catalog', filters: { status: 'draft' } })

    assert.equal(definition.name, 'products')
    assert.equal(custom.name, 'catalog')
  })

  it('emits one definition per locale, the default one keeping the bare name', () => {
    const definitions = defineProductSearchIndex({ locales: ['en-US', 'fr-FR'], default_locale: 'en-US' })

    assert.deepEqual(
      definitions.map((definition) => {
        return definition.name
      }),
      ['products', 'products-fr-FR'],
    )
    assert.deepEqual(readIndexLocales(definitions[0].settings), ['en-US'])
    assert.deepEqual(readIndexLocales(definitions[1].settings), ['fr-FR'])
  })

  it('produces a deterministic declaration, so the module does not reindex on every boot', () => {
    const first = defineProductSearchIndex()[0]
    const second = defineProductSearchIndex()[0]

    assert.deepEqual(first.fields, second.fields)
    assert.deepEqual(first.settings, second.settings)
    assert.deepEqual(first.events, second.events)
    assert.equal(first.primary_key, second.primary_key)
  })

  it('accepts an overriding schema, settings and provider', () => {
    const [definition] = defineProductSearchIndex({
      name: 'products-custom',
      provider: 'other',
      fields: search.define({ id: search.keyword().filterable() }),
      settings: { provider_options: { meilisearch: { synonyms: { trousers: ['pants'] } } } },
    })

    assert.equal(definition.provider, 'other')
    assert.deepEqual(Object.keys(definition.fields), ['id'])
    assert.deepEqual(definition.settings?.provider_options?.meilisearch, { synonyms: { trousers: ['pants'] } })
  })
})

describe('defineCategorySearchIndex', () => {
  it('declares one index bound to the category entity', () => {
    const [definition] = defineCategorySearchIndex()

    assert.equal(definition.name, 'categories')
    assert.equal(definition.entity, 'product_category')
    assert.ok(definition.events?.includes('product.product-category.deleted'))
  })
})

describe('locales', () => {
  it('names a localized index after its locale', () => {
    assert.equal(localeIndexName('products', 'fr-FR'), 'products-fr-FR')
  })

  it('resolves a request locale against the registered indexes', () => {
    const registered = ['products', 'products-fr-FR']

    assert.equal(resolveLocaleIndexName('products', 'fr-FR', registered), 'products-fr-FR')
    assert.equal(resolveLocaleIndexName('products', 'fr-CA', registered), 'products-fr-FR')
    assert.equal(resolveLocaleIndexName('products', 'de-DE', registered), 'products')
    assert.equal(resolveLocaleIndexName('products', undefined, registered), 'products')
  })

  it('falls back to the first locale when the default is not listed', () => {
    assert.deepEqual(expandLocales('products', ['fr-FR', 'en-US'], 'de-DE'), [
      { name: 'products', locale: 'fr-FR' },
      { name: 'products-en-US', locale: 'en-US' },
    ])
  })
})

function seedOptions(overrides: Partial<ResolvedFactoryOptions> = {}): ResolvedFactoryOptions {
  return {
    name: 'products',
    entity: 'product',
    primaryKey: 'id',
    fields: search.define({ id: search.keyword().filterable() }),
    settings: {},
    graphFields: ['id', 'title'],
    filters: { status: 'published' },
    transform: (entity) => {
      return { id: String(entity.id), title: entity.title as string }
    },
    batchSize: 2,
    events: [],
    ...overrides,
  }
}

function fakeContainer(pages: Record<string, unknown>[][]) {
  const calls: Record<string, unknown>[] = []

  return {
    calls,
    container: {
      query: {
        graph: (input: Record<string, unknown>) => {
          calls.push(input)

          return Promise.resolve({ data: pages[calls.length - 1] ?? [] })
        },
      },
    } as unknown as SearchTypes.SearchContainer,
  }
}

async function collect(iterable: AsyncIterable<SearchTypes.SearchMutation[]>) {
  const batches: SearchTypes.SearchMutation[][] = []

  for await (const batch of iterable) {
    batches.push(batch)
  }

  return batches
}

describe('createSeed', () => {
  it('yields upsert mutations and pages by primary key under $and', async () => {
    const { calls, container } = fakeContainer([
      [
        { id: 'p1', title: 'One' },
        { id: 'p2', title: 'Two' },
      ],
      [{ id: 'p3', title: 'Three' }],
    ])

    const options = seedOptions()
    const batches = await collect(createSeed(options)({ container, index: {} as never }))

    assert.deepEqual(batches, [
      [
        {
          action: 'upsert',
          documents: [
            { id: 'p1', title: 'One' },
            { id: 'p2', title: 'Two' },
          ],
        },
      ],
      [{ action: 'upsert', documents: [{ id: 'p3', title: 'Three' }] }],
    ])

    assert.deepEqual(calls[0].filters, { status: 'published' })
    assert.deepEqual(calls[1].filters, { status: 'published', $and: [{ id: { $gt: 'p2' } }] })
    assert.deepEqual(calls[0].pagination, { take: 2, order: { id: 'ASC' } })
    assert.equal(calls[0].withDeleted, false)
  })

  it('reconciles a catch-up page against the index filters, deleting soft-deleted and filtered-out rows', async () => {
    const since = new Date('2026-09-11T00:00:00.000Z')
    const { calls, container } = fakeContainer([
      [{ id: 'p1' }, { id: 'p2', deleted_at: '2026-09-11T10:00:00.000Z' }, { id: 'p3' }],
      [{ id: 'p1', title: 'One' }],
    ])

    const batches = await collect(
      createSeed(seedOptions({ batchSize: 5 }))({ container, index: {} as never, catchup: { since } }),
    )

    assert.deepEqual(batches, [
      [
        { action: 'upsert', documents: [{ id: 'p1', title: 'One' }] },
        { action: 'delete', filters: { id: ['p2', 'p3'] } },
      ],
    ])

    assert.deepEqual(calls[0].fields, ['id'])
    assert.deepEqual(calls[0].filters, { updated_at: { $gte: since } })
    assert.equal(calls[0].withDeleted, true)
    assert.deepEqual(calls[1].filters, { status: 'published', id: ['p1', 'p2', 'p3'] })
    assert.equal(calls[1].withDeleted, undefined)
  })

  it('pages by a custom primary key and passes the query context', async () => {
    const { calls, container } = fakeContainer([
      [
        { id: 'p1', handle: 'a', title: 'One' },
        { id: 'p2', handle: 'b', title: 'Two' },
      ],
      [],
    ])

    const options = seedOptions({ primaryKey: 'handle', queryContext: () => ({ region_id: 'reg_1' }) })

    await collect(createSeed(options)({ container, index: {} as never }))

    assert.deepEqual(calls[0].context, { region_id: 'reg_1' })
    assert.deepEqual(calls[1].filters, { status: 'published', $and: [{ handle: { $gt: 'b' } }] })
  })

  it('rejects a transform that drops the document id', async () => {
    const { container } = fakeContainer([[{ id: 'p1', title: 'One' }]])
    const options = seedOptions({
      transform: (entity) => {
        return { id: '', title: String(entity.title) }
      },
    })

    await assert.rejects(collect(createSeed(options)({ container, index: {} as never })), /without an "id"/)
  })
})

describe('product consume', () => {
  it('reindexes the parent product when a variant is deleted', async () => {
    const [definition] = defineProductSearchIndex()
    const { calls, container } = fakeContainer([[{ product_id: 'p1' }], [{ id: 'p1', title: 'One' }]])

    const mutations = await definition.consume!(
      { name: 'product-variant.deleted', data: { id: 'variant_1' } },
      { container, index: {} as never },
    )

    assert.equal(calls[0].entity, 'product_variant')
    assert.equal(calls[0].withDeleted, true)
    assert.deepEqual(calls[1].filters, { status: 'published', id: ['p1'] })
    assert.equal(mutations.length, 1)
    assert.equal(mutations[0].action, 'upsert')
  })

  it('deletes a deleted product without reading it back', async () => {
    const [definition] = defineProductSearchIndex()
    const { calls, container } = fakeContainer([])

    const mutations = await definition.consume!(
      { name: 'product.deleted', data: { id: 'p1' } },
      { container, index: {} as never },
    )

    assert.deepEqual(mutations, [{ action: 'delete', filters: { id: ['p1'] } }])
    assert.equal(calls.length, 0)
  })
})

describe('graph helpers', () => {
  it('projects only the declared paths', () => {
    const tree = buildPathTree(['id', 'variants.sku'])
    const projected = projectPaths({ id: 'p1', title: 'drop me', variants: [{ sku: 'A', barcode: 'drop me' }] }, tree)

    assert.deepEqual(projected, { id: 'p1', variants: [{ sku: 'A' }] })
  })

  it('always carries the id through the default transform', () => {
    const transform = createDefaultTransform(PRODUCT_GRAPH_FIELDS)
    const document = transform({ id: 'p1', title: 'Shirt', secret: 'drop me' }, { index: 'products' })

    assert.deepEqual(document, { id: 'p1', title: 'Shirt' })
  })

  it('reads ids off either event shape', () => {
    assert.deepEqual(resolveEventIds({ name: 'product.updated', data: { id: 'p1' } }), ['p1'])
    assert.deepEqual(resolveEventIds({ name: 'product.updated', data: { ids: ['p1', 'p2'] } }), ['p1', 'p2'])
    assert.deepEqual(resolveEventIds({ name: 'product.updated', data: [{ id: 'p1' }] }), ['p1'])
    assert.deepEqual(resolveEventIds({ name: 'product.updated', data: {} }), [])
  })

  it('normalizes both event namespaces to entity and action', () => {
    assert.deepEqual(parseEventName('product.updated'), { entity: 'product', action: 'updated' })
    assert.deepEqual(parseEventName('product.product.updated'), { entity: 'product', action: 'updated' })
    assert.deepEqual(parseEventName('product.product-variant.deleted'), {
      entity: 'product-variant',
      action: 'deleted',
    })
    assert.deepEqual(parseEventName('product-variant.deleted'), { entity: 'product-variant', action: 'deleted' })
  })
})
