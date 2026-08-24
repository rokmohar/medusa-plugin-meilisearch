import type { SearchTypes } from '@medusajs/types'
import { MedusaError } from '@medusajs/utils'
import { shadowAttribute, toTimestamp } from './documents'

export type DateAttributePredicate = (path: string) => boolean

const NO_DATE_ATTRIBUTES: DateAttributePredicate = () => {
  return false
}

export function compileFilters(
  filters: SearchTypes.SearchFilters | undefined,
  isDateAttribute: DateAttributePredicate = NO_DATE_ATTRIBUTES,
): string | undefined {
  if (!filters) {
    return undefined
  }

  const clauses = compileNode(filters, isDateAttribute)

  if (!clauses.length) {
    return undefined
  }

  return join(clauses, 'AND')
}

function compileNode(filters: SearchTypes.SearchFilters, isDateAttribute: DateAttributePredicate): string[] {
  const clauses: string[] = []

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || key === 'q') {
      continue
    }

    if (key === '$and' || key === '$or') {
      const branches = asFilterArray(key, value).flatMap((branch) => {
        const compiled = compileNode(branch, isDateAttribute)

        return compiled.length ? [join(compiled, 'AND')] : []
      })

      if (branches.length) {
        clauses.push(join(branches, key === '$and' ? 'AND' : 'OR'))
      }

      continue
    }

    if (key === '$not') {
      const compiled = compileNode(asFilters(key, value), isDateAttribute)

      if (compiled.length) {
        clauses.push(`NOT ${join(compiled, 'AND')}`)
      }

      continue
    }

    clauses.push(...compileField(key, value, isDateAttribute))
  }

  return clauses
}

function compileField(path: string, value: unknown, isDateAttribute: DateAttributePredicate): string[] {
  if (isOperatorMap(value)) {
    return compileOperators(path, value, isDateAttribute)
  }

  if (Array.isArray(value)) {
    return [inClause(path, value, isDateAttribute)]
  }

  return [comparison(path, '=', value, isDateAttribute)]
}

function compileOperators(
  path: string,
  operators: Record<string, unknown>,
  isDateAttribute: DateAttributePredicate,
): string[] {
  const clauses: string[] = []

  for (const [operator, operand] of Object.entries(operators)) {
    if (operand === undefined) {
      continue
    }

    switch (operator) {
      case '$eq':
        clauses.push(comparison(path, '=', operand, isDateAttribute))
        break
      case '$ne':
        clauses.push(comparison(path, '!=', operand, isDateAttribute))
        break
      case '$lt':
        clauses.push(comparison(path, '<', operand, isDateAttribute))
        break
      case '$lte':
        clauses.push(comparison(path, '<=', operand, isDateAttribute))
        break
      case '$gt':
        clauses.push(comparison(path, '>', operand, isDateAttribute))
        break
      case '$gte':
        clauses.push(comparison(path, '>=', operand, isDateAttribute))
        break
      case '$in':
        clauses.push(inClause(path, asArray(path, operator, operand), isDateAttribute))
        break
      case '$nin':
        clauses.push(`NOT ${inClause(path, asArray(path, operator, operand), isDateAttribute)}`)
        break
      case '$exists':
        clauses.push(operand === false ? `${path} NOT EXISTS` : `${path} EXISTS`)
        break
      case '$contains': {
        const values = Array.isArray(operand) ? operand : [operand]

        clauses.push(
          join(
            values.map((entry) => {
              return comparison(path, '=', entry, isDateAttribute)
            }),
            'AND',
          ),
        )
        break
      }

      case '$overlaps':
        clauses.push(inClause(path, asArray(path, operator, operand), isDateAttribute))
        break
      default:
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Meilisearch cannot filter "${path}" with "${operator}" — it has no substring or prefix filter. ` +
            `Index the value you want to match as a keyword field, or pass a raw Meilisearch filter through ` +
            `search_options.provider_options.meilisearch.filter.`,
        )
    }
  }

  return clauses
}

function comparison(path: string, operator: string, value: unknown, isDateAttribute: DateAttributePredicate): string {
  if (value === null) {
    return operator === '!=' ? `${path} IS NOT NULL` : `${path} IS NULL`
  }

  const target = resolveTarget(path, value, isDateAttribute)

  return `${target.path} ${operator} ${target.literal}`
}

function inClause(path: string, values: unknown[], isDateAttribute: DateAttributePredicate): string {
  if (!values.length) {
    return `${path} IN []`
  }

  const targets = values.map((value) => {
    return resolveTarget(path, value, isDateAttribute)
  })

  return `${targets[0].path} IN [${targets
    .map((target) => {
      return target.literal
    })
    .join(', ')}]`
}

function resolveTarget(
  path: string,
  value: unknown,
  isDateAttribute: DateAttributePredicate,
): { path: string; literal: string } {
  const timestamp = isDateAttribute(path) ? toTimestamp(value) : value instanceof Date ? value.getTime() : undefined

  if (timestamp !== undefined) {
    return { path: shadowAttribute(path), literal: String(timestamp) }
  }

  return { path, literal: literal(path, value) }
}

function literal(path: string, value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (typeof value === 'string') {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `Meilisearch cannot filter "${path}" by a value of type ${typeof value}.`,
  )
}

export function extractPrimaryKeyIds(filters: SearchTypes.SearchFilters, primaryKey: string): string[] | undefined {
  const keys = Object.keys(filters).filter((key) => {
    return filters[key] !== undefined
  })

  if (keys.length !== 1 || keys[0] !== primaryKey) {
    return undefined
  }

  const value: unknown = filters[primaryKey]

  if (typeof value === 'string') {
    return [value]
  }

  if (Array.isArray(value)) {
    return value.every((entry) => {
      return typeof entry === 'string'
    })
      ? value
      : undefined
  }

  if (!isOperatorMap(value)) {
    return undefined
  }

  const operators = Object.keys(value).filter((operator) => {
    return value[operator] !== undefined
  })

  if (operators.length !== 1) {
    return undefined
  }

  const [operator] = operators
  const operand = value[operator]

  if (operator === '$eq' && typeof operand === 'string') {
    return [operand]
  }

  if (
    operator === '$in' &&
    Array.isArray(operand) &&
    operand.every((entry) => {
      return typeof entry === 'string'
    })
  ) {
    return operand
  }

  return undefined
}

function join(clauses: string[], operator: 'AND' | 'OR'): string {
  if (clauses.length === 1) {
    return clauses[0]
  }

  return `(${clauses.join(` ${operator} `)})`
}

function isOperatorMap(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
    return false
  }

  return Object.keys(value).some((key) => {
    return key.startsWith('$')
  })
}

function asArray(path: string, operator: string, value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${operator}" on "${path}" expects an array of values.`)
  }

  return value
}

function asFilterArray(key: string, value: unknown): SearchTypes.SearchFilters[] {
  if (!Array.isArray(value)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${key}" expects an array of filter objects.`)
  }

  return value.map((entry) => {
    return asFilters(key, entry)
  })
}

function asFilters(key: string, value: unknown): SearchTypes.SearchFilters {
  if (!isFilters(value)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `"${key}" expects a filter object.`)
  }

  return value
}

function isFilters(value: unknown): value is SearchTypes.SearchFilters {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
