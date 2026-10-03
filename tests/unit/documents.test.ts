import type { SearchTypes } from '@medusajs/types'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  encodeDocument,
  readVector,
  shadowAttribute,
  stripShadowAttributes,
  toTimestamp,
} from '../../src/providers/meilisearch/utils/documents'

const iso = '2026-01-02T03:04:05.000Z'
const epoch = Date.parse(iso)

const plan = {
  dateAttributes: new Set(['created_at', 'updated_at', 'collection.created_at', 'variants.created_at', 'released']),
  vectorAttributes: new Map<string, SearchTypes.SearchFieldDefinition>([
    ['embedding', { type: 'vector', dimensions: 3 }],
    ['summary', { type: 'vector', dimensions: 3, embed: true }],
  ]),
}

describe('encodeDocument', () => {
  it('adds a numeric shadow next to every date value', () => {
    const encoded = encodeDocument({ id: 'prod_1', created_at: new Date(iso) }, plan)

    assert.equal(encoded.created_at, iso)
    assert.equal(encoded.created_at__ts, epoch)
  })

  it('shadows declared date fields only', () => {
    const encoded = encodeDocument({ id: 'prod_1', updated_at: iso, handle: '2026-01-02' }, plan)

    assert.equal(encoded.updated_at__ts, epoch)
    assert.equal(encoded.handle__ts, undefined)
  })

  it('keeps a null date as a null shadow so null filters match it', () => {
    const encoded = encodeDocument({ id: 'prod_1', created_at: null }, plan)

    assert.equal(encoded.created_at__ts, null)
  })

  it('shadows every entry of a date array', () => {
    const encoded = encodeDocument({ id: 'prod_1', released: [iso, new Date(iso)] }, plan)

    assert.deepEqual(encoded.released__ts, [epoch, epoch])
  })

  it('recurses into nested objects and arrays', () => {
    const encoded = encodeDocument(
      {
        id: 'prod_1',
        collection: { created_at: iso },
        variants: [{ id: 'v1', created_at: iso }],
      },
      plan,
    )

    assert.equal((encoded.collection as Record<string, unknown>).created_at__ts, epoch)
    assert.equal((encoded.variants as Record<string, unknown>[])[0].created_at__ts, epoch)
  })

  it('moves supplied embeddings under _vectors and leaves engine-embedded fields alone', () => {
    const encoded = encodeDocument({ id: 'prod_1', embedding: [1, 2, 3], summary: 'A shirt' }, plan)

    assert.deepEqual(encoded._vectors, { embedding: [1, 2, 3] })
    assert.equal(encoded.embedding, undefined)
    assert.equal(encoded.summary, 'A shirt')
  })
})

describe('readVector', () => {
  it('reads the first embedding Meilisearch returns for an embedder', () => {
    assert.deepEqual(readVector({ embedding: { embeddings: [[1, 2, 3]], regenerate: false } }, 'embedding'), [1, 2, 3])
    assert.deepEqual(readVector({ embedding: [1, 2, 3] }, 'embedding'), [1, 2, 3])
    assert.equal(readVector(undefined, 'embedding'), undefined)
  })
})

describe('stripShadowAttributes', () => {
  it('removes shadows at every depth', () => {
    const stripped = stripShadowAttributes({
      id: 'prod_1',
      created_at: iso,
      created_at__ts: epoch,
      collection: { title: 'x', created_at__ts: epoch },
      variants: [{ id: 'v1', created_at__ts: epoch }],
    })

    assert.deepEqual(stripped, {
      id: 'prod_1',
      created_at: iso,
      collection: { title: 'x' },
      variants: [{ id: 'v1' }],
    })
  })
})

describe('toTimestamp', () => {
  it('parses dates and ISO strings only', () => {
    assert.equal(toTimestamp(new Date(iso)), epoch)
    assert.equal(toTimestamp(iso), epoch)
    assert.equal(toTimestamp('2026-01-02'), Date.parse('2026-01-02'))
    assert.equal(toTimestamp('shirt'), undefined)
    assert.equal(toTimestamp(42), undefined)
  })
})

describe('shadowAttribute', () => {
  it('suffixes the path', () => {
    assert.equal(shadowAttribute('created_at'), 'created_at__ts')
  })
})
