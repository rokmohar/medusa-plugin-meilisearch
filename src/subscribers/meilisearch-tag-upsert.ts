import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertTagWorkflow } from '../workflows/upsert-tag'

export default async function meilisearchTagUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertTagWorkflow(container).run({
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
    'product-tag.created',
    'product-tag.updated',
    'product-tag.attached',
    'product-tag.detached',
    // Module events
    ProductEvents.PRODUCT_TAG_CREATED,
    ProductEvents.PRODUCT_TAG_UPDATED,
    ProductEvents.PRODUCT_TAG_ATTACHED,
    ProductEvents.PRODUCT_TAG_DETACHED,
  ],
}
