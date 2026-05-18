import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertCollectionWorkflow } from '../workflows/upsert-collection'

export default async function meilisearchCollectionUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertCollectionWorkflow(container).run({
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
    'product-collection.created',
    'product-collection.updated',
    'product-collection.attached',
    'product-collection.detached',
    // Module events
    ProductEvents.PRODUCT_COLLECTION_CREATED,
    ProductEvents.PRODUCT_COLLECTION_UPDATED,
    ProductEvents.PRODUCT_COLLECTION_ATTACHED,
    ProductEvents.PRODUCT_COLLECTION_DETACHED,
  ],
}
