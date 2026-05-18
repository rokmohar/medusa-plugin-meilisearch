import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { InventoryEvents } from '@medusajs/utils'
import { upsertInventoryWorkflow } from '../workflows/upsert-inventory'

export default async function meilisearchInventoryUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertInventoryWorkflow(container).run({
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
    'inventory-item.created',
    'inventory-item.updated',
    // Module events
    InventoryEvents.INVENTORY_ITEM_CREATED,
    InventoryEvents.INVENTORY_ITEM_UPDATED,
  ],
}
