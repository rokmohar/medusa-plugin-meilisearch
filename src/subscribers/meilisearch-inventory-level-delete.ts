import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { InventoryEvents } from '@medusajs/utils'
import { deleteInventoryLevelWorkflow } from '../workflows/delete-inventory-level'

export default async function meilisearchInventoryLevelDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deleteInventoryLevelWorkflow(container).run({
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
    'inventory-level.deleted',
    // Module events
    InventoryEvents.INVENTORY_LEVEL_DELETED,
  ],
}
