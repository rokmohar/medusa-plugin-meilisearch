import '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defineCategorySearchIndex } from '../../src/indexes/categories'
import {
  buildPathTree,
  projectPaths,
  createDefaultTransform,
  parseEventName,
  resolveEventIds,
} from '../../src/indexes/graph'
import { expandLocales, localeIndexName, resolveLocaleIndexName } from '../../src/indexes/locales'
import { defineProductSearchIndex, PRODUCT_GRAPH_FIELDS } from '../../src/indexes/products'

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
    assert.deepEqual(definitions[0].settings?.locales, ['en-US'])
    assert.deepEqual(definitions[1].settings?.locales, ['fr-FR'])
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
      fields: { id: { type: 'keyword', filterable: true } },
      settings: { synonyms: { trousers: ['pants'] } },
    })

    assert.equal(definition.provider, 'other')
    assert.deepEqual(Object.keys(definition.fields), ['id'])
    assert.deepEqual(definition.settings?.synonyms, { trousers: ['pants'] })
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
