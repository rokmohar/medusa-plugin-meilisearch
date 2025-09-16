import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { Modules } from '@medusajs/utils'

export interface AdminSyncResponse {
  message: string
}

export async function POST(req: MedusaRequest, res: MedusaResponse<AdminSyncResponse>) {
  const eventService = req.scope.resolve(Modules.EVENT_BUS)
  await eventService.emit({
    name: 'meilisearch.sync',
    data: {},
  })
  res.send({
    message: 'Syncing data to Meilisearch',
  })
}
