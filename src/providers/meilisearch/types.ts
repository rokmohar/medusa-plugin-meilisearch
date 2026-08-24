import type { Logger } from '@medusajs/types'
import type { Config, Embedders, Settings } from 'meilisearch'

export const MEILISEARCH_PROVIDER_IDENTIFIER = 'meilisearch'

export const DATE_SHADOW_SUFFIX = '__ts'

export interface MeilisearchProviderOptions {
  config: Config
  embedders?: Embedders
  settings?: Settings
  task_timeout_ms?: number
  task_polling_interval_ms?: number
}

export interface MeilisearchProviderDependencies {
  logger?: Logger
}
