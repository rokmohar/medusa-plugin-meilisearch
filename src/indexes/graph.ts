import type { Event, SearchTypes } from '@medusajs/types'
import type { ResolvedFactoryOptions, SearchDocumentTransform } from './types'

type PathTree = Map<string, PathTree>

interface GraphInput {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
  pagination?: { take?: number; skip?: number; order?: Record<string, 'ASC' | 'DESC'> }
  withDeleted?: boolean
}

const DELETED_AT_FIELD = 'deleted_at'
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

  return async function* seed({ container, filters, last_key: lastKey, catchup }) {
    const fields = catchup ? [...new Set([...options.graphFields, DELETED_AT_FIELD])] : options.graphFields
    let cursor = lastKey

    for (;;) {
      const data = await runGraph(container.query, options.locale, {
        entity: options.entity,
        fields,
        filters: withConstraints({ ...options.filters, ...filters }, [
          ...(catchup ? [{ [UPDATED_AT_FIELD]: { $gte: catchup.since } }] : []),
          ...(cursor !== undefined ? [{ [primaryKey]: { $gt: cursor } }] : []),
        ]),
        pagination: { take: options.batchSize, order: { [primaryKey]: 'ASC' } },
        withDeleted: !!catchup,
      })

      if (!data.length) {
        return
      }

      const documents: SearchTypes.SearchDocument[] = []
      const removedIds: string[] = []

      for (const entity of data) {
        if (catchup && entity[DELETED_AT_FIELD]) {
          removedIds.push(String(entity[primaryKey]))
          continue
        }

        documents.push(options.transform(entity, { index: options.name, locale: options.locale }))
      }

      const mutations: SearchTypes.SearchMutation[] = []

      if (documents.length) {
        mutations.push({ action: 'upsert', documents })
      }

      if (removedIds.length) {
        mutations.push({ action: 'delete', filters: { [primaryKey]: removedIds } })
      }

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
): Promise<SearchTypes.SearchMutation[]> {
  if (!ids.length) {
    return []
  }

  const data = await runGraph(query, options.locale, {
    entity: options.entity,
    fields: options.graphFields,
    filters: { ...options.filters, id: ids },
  })

  const documents = data.map((entity) => {
    return options.transform(entity, { index: options.name, locale: options.locale })
  })

  const found = new Set(
    documents.map((document) => {
      return document.id
    }),
  )

  const missing = ids.filter((id) => {
    return !found.has(id)
  })

  const mutations: SearchTypes.SearchMutation[] = []

  if (documents.length) {
    mutations.push({ action: 'upsert', documents })
  }

  if (missing.length) {
    mutations.push({ action: 'delete', filters: { id: missing } })
  }

  return mutations
}

export async function resolveRelatedIds(
  query: GraphQuery,
  input: { entity: string; field: string; filters: Record<string, unknown> },
): Promise<string[]> {
  const data = await runGraph(query, undefined, {
    entity: input.entity,
    fields: [input.field],
    filters: input.filters,
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
