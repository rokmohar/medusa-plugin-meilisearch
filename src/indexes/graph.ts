import type { Event, QueryContextType, SearchTypes } from '@medusajs/types'
import { MedusaError } from '@medusajs/utils'
import type { ResolvedFactoryOptions, SearchDocumentTransform } from './types'

type PathTree = Map<string, PathTree>

interface GraphInput {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
  pagination?: { take?: number; skip?: number; order?: Record<string, 'ASC' | 'DESC'> }
  withDeleted?: boolean
  context?: QueryContextType
}

const ID_FIELD = 'id'
const UPDATED_AT_FIELD = 'updated_at'

type GraphQuery = SearchTypes.SearchContainer['query']

export function buildPathTree(paths: string[]): PathTree {
  const tree: PathTree = new Map()

  for (const path of paths) {
    let node = tree

    for (const segment of path.split('.')) {
      if (segment === '*') {
        continue
      }

      const next = node.get(segment) ?? new Map<string, PathTree>()

      node.set(segment, next)
      node = next
    }
  }

  return tree
}

export function projectPaths(value: unknown, tree: PathTree): unknown {
  if (!tree.size) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      return projectPaths(entry, tree)
    })
  }

  if (!isRecord(value)) {
    return value
  }

  const result: Record<string, unknown> = {}

  for (const [key, child] of tree) {
    if (key in value) {
      result[key] = projectPaths(value[key], child)
    }
  }

  return result
}

export function createDefaultTransform(paths: string[]): SearchDocumentTransform {
  const tree = buildPathTree(paths)

  return (entity) => {
    const projected = projectPaths(entity, tree)

    return { ...(isRecord(projected) ? projected : {}), id: String(entity.id) }
  }
}

export function createSeed(options: ResolvedFactoryOptions): SearchTypes.SearchIndexDefinition['seed'] {
  const primaryKey = options.primaryKey

  return async function* seed(context) {
    const { container, filters, last_key: lastKey, catchup } = context
    let cursor = lastKey

    for (;;) {
      const data = await runGraph(container.query, options.locale, {
        entity: options.entity,
        fields: catchup ? [...new Set([ID_FIELD, primaryKey])] : options.graphFields,
        filters: withConstraints(catchup ? { ...filters } : { ...options.filters, ...filters }, [
          ...(catchup ? [{ [UPDATED_AT_FIELD]: { $gte: catchup.since } }] : []),
          ...(cursor !== undefined ? [{ [primaryKey]: { $gt: cursor } }] : []),
        ]),
        pagination: { take: options.batchSize, order: { [primaryKey]: 'ASC' } },
        withDeleted: !!catchup,
        ...(catchup ? {} : resolveQueryContext(options, context)),
      })

      if (!data.length) {
        return
      }

      const mutations = catchup
        ? await reconcileIds(container.query, options, readIds(data), context)
        : upsertMutations(toDocuments(data, options))

      if (mutations.length) {
        yield mutations
      }

      if (data.length < options.batchSize) {
        return
      }

      cursor = String(data[data.length - 1][primaryKey])
    }
  }
}

function withConstraints(
  filters: Record<string, unknown>,
  constraints: Record<string, unknown>[],
): Record<string, unknown> {
  if (!constraints.length) {
    return filters
  }

  if (!Object.keys(filters).length) {
    return Object.assign({}, ...constraints)
  }

  const existing = Array.isArray(filters.$and) ? filters.$and : []

  return { ...filters, $and: [...existing, ...constraints] }
}

export async function reconcileIds(
  query: GraphQuery,
  options: ResolvedFactoryOptions,
  ids: string[],
  context: SearchTypes.SearchIngestionContext,
): Promise<SearchTypes.SearchMutation[]> {
  if (!ids.length) {
    return []
  }

  const data = await runGraph(query, options.locale, {
    entity: options.entity,
    fields: options.graphFields,
    filters: { ...options.filters, [ID_FIELD]: ids },
    ...resolveQueryContext(options, context),
  })

  const documents = toDocuments(data, options)
  const found = new Set(
    documents.map((document) => {
      return String(document.id)
    }),
  )

  const missing = ids.filter((id) => {
    return !found.has(id)
  })

  const mutations = upsertMutations(documents)

  if (missing.length) {
    mutations.push({ action: 'delete', filters: { [ID_FIELD]: missing } })
  }

  return mutations
}

function toDocuments(data: Record<string, unknown>[], options: ResolvedFactoryOptions): SearchTypes.SearchDocument[] {
  return data.map((entity) => {
    const document = options.transform(entity, { index: options.name, locale: options.locale })

    if (!document.id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Search index "${options.name}": transform returned a document without an "id".`,
      )
    }

    return document
  })
}

function upsertMutations(documents: SearchTypes.SearchDocument[]): SearchTypes.SearchMutation[] {
  return documents.length ? [{ action: 'upsert', documents }] : []
}

function readIds(data: Record<string, unknown>[]): string[] {
  return data.map((entity) => {
    return String(entity[ID_FIELD])
  })
}

function resolveQueryContext(
  options: ResolvedFactoryOptions,
  context: SearchTypes.SearchIngestionContext,
): { context?: QueryContextType } {
  const resolved = typeof options.queryContext === 'function' ? options.queryContext(context) : options.queryContext

  return resolved ? { context: resolved } : {}
}

export async function resolveRelatedIds(
  query: GraphQuery,
  input: { entity: string; field: string; filters: Record<string, unknown>; withDeleted?: boolean },
): Promise<string[]> {
  const data = await runGraph(query, undefined, {
    entity: input.entity,
    fields: [input.field],
    filters: input.filters,
    withDeleted: input.withDeleted,
  })

  const ids = data.flatMap((entity) => {
    return readPathValues(entity, input.field)
  })

  return [...new Set(ids)]
}

export async function runGraph(
  query: GraphQuery,
  locale: string | undefined,
  input: GraphInput,
): Promise<Record<string, unknown>[]> {
  const { data } = await query.graph(input, locale ? { locale } : undefined)

  return Array.isArray(data) ? data.filter(isRecord) : []
}

export function resolveEventIds(event: Event<unknown>): string[] {
  const data: unknown = event.data

  if (Array.isArray(data)) {
    return data.flatMap((entry) => {
      return isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []
    })
  }

  if (!isRecord(data)) {
    return []
  }

  if (typeof data.id === 'string') {
    return [data.id]
  }

  if (Array.isArray(data.ids)) {
    return data.ids.filter((id): id is string => {
      return typeof id === 'string'
    })
  }

  return []
}

export function parseEventName(name: string): { entity: string; action: string } {
  const segments = name.split('.')
  const action = segments[segments.length - 1]
  const entity = segments.length > 2 ? segments[segments.length - 2] : segments[0]

  return { entity, action }
}

function readPathValues(source: Record<string, unknown>, path: string): string[] {
  let current: unknown[] = [source]

  for (const segment of path.split('.')) {
    current = current.flatMap((entry) => {
      if (!isRecord(entry)) {
        return []
      }

      const value = entry[segment]

      return Array.isArray(value) ? value : [value]
    })
  }

  return current.filter((value): value is string => {
    return typeof value === 'string'
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
