import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { deleteTypeWorkflow } from '../workflows/delete-type'

export default async function meilisearchTypeDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deleteTypeWorkflow(container).run({
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
    'product-type.deleted',
    // Module events
    ProductEvents.PRODUCT_TYPE_DELETED,
  ],
}
