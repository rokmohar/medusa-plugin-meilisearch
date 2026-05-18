import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertTypeWorkflow } from '../workflows/upsert-type'

export default async function meilisearchTypeUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertTypeWorkflow(container).run({
      input: { id: data.id },
    })
  } catch (error) {
    logger.error(toError(error))
    throw error
  }
}

export const config: SubscriberConfig = {
  event: [
    // Workflow evets
    'product-type.created',
    'product-type.updated',
    'product-type.attached',
    'product-type.detached',
    // Module events
    ProductEvents.PRODUCT_TYPE_CREATED,
    ProductEvents.PRODUCT_TYPE_UPDATED,
    ProductEvents.PRODUCT_TYPE_ATTACHED,
    ProductEvents.PRODUCT_TYPE_DETACHED,
  ],
}
