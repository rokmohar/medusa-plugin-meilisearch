import type { SearchTypes } from '@medusajs/types'
import { DATE_SHADOW_SUFFIX, VECTORS_ATTRIBUTE } from '../types'
import type { IndexPlan } from './settings'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

export function encodeDocument(
  document: SearchTypes.SearchDocument,
  plan: Pick<IndexPlan, 'dateAttributes' | 'vectorAttributes'>,
): Record<string, unknown> {
  const encoded = encodeRecord(document, '', plan.dateAttributes)
  const vectors: Record<string, unknown> = {}

  for (const [path, field] of plan.vectorAttributes) {
    if (field.embed || !Object.hasOwn(encoded, path)) {
      continue
    }

    vectors[path] = encoded[path]
    delete encoded[path]
  }

  if (Object.keys(vectors).length) {
    encoded[VECTORS_ATTRIBUTE] = vectors
  }

  return encoded
}

function encodeRecord(
  record: Record<string, unknown>,
  prefix: string,
  dateAttributes: Set<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(record)) {
    const path = prefix ? `${prefix}.${key}` : key

    result[key] = encodeValue(entry, path, dateAttributes)

    if (dateAttributes.has(path) && entry !== undefined) {
      result[shadowAttribute(key)] = toShadowValue(entry)
    }
  }

  return result
}

function encodeValue(value: unknown, path: string, dateAttributes: Set<string>): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((entry) => {
      return encodeValue(entry, path, dateAttributes)
    })
  }

  if (!isRecord(value)) {
    return value
  }

  return encodeRecord(value, path, dateAttributes)
}

function toShadowValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toTimestamp).filter((timestamp) => {
      return timestamp !== undefined
    })
  }

  return value === null ? null : (toTimestamp(value) ?? null)
}

export function readVector(vectors: unknown, path: string): number[] | undefined {
  const entry: unknown = isRecord(vectors) ? vectors[path] : undefined
  const embeddings: unknown = isRecord(entry) ? entry.embeddings : entry

  if (!Array.isArray(embeddings)) {
    return undefined
  }

  const [first]: unknown[] = embeddings

  return Array.isArray(first) ? first.filter(isNumber) : embeddings.filter(isNumber)
}

export function stripShadowAttributes(document: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(document)) {
    if (key.endsWith(DATE_SHADOW_SUFFIX)) {
      continue
    }

    result[key] = Array.isArray(value)
      ? value.map((entry) => {
          return isRecord(entry) ? stripShadowAttributes(entry) : entry
        })
      : isRecord(value)
        ? stripShadowAttributes(value)
        : value
  }

  return result
}

export function shadowAttribute(path: string): string {
  return `${path}${DATE_SHADOW_SUFFIX}`
}

export function toTimestamp(value: unknown): number | undefined {
  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === 'string' && ISO_DATE.test(value)) {
    const parsed = Date.parse(value)

    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
