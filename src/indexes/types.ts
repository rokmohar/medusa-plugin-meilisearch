import type { SearchTypes } from '@medusajs/types'

export interface SearchTransformContext {
  index: string
  locale?: string
}

export type SearchDocumentTransform = (
  entity: Record<string, unknown>,
  context: SearchTransformContext,
) => SearchTypes.SearchDocument

export interface SearchIndexFactoryOptions {
  name?: string
  provider?: string
  primary_key?: string
  fields?: SearchTypes.SearchIndexFieldsInput
  settings?: SearchTypes.SearchIndexSettings
  graph_fields?: string[]
  filters?: Record<string, unknown>
  transform?: SearchDocumentTransform
  batch_size?: number
  events?: string[]
  consume?: SearchTypes.SearchIndexDefinition['consume']
  locales?: string[]
  default_locale?: string
}

export interface ResolvedFactoryOptions {
  name: string
  entity: string
  provider?: string
  primaryKey: string
  fields: SearchTypes.SearchIndexFieldsInput
  settings: SearchTypes.SearchIndexSettings
  graphFields: string[]
  filters: Record<string, unknown>
  transform: SearchDocumentTransform
  batchSize: number
  events: string[]
  locale?: string
}
