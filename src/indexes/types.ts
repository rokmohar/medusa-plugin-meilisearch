import type { QueryContextType, SearchTypes } from '@medusajs/types'

export interface SearchTransformContext {
  index: string
  locale?: string
}

export type SearchDocumentTransform = (
  entity: Record<string, unknown>,
  context: SearchTransformContext,
) => SearchTypes.SearchDocument

export type SearchQueryContext =
  QueryContextType | ((context: SearchTypes.SearchIngestionContext) => QueryContextType | undefined)

export interface SearchIndexFactoryOptions {
  name?: string
  provider?: string
  primary_key?: string
  fields?: SearchTypes.SearchIndexFieldsInput
  settings?: SearchTypes.SearchIndexSettings
  graph_fields?: string[]
  filters?: Record<string, unknown>
  transform?: SearchDocumentTransform
  query_context?: SearchQueryContext
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
  queryContext?: SearchQueryContext
  batchSize: number
  events: string[]
  locale?: string
}
