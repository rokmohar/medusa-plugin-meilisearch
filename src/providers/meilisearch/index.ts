import { ModuleProvider, Modules } from '@medusajs/utils'
import { MeilisearchSearchProviderService } from './service'

export * from './service'
export * from './types'

export default ModuleProvider(Modules.SEARCH, {
  services: [MeilisearchSearchProviderService],
})
