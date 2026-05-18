import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertProductWorkflow } from '../workflows/upsert-product'

export default async function meilisearchProductUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertProductWorkflow(container).run({
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
    'product.created',
    'product.updated',
    // Module events
    ProductEvents.PRODUCT_CREATED,
    ProductEvents.PRODUCT_UPDATED,
  ],
}
