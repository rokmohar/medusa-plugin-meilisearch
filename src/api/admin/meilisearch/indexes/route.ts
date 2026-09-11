import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { getRegisteredSearchIndexes } from '../../../utils/medusa'
import { resolveSearchModule, toIndexNames } from '../../../utils/search'

export interface AdminSearchIndexInfo {
  name: string
  entity: string
  locales?: string[]
  retrievable_fields: string[]
}

export interface AdminIndexesResponse {
  indexes: AdminSearchIndexInfo[]
}

export async function GET(req: MedusaRequest, res: MedusaResponse<AdminIndexesResponse>) {
  const searchModule = resolveSearchModule(req)
  const registered = toIndexNames(await searchModule.listIndexes())

  const indexes = getRegisteredSearchIndexes()
    .filter((definition) => {
      return registered.includes(definition.name)
    })
    .map((definition) => {
      return {
        name: definition.name,
        entity: definition.entity,
        locales: definition.settings?.locales,
        retrievable_fields: searchModule.listRetrievableFields(definition.name),
      }
    })

  res.json({ indexes })
}
