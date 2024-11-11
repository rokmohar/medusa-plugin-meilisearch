import { MedusaModule } from "@medusajs/modules-sdk"
import {
  ExternalModuleDeclaration,
  ISearchService,
  InternalModuleDeclaration,
} from "@medusajs/types"
import { MeilisearchPluginOptions } from "../types";

export const initialize = async (
  options?: MeilisearchPluginOptions | ExternalModuleDeclaration
): Promise<ISearchService> => {
  const serviceKey = 'medusa-plugin-meilisearch'
  const loaded = await MedusaModule.bootstrap<ISearchService>({
    moduleKey: serviceKey,
    defaultPath: serviceKey,
    declaration: options as
      | InternalModuleDeclaration
      | ExternalModuleDeclaration,
  })

  return loaded[serviceKey]
}