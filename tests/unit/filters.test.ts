import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compileFilters, extractPrimaryKeyIds } from '../../src/providers/meilisearch/utils/filters'

const isDate = (path: string) => {
  return path === 'created_at'
}

describe('compileFilters', () => {
  it('returns undefined for empty input', () => {
    assert.equal(compileFilters(undefined), undefined)
    assert.equal(compileFilters({}), undefined)
  })

  it('ignores the free-text key', () => {
    assert.equal(compileFilters({ q: 'shirt' }), undefined)
  })

  it('compiles equality, arrays and operator maps', () => {
    assert.equal(compileFilters({ status: 'published' }), 'status = "published"')
    assert.equal(compileFilters({ id: ['a', 'b'] }), 'id IN ["a", "b"]')
    assert.equal(compileFilters({ rank: { $gte: 3 } }), 'rank >= 3')
    assert.equal(compileFilters({ is_active: true }), 'is_active = true')
    assert.equal(compileFilters({ handle: { $ne: 'x' } }), 'handle != "x"')
    assert.equal(compileFilters({ type_id: { $nin: ['a'] } }), 'NOT type_id IN ["a"]')
    assert.equal(compileFilters({ subtitle: { $exists: false } }), 'subtitle NOT EXISTS')
  })

  it('maps null to IS NULL / IS NOT NULL', () => {
    assert.equal(compileFilters({ collection_id: null }), 'collection_id IS NULL')
    assert.equal(compileFilters({ collection_id: { $ne: null } }), 'collection_id IS NOT NULL')
  })

  it('ANDs $contains and ORs $overlaps into IN', () => {
    assert.equal(compileFilters({ 'tags.value': { $contains: ['a', 'b'] } }), '(tags.value = "a" AND tags.value = "b")')
    assert.equal(compileFilters({ 'tags.value': { $overlaps: ['a', 'b'] } }), 'tags.value IN ["a", "b"]')
  })

  it('combines $and, $or and $not', () => {
    const filter = compileFilters({
      $or: [{ status: 'published' }, { status: 'draft' }],
      $not: { handle: 'hidden' },
    })

    assert.equal(filter, '((status = "published" OR status = "draft") AND NOT handle = "hidden")')
  })

  it('rewrites date filters onto the numeric shadow attribute', () => {
    const iso = '2026-01-02T03:04:05.000Z'
    const epoch = Date.parse(iso)

    assert.equal(compileFilters({ created_at: { $gt: iso } }, isDate), `created_at__ts > ${epoch}`)
    assert.equal(compileFilters({ created_at: { $lt: new Date(iso) } }), `created_at__ts < ${epoch}`)
  })

  it('escapes quotes and backslashes in string values', () => {
    assert.equal(compileFilters({ title: 'say "hi"' }), 'title = "say \\"hi\\""')
  })

  it('matches nothing for an empty $in', () => {
    assert.equal(compileFilters({ id: { $in: [] } }), 'id IN []')
  })

  it('rejects operators Meilisearch cannot express', () => {
    assert.throws(() => {
      return compileFilters({ title: { $like: '%shirt%' } })
    }, /cannot filter/)

    assert.throws(() => {
      return compileFilters({ title: { $prefix: 'shi' } })
    }, /cannot filter/)
  })
})

describe('extractPrimaryKeyIds', () => {
  it('recognises the by-id shapes', () => {
    assert.deepEqual(extractPrimaryKeyIds({ id: 'prod_1' }, 'id'), ['prod_1'])
    assert.deepEqual(extractPrimaryKeyIds({ id: ['prod_1', 'prod_2'] }, 'id'), ['prod_1', 'prod_2'])
    assert.deepEqual(extractPrimaryKeyIds({ id: { $eq: 'prod_1' } }, 'id'), ['prod_1'])
    assert.deepEqual(extractPrimaryKeyIds({ id: { $in: ['prod_1'] } }, 'id'), ['prod_1'])
  })

  it('declines anything broader than the primary key', () => {
    assert.equal(extractPrimaryKeyIds({ id: 'prod_1', status: 'published' }, 'id'), undefined)
    assert.equal(extractPrimaryKeyIds({ status: 'published' }, 'id'), undefined)
    assert.equal(extractPrimaryKeyIds({ id: { $ne: 'prod_1' } }, 'id'), undefined)
    assert.equal(extractPrimaryKeyIds({ id: { $in: [1] } }, 'id'), undefined)
    assert.equal(extractPrimaryKeyIds({ handle: 'shirt' }, 'id'), undefined)
  })
})
