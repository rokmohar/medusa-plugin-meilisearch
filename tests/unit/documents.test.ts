import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  encodeDocument,
  shadowAttribute,
  stripShadowAttributes,
  toTimestamp,
} from '../../src/providers/meilisearch/utils/documents'

const iso = '2026-01-02T03:04:05.000Z'
const epoch = Date.parse(iso)

describe('encodeDocument', () => {
  it('adds a numeric shadow next to every date value', () => {
    const encoded = encodeDocument({ id: 'prod_1', created_at: new Date(iso) })

    assert.equal(encoded.created_at, iso)
    assert.equal(encoded.created_at__ts, epoch)
  })

  it('recognises ISO strings and leaves other strings alone', () => {
    const encoded = encodeDocument({ id: 'prod_1', updated_at: iso, handle: '2024-shirt' })

    assert.equal(encoded.updated_at__ts, epoch)
    assert.equal(encoded.handle__ts, undefined)
  })

  it('recurses into nested objects and arrays', () => {
    const encoded = encodeDocument({
      id: 'prod_1',
      collection: { created_at: iso },
      variants: [{ id: 'v1', created_at: iso }],
    })

    assert.equal((encoded.collection as Record<string, unknown>).created_at__ts, epoch)
    assert.equal((encoded.variants as Record<string, unknown>[])[0].created_at__ts, epoch)
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
