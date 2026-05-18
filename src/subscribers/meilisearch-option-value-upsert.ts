import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertOptionValueWorkflow } from '../workflows/upsert-option-value'

export default async function meilisearchOptionValueUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertOptionValueWorkflow(container).run({
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
    'product-option-value.created',
    'product-option-value.updated',
    // Module events
    ProductEvents.PRODUCT_OPTION_VALUE_CREATED,
    ProductEvents.PRODUCT_OPTION_VALUE_UPDATED,
  ],
}
