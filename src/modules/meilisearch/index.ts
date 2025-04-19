import { Module } from '@medusajs/utils'
import Loader from './loaders'
import { MeiliSearchService } from './services'

export * from './services'
export * from './types'

export const MEILISEARCH_MODULE = 'meilisearch'

export default Module(MEILISEARCH_MODULE, {
  service: MeiliSearchService,
  loaders: [Loader],
})
