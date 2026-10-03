import { MedusaError } from '@medusajs/utils'
import { MeilisearchApiError } from 'meilisearch'

export const INDEX_NOT_FOUND = 'index_not_found'

const TOO_MANY_REQUESTS = 429

export function isIndexNotFound(error: unknown): error is MeilisearchApiError {
  return error instanceof MeilisearchApiError && error.cause?.code === INDEX_NOT_FOUND
}

export function indexNotFound(message: string): MedusaError {
  return new MedusaError(MedusaError.Types.NOT_FOUND, message)
}

export function parseRetryAfter(header: string | null): number | undefined {
  const seconds = Number(header)

  return header && Number.isFinite(seconds) ? seconds * 1000 : undefined
}

export function translateError(error: unknown): unknown {
  if (isIndexNotFound(error)) {
    return indexNotFound(error.message)
  }

  if (error instanceof MeilisearchApiError && error.response.status === TOO_MANY_REQUESTS) {
    return Object.assign(error, {
      status: TOO_MANY_REQUESTS,
      retry_after: parseRetryAfter(error.response.headers.get('retry-after')),
    })
  }

  return error
}

export async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw translateError(error)
  }
}
