import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { deleteOptionWorkflow } from '../workflows/delete-option'

export default async function meilisearchOptionDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deleteOptionWorkflow(container).run({
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
    'product-option.deleted',
    // Module events
    ProductEvents.PRODUCT_OPTION_DELETED,
  ],
}
