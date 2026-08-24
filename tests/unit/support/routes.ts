import type { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules } from '@medusajs/utils'

export interface GraphCall {
  entity: string
  fields: string[]
  filters: Record<string, unknown>
  pagination: { skip?: number; take?: number }
  context?: Record<string, unknown>
}

export interface FakeQuery {
  calls: GraphCall[]
  graph: (config: GraphCall) => Promise<{ data: unknown[]; metadata: Record<string, unknown> }>
}

export function createQuery(data: Record<string, unknown>[]): FakeQuery {
  const calls: GraphCall[] = []

  return {
    calls,
    graph: async (config: GraphCall) => {
      calls.push(config)

      return {
        data,
        metadata: { count: data.length, skip: config.pagination.skip, take: config.pagination.take },
      }
    },
  }
}

export interface FakeSearchModule {
  searchCalls: Record<string, unknown>[]
  reindexCalls: Record<string, unknown>[]
  listIndexes: () => string[]
  listRetrievableFields: (index: string) => string[]
  search: (query: Record<string, unknown>) => Promise<unknown>
  reindex: (input: Record<string, unknown>) => Promise<{ indexes: string[]; job_id: string }>
}

export function createSearchModule(
  options: {
    indexes?: string[]
    retrievableFields?: string[]
    hits?: { id: string; document?: Record<string, unknown>; score?: number; highlights?: unknown }[]
    count?: number
    facets?: Record<string, unknown>
    processingTimeMs?: number
    reindex?: () => Promise<{ indexes: string[]; job_id: string }>
  } = {},
): FakeSearchModule {
  const searchCalls: Record<string, unknown>[] = []
  const reindexCalls: Record<string, unknown>[] = []
  const hits = options.hits ?? []

  return {
    searchCalls,
    reindexCalls,
    listIndexes: () => options.indexes ?? ['products'],
    listRetrievableFields: () => options.retrievableFields ?? ['id', 'title'],
    search: async (query: Record<string, unknown>) => {
      searchCalls.push(query)

      return {
        hits: hits.map((hit) => ({ id: hit.id, document: hit.document ?? { id: hit.id }, score: hit.score })),
        facets: options.facets,
        metadata: {
          count: options.count ?? hits.length,
          processing_time_ms: options.processingTimeMs,
        },
      }
    },
    reindex: async (input: Record<string, unknown>) => {
      reindexCalls.push(input)

      return options.reindex ? options.reindex() : { indexes: ['products'], job_id: 'job_1' }
    },
  }
}

export interface FakeLogger {
  infos: string[]
  errors: string[]
  info: (message: string) => void
  error: (message: string) => void
}

export function createLogger(): FakeLogger {
  const infos: string[] = []
  const errors: string[] = []

  return {
    infos,
    errors,
    info: (message: string) => {
      infos.push(message)
    },
    error: (message: string) => {
      errors.push(message)
    },
  }
}

export function createRequest<TRequest extends MedusaRequest = MedusaRequest>(
  overrides: Partial<TRequest>,
  registrations: Record<string, unknown> = {},
): TRequest {
  const request = {
    filterableFields: {},
    ...overrides,
    scope: {
      resolve: <T>(key: string, resolveOptions?: { allowUnregistered?: boolean }): T => {
        if (!Object.hasOwn(registrations, key) && resolveOptions?.allowUnregistered !== true) {
          throw new Error(`Unexpected container resolution: ${key}`)
        }

        return registrations[key] as T
      },
    },
  }

  return request as TRequest
}

export function createResponse<T>(): { res: MedusaResponse<T>; payloads: T[] } {
  const payloads: T[] = []
  const response = {
    json: (payload: T): void => {
      payloads.push(payload)
    },
  }

  return { res: response as MedusaResponse<T>, payloads }
}

export const QUERY_KEY: string = ContainerRegistrationKeys.QUERY
export const LOGGER_KEY: string = ContainerRegistrationKeys.LOGGER
export const SEARCH_KEY: string = Modules.SEARCH
