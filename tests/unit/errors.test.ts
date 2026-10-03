import { MedusaError } from '@medusajs/utils'
import { MeilisearchApiError, type Task } from 'meilisearch'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MeilisearchSearchProviderService } from '../../src/providers/meilisearch/service'
import { guarded, parseRetryAfter, translateError } from '../../src/providers/meilisearch/utils/errors'

function apiError(status: number, code: string, headers: Record<string, string> = {}) {
  return new MeilisearchApiError(new Response(null, { status, headers }), {
    message: `${code} happened`,
    code,
    type: 'invalid_request',
    link: '',
  })
}

describe('translateError', () => {
  it('turns a missing index into a NOT_FOUND MedusaError so the module retries on the active version', () => {
    const translated = translateError(apiError(404, 'index_not_found'))

    assert.ok(translated instanceof MedusaError)
    assert.equal(translated.type, MedusaError.Types.NOT_FOUND)
    assert.equal(translated.message, 'index_not_found happened')
  })

  it('exposes status and retry_after on a rate-limited request for the seeding backoff', () => {
    const translated = translateError(apiError(429, 'too_many_requests', { 'retry-after': '3' }))

    assert.ok(translated instanceof MeilisearchApiError)
    assert.equal(Reflect.get(translated, 'status'), 429)
    assert.equal(Reflect.get(translated, 'retry_after'), 3000)
  })

  it('passes other errors through untouched', () => {
    const original = apiError(400, 'invalid_search_filter')
    const plain = new Error('boom')

    assert.equal(translateError(original), original)
    assert.equal(translateError(plain), plain)
  })

  it('reads Retry-After seconds and ignores anything else', () => {
    assert.equal(parseRetryAfter('2'), 2000)
    assert.equal(parseRetryAfter(null), undefined)
    assert.equal(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT'), undefined)
  })

  it('rethrows translated errors from a guarded operation', async () => {
    await assert.rejects(
      guarded(() => Promise.reject(apiError(404, 'index_not_found'))),
      (error: unknown) => error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND,
    )
  })
})

describe('MeilisearchSearchProviderService.waitForTask', () => {
  it('reports a write that failed on a dropped index version as NOT_FOUND', async () => {
    const service = new MeilisearchSearchProviderService({}, { config: { host: 'http://localhost:7700' } })

    const failed = {
      uid: 7,
      indexUid: 'products_v2',
      status: 'failed',
      error: { message: 'Index `products_v2` not found.', code: 'index_not_found', type: 'invalid_request', link: '' },
    } satisfies Partial<Task>

    service['client_'].tasks.waitForTask = () => Promise.resolve(failed as Task)

    await assert.rejects(
      service.waitForTask({ id: '7', index: 'products_v2', status: 'enqueued' }),
      (error: unknown) => error instanceof MedusaError && error.type === MedusaError.Types.NOT_FOUND,
    )
  })
})
