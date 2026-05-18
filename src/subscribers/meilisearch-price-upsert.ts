import { toError } from '../utils/error'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { PricingEvents } from '@medusajs/utils'
import { upsertPriceWorkflow } from '../workflows/upsert-price'

export default async function meilisearchPriceUpsertHandler({
  container,
  event: { data },
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve('logger')

  try {
    await upsertPriceWorkflow(container).run({
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
    'price.created',
    'price.updated',
    // Module events
    PricingEvents.PRICE_CREATED,
    PricingEvents.PRICE_UPDATED,
  ],
}
