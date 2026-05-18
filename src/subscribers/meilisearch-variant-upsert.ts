import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ProductEvents } from '@medusajs/utils'
import { upsertVariantWorkflow } from '../workflows/upsert-variant'

export default async function meilisearchVariantUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertVariantWorkflow(container).run({
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
    'product-variant.created',
    'product-variant.updated',
    // Module events
    ProductEvents.PRODUCT_VARIANT_CREATED,
    ProductEvents.PRODUCT_VARIANT_UPDATED,
  ],
}
