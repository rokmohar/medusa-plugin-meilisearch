import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { InventoryEvents } from '@medusajs/utils'
import { upsertInventoryLevelWorkflow } from '../workflows/upsert-inventory-level'

export default async function meilisearchInventoryLevelUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertInventoryLevelWorkflow(container).run({
      input: { id: data.id },
    })
  } catch (error) {
    logger.error(toError(error))
    throw error
  }
}

export const config: SubscriberConfig = {
  event: [
    // Workflow events
    'inventory-level.created',
    'inventory-level.updated',
    // Module events
    InventoryEvents.INVENTORY_LEVEL_CREATED,
    InventoryEvents.INVENTORY_LEVEL_UPDATED,
  ],
}
