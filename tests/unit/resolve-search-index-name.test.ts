import { MedusaModule } from '@medusajs/modules-sdk'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import { resolveSearchIndexName } from '../../src/api/utils/search'
import { defineProductSearchIndex } from '../../src/indexes/products'

// @medusajs/search >= 2.20: listIndexes() is async and resolves to index records, not names.
function searchModuleWith(names: string[]) {
  return {
    listIndexes: async () => names.map((name) => ({ name })),
  }
}

afterEach(() => {
  MedusaModule.clearInstances()
})

describe('resolveSearchIndexName', () => {
  it('returns a promise and resolves an explicit registered index', async () => {
    const pending = resolveSearchIndexName({
      searchModule: searchModuleWith(['products', 'categories']),
      entity: 'product',
      explicitIndex: 'categories',
    })
    assert.ok(pending instanceof Promise)
    assert.equal(await pending, 'categories')
  })

  it('rejects an explicit index that is not registered, naming the registered ones', async () => {
    await assert.rejects(
      resolveSearchIndexName({
        searchModule: searchModuleWith(['products']),
        entity: 'product',
        explicitIndex: 'nope',
      }),
      /Unknown search index "nope"\. Registered indexes: products\./,
    )
  })

  it('resolves the entity default when no explicit index is given', async () => {
    defineProductSearchIndex()

    const name = await resolveSearchIndexName({
      searchModule: searchModuleWith(['products']),
      entity: 'product',
    })
    assert.equal(name, 'products')
  })
})
