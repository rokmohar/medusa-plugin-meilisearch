import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { Modules } from '@medusajs/utils'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const eventService = req.scope.resolve(Modules.EVENT_BUS)
  await eventService.emit({
    name: 'meilisearch.sync',
    data: {},
  })
  res.send({
    message: 'Syncing data to Meilisearch',
  })
}
