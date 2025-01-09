import { Module } from '@medusajs/utils'
import Loader from './loaders'
import { MeiliSearchService } from './services'

export * from './services'
export * from './types'

export default Module('meilisearch', {
  service: MeiliSearchService,
  loaders: [Loader],
})
