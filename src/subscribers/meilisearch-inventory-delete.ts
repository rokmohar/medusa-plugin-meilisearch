import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { InventoryEvents } from '@medusajs/utils'
import { deleteInventoryWorkflow } from '../workflows/delete-inventory'

export default async function meilisearchInventoryDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deleteInventoryWorkflow(container).run({
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
    'inventory-item.deleted',
    // Module events
    InventoryEvents.INVENTORY_ITEM_DELETED,
  ],
}
