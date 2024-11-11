import Loader from './loaders'
import MeiliSearchService from './services/meilisearch'
import { ModuleExports } from "@medusajs/types";

const service = MeiliSearchService
const loaders = [Loader]

const moduleDefinition: ModuleExports = {
  service,
  loaders,
}

export default moduleDefinition

export * from "./initialize"
export * from "./types"