import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { deleteOptionValueWorkflow } from '../workflows/delete-option-value'

export default async function meilisearchOptionValueDeleteHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await deleteOptionValueWorkflow(container).run({
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
    'product-option-value.deleted',
    // Module events
    ProductEvents.PRODUCT_OPTION_VALUE_DELETED,
  ],
}
