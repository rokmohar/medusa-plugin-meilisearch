import type { SearchTypes } from '@medusajs/types'
import { MedusaError } from '@medusajs/utils'
import type { Embedders, Settings } from 'meilisearch'
import type { MeilisearchProviderOptions } from '../types'
import { shadowAttribute } from './documents'

export interface IndexAttribute {
  path: string
  field: SearchTypes.SearchFieldDefinition
}

export interface IndexPlan {
  name: string
  primaryKey: string
  settings: Settings
  attributes: IndexAttribute[]
  dateAttributes: Set<string>
  searchableAttributes: string[]
}

export function assertIndexSupported(index: SearchTypes.ResolvedSearchIndexDefinition): void {
  for (const { path, field } of flattenFields(index.fields)) {
    if (field.correlated) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Meilisearch cannot serve the correlated field "${path}" on index "${index.name}": it flattens arrays of ` +
          `objects, so filters on sibling sub-fields match across elements. Drop \`correlated\` or move the index to ` +
          `a provider that supports it.`,
      )
    }

    if (field.type === 'geo' && path !== '_geo') {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Meilisearch only reads geo data from a top-level "_geo" attribute, but index "${index.name}" declares it as ` +
          `"${path}".`,
      )
    }

    if (field.type === 'vector' && field.dimensions === undefined) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `The vector field "${path}" on index "${index.name}" needs \`dimensions\` so an embedder can be configured.`,
      )
    }
  }
}

export function buildIndexPlan(
  index: SearchTypes.ResolvedSearchIndexDefinition,
  options: MeilisearchProviderOptions,
): IndexPlan {
  const attributes = flattenFields(index.fields)
  const primaryKey = index.primary_key
  const dateAttributes = new Set<string>()

  const searchable: { path: string; weight: number }[] = []
  const filterable = new Set<string>([primaryKey])
  const sortable = new Set<string>()
  const displayed = new Set<string>([primaryKey])
  const embedders: Embedders = {}

  for (const { path, field } of attributes) {
    if (field.type === 'date') {
      dateAttributes.add(path)
    }

    if (field.searchable) {
      searchable.push({ path, weight: typeof field.searchable === 'object' ? (field.searchable.weight ?? 1) : 1 })
    }

    if (field.filterable || field.facetable) {
      filterable.add(field.type === 'date' ? shadowAttribute(path) : path)
    }

    if (field.sortable) {
      sortable.add(field.type === 'date' ? shadowAttribute(path) : path)
    }

    if (field.retrievable !== false && field.type !== 'object') {
      displayed.add(path)
    }

    if (field.type === 'vector' && field.dimensions !== undefined) {
      embedders[path] = {
        source: 'userProvided',
        dimensions: field.dimensions,
        ...readFieldEmbedder(field),
      }
    }
  }

  const searchableAttributes = searchable
    .map((entry, order) => {
      return { ...entry, order }
    })
    .sort((a, b) => {
      return b.weight - a.weight || a.order - b.order
    })
    .map((entry) => {
      return entry.path
    })

  const derived: Settings = {
    searchableAttributes,
    filterableAttributes: [...filterable],
    sortableAttributes: [...sortable],
    displayedAttributes: [...displayed],
    ...buildDeclaredSettings(index.settings),
  }

  const resolvedEmbedders = { ...options.embedders, ...embedders, ...readIndexEmbedders(index.settings) }

  if (Object.keys(resolvedEmbedders).length) {
    derived.embedders = resolvedEmbedders
  }

  return {
    name: index.physical_name,
    primaryKey,
    settings: { ...options.settings, ...prune(derived), ...readIndexOverrides(index.settings) },
    attributes,
    dateAttributes,
    searchableAttributes,
  }
}

function buildDeclaredSettings(settings: SearchTypes.SearchIndexSettings): Settings {
  const declared: Settings = {
    synonyms: settings.synonyms,
    stopWords: settings.stop_words,
    distinctAttribute: settings.distinct_attribute,
  }

  if (settings.typo_tolerance) {
    declared.typoTolerance = prune({
      enabled: settings.typo_tolerance.enabled,
      minWordSizeForTypos: prune({
        oneTypo: settings.typo_tolerance.min_word_size_for_one_typo,
        twoTypos: settings.typo_tolerance.min_word_size_for_two_typos,
      }),
      disableOnAttributes: settings.typo_tolerance.disabled_on_attributes,
    })
  }

  if (settings.faceting) {
    declared.faceting = prune({
      maxValuesPerFacet: settings.faceting.max_values_per_facet,
      sortFacetValuesBy: settings.faceting.sort_by ? { '*': settings.faceting.sort_by } : undefined,
    })
  }

  if (settings.pagination?.max_total_hits !== undefined) {
    declared.pagination = { maxTotalHits: settings.pagination.max_total_hits }
  }

  if (settings.locales?.length) {
    declared.localizedAttributes = [{ attributePatterns: ['*'], locales: settings.locales.map(toEngineLocale) }]
  }

  return prune(declared)
}

export function toEngineLocale(locale: string): string {
  return locale.split(/[-_]/)[0].toLowerCase()
}

export function flattenFields(
  fields: Record<string, SearchTypes.SearchFieldDefinition>,
  prefix = '',
): IndexAttribute[] {
  const attributes: IndexAttribute[] = []

  for (const [name, field] of Object.entries(fields)) {
    const path = prefix ? `${prefix}.${name}` : name

    attributes.push({ path, field })

    if (field.fields) {
      attributes.push(...flattenFields(field.fields, path))
    }
  }

  return attributes
}

function readIndexOverrides(settings: SearchTypes.SearchIndexSettings): Settings {
  const overrides = readProviderOptions(settings)

  if (!overrides) {
    return {}
  }

  const { embedders: _embedders, ...rest } = overrides

  return rest
}

function readIndexEmbedders(settings: SearchTypes.SearchIndexSettings): Embedders {
  const embedders = readProviderOptions(settings)?.embedders

  return isRecord(embedders) ? embedders : {}
}

function readProviderOptions(
  settings: SearchTypes.SearchIndexSettings,
): (Settings & { embedders?: unknown }) | undefined {
  const options = settings.provider_options?.meilisearch

  return isRecord(options) ? options : undefined
}

function readFieldEmbedder(field: SearchTypes.SearchFieldDefinition): Record<string, unknown> {
  const providerOptions: unknown = field.provider_options?.meilisearch

  if (!isRecord(providerOptions)) {
    return {}
  }

  const embedder: unknown = providerOptions.embedder

  return isRecord(embedder) ? embedder : {}
}

function prune<T extends object>(value: T): Partial<T> {
  const result: Partial<T> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      Object.assign(result, { [key]: entry })
    }
  }

  return result
}

function isRecord(value: unknown): value is Record<string, never> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
