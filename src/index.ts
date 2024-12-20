import Loader from './loaders'
import { MeiliSearchService } from './services'
import { ModuleExports } from '@medusajs/types'

export * from './services'
export * from './types'

const service = MeiliSearchService
const loaders = [Loader]

const moduleDefinition: ModuleExports = {
  service,
  loaders,
}

export default moduleDefinition
