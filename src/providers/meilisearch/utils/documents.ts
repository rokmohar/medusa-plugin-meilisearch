import type { SearchTypes } from '@medusajs/types'
import { DATE_SHADOW_SUFFIX } from '../types'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

export function encodeDocument(document: SearchTypes.SearchDocument): Record<string, unknown> {
  const encoded = encodeValue(document)

  if (!isRecord(encoded)) {
    return document
  }

  return encoded
}

function encodeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map(encodeValue)
  }

  if (!isRecord(value)) {
    return value
  }

  const result: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(value)) {
    result[key] = encodeValue(entry)

    const timestamp = toTimestamp(entry)

    if (timestamp !== undefined) {
      result[`${key}${DATE_SHADOW_SUFFIX}`] = timestamp
    }
  }

  return result
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
